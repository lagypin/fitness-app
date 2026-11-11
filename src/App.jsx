import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { byId } from "./exercises.js";
import { ACTIVITIES, buildSessionFor, normalizeSession, swapExercise, withDefaults } from "./engine/program.js";
import { applySuggestions } from "./engine/progression.js";
import { streak, weekSummary } from "./engine/stats.js";
import { entryDayKey, fromKey, mondayOf, toKey } from "./engine/dates.js";
import { KEYS, LS, uid } from "./storage.js";
import TodayScreen from "./screens/Today.jsx";
import SessionScreen from "./screens/Session.jsx";
import WeekScreen from "./screens/Week.jsx";
import LogScreen from "./screens/Log.jsx";
import LibraryScreen from "./screens/Library.jsx";
import WhyScreen from "./screens/Why.jsx";
import SettingsForm from "./screens/Settings.jsx";
import { fmtDate } from "./ui.jsx";

const TABS = [["today", "Today"], ["week", "Week"], ["log", "Log"], ["library", "Library"], ["why", "Why"]];

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
  const [rerolls, setRerolls] = useState(() => LS.get(KEYS.rerolls, {}));
  const [programStart] = useState(initialProgramStart);
  const [status, setStatus] = useState("");

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

  function planFor(dayKey, { short = false } = {}) {
    const base = buildSessionFor(fromKey(dayKey), programStart, { short, reroll: rerolls[dayKey] || 0, settings });
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

  const plan = useMemo(() => planFor(selectedKey), [selectedKey, sessions, swaps, rerolls, programStart, settings]);
  const shortPlan = useMemo(() => planFor(selectedKey, { short: true }), [selectedKey, sessions, swaps, rerolls, programStart, settings]);
  const week = useMemo(() => weekSummary(sessions, mondayOf(today)), [sessions, today]);
  const streakCount = useMemo(() => streak(sessions, today), [sessions, today]);
  const doneKeys = useMemo(() => new Set(sessions.map(entryDayKey)), [sessions]);
  const planDone = sessions.some((s) => s.planDayKey === selectedKey);

  function start(p) {
    const now = new Date();
    saveActive({ ...p, id: uid(), planDayKey: p.dayKey, dayKey: toKey(now), date: now.toISOString(), startedAt: now.getTime() });
    setStatus("");
    setShowSession(true);
  }

  function complete() {
    const elapsed = Math.round((Date.now() - (active.startedAt || Date.now())) / 60000);
    const lifted = active.exercises.length > 0;
    const durationMin = lifted
      ? (elapsed >= 5 && elapsed <= 150 ? elapsed : active.estMinutes)
      : active.estMinutes + (active.activity?.minutes || 0);
    saveSessions([...sessions, { ...active, completed: true, completedAt: new Date().toISOString(), durationMin }]);
    saveActive(null);
    setShowSession(false);
    setTab("today");
    setStatus(`Saved: ${active.templateName}. Nice work.`);
  }

  function quickLog(activity) {
    const now = new Date();
    const a = ACTIVITIES[activity.type];
    saveSessions([...sessions, {
      id: uid(), kind: "activity", templateId: activity.type, templateName: a.label, emoji: a.emoji,
      date: now.toISOString(), dayKey: toKey(now), exercises: [], activity, durationMin: activity.minutes, completed: true,
    }]);
    setStatus(`Logged: ${a.label}, ${activity.minutes} min.`);
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
    setSettings(next); LS.set(KEYS.settings, next);
    setStatus("Plan updated.");
  }

  function reroll() {
    const next = { ...rerolls, [selectedKey]: (rerolls[selectedKey] || 0) + 1 };
    setRerolls(next); LS.set(KEYS.rerolls, next);
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
          onDiscard={() => { saveActive(null); setShowSession(false); setStatus("Session discarded."); }}
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
          <div className="streak-badge" role="img" aria-label={`${streakCount} day streak`}>
            <div className="streak-num" aria-hidden="true">{streakCount}</div>
            <div className="streak-label" aria-hidden="true">day streak</div>
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
            plan={plan} shortMinutes={shortPlan.estMinutes + (shortPlan.activity?.minutes || 0)}
            planDone={planDone} week={week} doneKeys={doneKeys} status={status}
            activeSession={active} onResume={() => setShowSession(true)}
            onStart={() => start(plan)} onStartShort={() => start(shortPlan)}
            onReroll={reroll} onQuickLog={quickLog} onOpenWhy={() => setTab("why")}
          />
        )}
        {!firstRun && tab === "week" && (
          <WeekScreen today={today} sessions={sessions} programStart={programStart} streakCount={streakCount}
            swaps={swaps} onRemoveSwap={removeSwap} settings={settings} onSaveSettings={saveSettings} />
        )}
        {!firstRun && tab === "log" && (
          <LogScreen sessions={sessions} extras={{ programStart, swaps, settings }}
            onReplace={saveSessions} onDelete={(id) => saveSessions(sessions.filter((s) => s.id !== id))} />
        )}
        {!firstRun && tab === "library" && <LibraryScreen />}
        {!firstRun && tab === "why" && <WhyScreen />}
      </main>
    </div>
  );
}
