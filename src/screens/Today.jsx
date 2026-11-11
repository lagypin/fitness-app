import { useState } from "react";
import { ACTIVITIES, DAY_PLAN } from "../engine/program.js";
import { addDays, dayIndex, DAY_NAMES, fromKey, mondayOf, toKey } from "../engine/dates.js";
import { principleById } from "../engine/evidence.js";
import { AEROBIC_TARGET_MIN, STRENGTH_TARGET_DAYS } from "../engine/stats.js";
import { ActivityPicker, Meter, Modal } from "../ui.jsx";

function dose(ex) {
  const base = ex.repsLabel === "max minus 2" ? `${ex.sets.length} × max` : `${ex.sets.length} × ${ex.repsLabel}`;
  return ex.suggestion?.weight ? `${base} · ${ex.suggestion.weight} lb` : base;
}

function PlanList({ plan }) {
  const rows = [];
  let lastGroup = null;
  plan.exercises.forEach((ex, i) => {
    if (ex.group && ex.group !== lastGroup) rows.push(<li key={`g${i}`} className="pl-group">{ex.group}</li>);
    lastGroup = ex.group || null;
    rows.push(
      <li key={i}>
        <span className="pl-name">{ex.name}</span>
        <span className="pl-dose">{dose(ex)}</span>
      </li>
    );
  });
  (plan.main || []).forEach((item, i) => rows.push(<li key={`m${i}`}><span className="pl-name">{item.text}</span></li>));
  if (plan.kind === "mobility" && !plan.short) {
    rows.push(<li key="flow"><span className="pl-name">{plan.warmupTitle}</span><span className="pl-dose">about {plan.estMinutes} min</span></li>);
  }
  if (plan.activity && !plan.main) {
    const a = ACTIVITIES[plan.activity.type];
    rows.push(<li key="act"><span className="pl-name"><span aria-hidden="true">{a.emoji} </span>{a.label}</span><span className="pl-dose">{plan.activity.minutes} min</span></li>);
  }
  return <ul className="plan-list">{rows}</ul>;
}

function QuickLog({ onSave, onClose, initialType }) {
  const [activity, setActivity] = useState({ type: initialType, minutes: ACTIVITIES[initialType].minutes, hard: false, options: Object.keys(ACTIVITIES) });
  return (
    <Modal title="Log movement" onClose={onClose}>
      <ActivityPicker activity={activity} activities={ACTIVITIES} onChange={(patch) => setActivity({ ...activity, ...patch })} />
      <button type="button" className="btn-primary" style={{ marginTop: 16 }} disabled={!activity.minutes}
        onClick={() => onSave({ type: activity.type, minutes: activity.minutes, hard: activity.hard })}>
        Save {ACTIVITIES[activity.type].label.toLowerCase()}, {activity.minutes} min
      </button>
    </Modal>
  );
}

export default function TodayScreen({
  today, selectedKey, onSelect, plan, shortMinutes, planDone, week, doneKeys, activeSession,
  onResume, onStart, onStartShort, onReroll, onQuickLog, onOpenWhy, status,
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [quick, setQuick] = useState(null);
  const monday = mondayOf(today);
  const todayKey = toKey(today);
  const selected = fromKey(selectedKey);
  const isToday = selectedKey === todayKey;
  const dayPlan = DAY_PLAN[dayIndex(selected)];
  const total = plan.estMinutes + (plan.activity?.minutes || 0);

  return (
    <>
      {status && <p className="status" role="status">{status}</p>}

      {activeSession && (
        <button type="button" className="active-banner" onClick={onResume}>
          <span>
            <span className="active-banner-text">Session in progress</span>
            <span className="active-banner-sub" style={{ display: "block" }}>{activeSession.templateName}: tap to pick it back up</span>
          </span>
          <span aria-hidden="true" style={{ fontSize: 20 }}>→</span>
        </button>
      )}

      <div className="week-strip" role="group" aria-label="This week">
        {DAY_PLAN.map((d, i) => {
          const date = addDays(monday, i);
          const key = toKey(date);
          const done = doneKeys.has(key);
          return (
            <button
              key={key} type="button" aria-pressed={key === selectedKey}
              className={`day-btn ${key === todayKey ? "is-today" : ""}`}
              onClick={() => onSelect(key)}
            >
              <span className="d-letter">{DAY_NAMES[i].slice(0, 3)}</span>
              <span className="d-emoji" aria-hidden="true">{d.emoji}</span>
              <span className="sr-only">{d.name}{done ? ", movement logged" : ""}{key === todayKey ? ", today" : ""}</span>
              <span className="d-mark" aria-hidden="true">{done ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>

      <section className="card" aria-label="Planned session">
        <div className="row wrap" style={{ marginBottom: 8 }}>
          {plan.format && <span className="tag">{plan.kind === "lift" ? `${plan.format.name} week` : plan.format.name}</span>}
          {planDone && <span className="tag green">✓ Done</span>}
          {!isToday && <span className="tag amber">{DAY_NAMES[dayIndex(selected)]}'s plan</span>}
        </div>
        <h2 className="plan-title"><span aria-hidden="true">{plan.emoji} </span>{plan.templateName}</h2>
        <p className="plan-meta">
          About {total} min{plan.format?.tagline ? ` · ${plan.format.tagline}` : ""}
        </p>
        {plan.blockNote && <p className="plan-meta">{plan.blockNote}</p>}

        <PlanList plan={plan} />

        {activeSession ? (
          <div className="stack">
            <button type="button" className="btn-primary" onClick={onResume}>Resume {activeSession.templateName}</button>
            <p className="muted">Finish or discard the session in progress before starting another.</p>
          </div>
        ) : (
          <div className="stack">
            <button type="button" className="btn-primary" onClick={onStart}>
              {planDone ? "Do it again" : isToday ? "Start" : `Do ${dayPlan.name} today`}
            </button>
            <button type="button" className="btn-secondary" onClick={onStartShort}>
              Short version, about {shortMinutes} min
            </button>
            {plan.kind === "surprise" && (
              <button type="button" className="btn-secondary" onClick={onReroll}>Deal me a different one</button>
            )}
          </div>
        )}

        <button type="button" className="btn-link" aria-expanded={showWhy} onClick={() => setShowWhy(!showWhy)}>
          {showWhy ? "Hide the reasons" : "Why this workout?"}
        </button>
        {showWhy && (
          <div className="why-box">
            {(plan.why || []).map((id) => {
              const p = principleById(id);
              return p ? <p key={id}><strong>{p.title}.</strong> {p.rule}</p> : null;
            })}
            <button type="button" className="btn-link" onClick={onOpenWhy}>Read the research behind each rule</button>
          </div>
        )}
      </section>

      <h2 className="label" id="quick-log">Log other movement</h2>
      <div className="chips" role="group" aria-labelledby="quick-log">
        {Object.entries(ACTIVITIES).map(([type, a]) => (
          <button key={type} type="button" className="chip" onClick={() => setQuick(type)}>
            <span aria-hidden="true">{a.emoji} </span>{a.label}
          </button>
        ))}
      </div>

      <h2 className="label">This week</h2>
      <div className="card">
        <Meter label="Aerobic minutes" value={week.aerobicMinutes} target={AEROBIC_TARGET_MIN} unit=" min" />
        <Meter label="Strength days" value={week.strengthDays} target={STRENGTH_TARGET_DAYS} />
        <Meter label="Days moved" value={week.activeDays} target={7} />
      </div>

      {quick && (
        <QuickLog initialType={quick} onClose={() => setQuick(null)} onSave={(a) => { onQuickLog(a); setQuick(null); }} />
      )}
    </>
  );
}
