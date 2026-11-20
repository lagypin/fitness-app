import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { byId } from "./exercises.js";
import { ACTIVITIES, buildSessionFor, normalizeSession, swapExercise, withDefaults } from "./engine/program.js";
import { applySuggestions } from "./engine/progression.js";
import { daysMovedThisWeek, weekSummary } from "./engine/stats.js";
import { entryDayKey, fromKey, mondayOf, toKey } from "./engine/dates.js";
import { KEYS, LS, dropRetiredKeys, uid } from "./storage.js";
import TodayScreen from "./screens/Today.jsx";
import SessionScreen from "./screens/Session.jsx";
import WeekScreen from "./screens/Week.jsx";
import LogScreen from "./screens/Log.jsx";
import MoreScreen from "./screens/More.jsx";
import SettingsForm from "./screens/Settings.jsx";
import { fmtDate } from "./ui.jsx";

const TABS = [["today", "Today"], ["week", "Week"], ["log", "Log"], ["more", "More"]];

dropRetiredKeys();

function initialProgramStart() {
  const saved = LS.get(KEYS.programStart);
  if (saved) return saved;
  const start = toKey(mondayOf(new Date()));
  LS.set(KEYS.programStart, start);
  return start;
}

export default function App() {
  const [tab, setTab] = useState("today");
  const [today, setToday] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => toKey(new Date()));
  const [sessions, setSessions] = useState(() => LS.get(KEYS.sessions, []));
  const [active, setActive] = useState(() => normalizeSession(LS.get(KEYS.active, null)));
  const [showSession, setShowSession] = useState(false);
  const [settings, setSettings] = useState(() => withDefaults(LS.get(KEYS.settings)));
  const [swaps, setSwaps] = useState(() => LS.get(KEYS.swaps, {}));
  const [lengths, setLengths] = useState(() => LS.get(KEYS.lengths, {}));
  const [programStart] = useState(initialProgramStart);
  const [status, setStatus] = useState(null); // { text, emoji? }

  // Roll over to the new day when the app comes back to the foreground.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = new Date();
      setToday((prev) => {
        if (toKey(prev) !== toKey(now)) setSelectedKey(toKey(now));
        return now;
      });
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  const saveSessions = (next) => { setSessions(next); LS.set(KEYS.sessions, next); };
  const saveActive = (next) => { setActive(next); LS.set(KEYS.active, next); };
  const updateActive = (fn) => setActive((prev) => { const next = fn(prev); LS.set(KEYS.active, next); return next; });
  const say = (text, emoji) => setStatus(text ? { text, emoji } : null);

  // The length picked for a day on the Today tab, or the Settings default.
  const lengthFor = (dayKey) => lengths[dayKey] ?? settings.minutes;

  function planFor(dayKey) {
    const base = buildSessionFor(fromKey(dayKey), programStart, { length: lengthFor(dayKey), settings });
    const ids = new Set(base.exercises.map((e) => e.exerciseId));
    const swapped = {
      ...base,
      exercises: base.exercises.map((ex) => {
        const to = swaps[ex.exerciseId];
        return to && byId(to) && !ids.has(to) ? swapExercise(ex, to) : ex;
      }),
    };
    return applySuggestions(swapped, sessions, { barWeight: settings.barWeight });
  }

  const plan = useMemo(() => planFor(selectedKey), [selectedKey, sessions, swaps, lengths, programStart, settings]);
  const week = useMemo(() => weekSummary(sessions, mondayOf(today)), [sessions, today]);
  const movedCount = useMemo(() => daysMovedThisWeek(sessions, today), [sessions, today]);
  const doneKeys = useMemo(() => new Set(sessions.map(entryDayKey)), [sessions]);
  const planDone = sessions.some((s) => s.planDayKey === selectedKey);

  function start(p) {
    const now = new Date();
    saveActive({ ...p, id: uid(), planDayKey: p.dayKey, dayKey: toKey(now), date: now.toISOString(), startedAt: now.getTime() });
    say(null);
    setShowSession(true);
  }

  function resume() {
    setShowSession(true);
  }

  function complete() {
    const elapsed = Math.round((Date.now() - (active.startedAt || Date.now())) / 60000);
    const lifted = active.exercises.length > 0;
    const planned = active.estMinutes + (active.activity?.minutes || 0);
    // A lifting session times itself; anything else (and a lift logged much later) uses the planned length.
    const durationMin = lifted && elapsed >= 5 && elapsed <= 150 ? elapsed : planned;
    saveSessions([...sessions, { ...active, completed: true, completedAt: new Date().toISOString(), durationMin }]);
    saveActive(null);
    setShowSession(false);
    setTab("today");
    say(`Saved: ${active.templateName}. Nice work.`);
  }

  function quickLog(activity) {
    const now = new Date();
    const a = ACTIVITIES[activity.type];
    saveSessions([...sessions, {
      id: uid(), kind: "activity", templateId: activity.type, templateName: a.label, emoji: a.emoji,
      date: now.toISOString(), dayKey: toKey(now), exercises: [], activity, durationMin: activity.minutes, completed: true,
    }]);
    say(`${a.label}, ${activity.minutes} min logged.`);
  }

  function swap(exIndex, newId, always) {
    const from = active.exercises[exIndex].exerciseId;
    updateActive((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => {
        if (i !== exIndex) return ex;
        const next = swapExercise(ex, newId);
        return applySuggestions({ exercises: [next] }, sessions, { barWeight: settings.barWeight }).exercises[0];
      }),
    }));
    if (always) {
      const next = { ...swaps, [from]: newId };
      setSwaps(next); LS.set(KEYS.swaps, next);
    }
  }

  function removeSwap(from) {
    const next = { ...swaps };
    delete next[from];
    setSwaps(next); LS.set(KEYS.swaps, next);
  }

  function saveSettings(next) {
    const clean = withDefaults(next); // drops settings this version no longer keeps
    setSettings(clean); LS.set(KEYS.settings, clean);
    say("Plan updated.");
  }

  function setLength(length) {
    const next = { ...lengths };
    if (length === settings.minutes) delete next[selectedKey]; else next[selectedKey] = length;
    setLengths(next); LS.set(KEYS.lengths, next);
  }

  const firstRun = !settings.setupDone;
  const inSession = showSession && Boolean(active);

  // Each screen starts at the top.
  useEffect(() => { window.scrollTo(0, 0); }, [tab, inSession, firstRun]);

  if (inSession) {
    return (
      <div className="app">
        <SessionScreen
          session={active}
          barWeight={settings.barWeight}
          equipment={settings.equipment}
          onUpdateSet={(ei, si, patch) => updateActive((prev) => ({
            ...prev,
            exercises: prev.exercises.map((ex, i) => i !== ei ? ex : {
              ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)),
            }),
          }))}
          onToggleCheck={(list, i) => updateActive((prev) => ({
            ...prev, [list]: prev[list].map((item, j) => (j === i ? { ...item, done: !item.done } : item)),
          }))}
          onFeel={(ei, feel) => updateActive((prev) => ({
            ...prev, exercises: prev.exercises.map((ex, i) => (i === ei ? { ...ex, feel } : ex)),
          }))}
          onActivity={(patch) => updateActive((prev) => ({ ...prev, activity: { ...prev.activity, ...patch } }))}
          onSwap={swap}
          onComplete={complete}
          onExit={() => setShowSession(false)}
          onDiscard={() => { saveActive(null); setShowSession(false); say("Session discarded."); }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1 className="app-title">Let's move.</h1>
            <div className="app-sub">{fmtDate(today, { weekday: "long", month: "long", day: "numeric" })}</div>
          </div>
          <div className="week-badge" role="img" aria-label={`${movedCount} ${movedCount === 1 ? "day" : "days"} moved this week`}>
            <div className="week-badge-num" aria-hidden="true">{movedCount}</div>
            <div className="week-badge-label" aria-hidden="true">{movedCount === 1 ? "day" : "days"} this week</div>
          </div>
        </div>
      </header>

      {!firstRun && (
        <nav className="nav" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className="nav-btn" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
              {label}
              {id === "today" && active && <span className="active-dot" aria-label=", session in progress" role="img" />}
            </button>
          ))}
        </nav>
      )}

      <main className="scroll">
        {firstRun && <SettingsForm settings={settings} firstRun onSave={saveSettings} />}
        {!firstRun && tab === "today" && (
          <TodayScreen
            today={today} selectedKey={selectedKey} onSelect={setSelectedKey}
            plan={plan} length={lengthFor(selectedKey)} onLength={setLength} settings={settings}
            planDone={planDone} doneKeys={doneKeys} status={status}
            activeSession={active} onResume={resume}
            onStart={() => start(plan)}
            onQuickLog={quickLog}
          />
        )}
        {!firstRun && tab === "week" && (
          <WeekScreen today={today} sessions={sessions} programStart={programStart} settings={settings} lengths={lengths} />
        )}
        {!firstRun && tab === "log" && (
          <LogScreen sessions={sessions} onDelete={(id) => saveSessions(sessions.filter((s) => s.id !== id))} />
        )}
        {!firstRun && tab === "more" && (
          <MoreScreen
            sessions={sessions} extras={{ programStart, swaps, settings }} onReplaceSessions={saveSessions}
            settings={settings} onSaveSettings={saveSettings}
            swaps={swaps} onRemoveSwap={removeSwap} status={status}
          />
        )}
      </main>
    </div>
  );
}
