import { useState } from "react";
import { ACTIVITIES, DAY_PLAN, LENGTHS, activityMenu } from "../engine/program.js";
import { addDays, dayIndex, DAY_NAMES, fromKey, mondayOf, toKey } from "../engine/dates.js";
import { ActivityPicker, FinishCard, Modal, StatusLine } from "../ui.jsx";

const LENGTH_LABEL = { short: "Short", 30: "30 min", 45: "45 min" };

function dose(ex) {
  const base = ex.repsLabel === "max minus 2" ? `${ex.sets.length} × max` : `${ex.sets.length} × ${ex.repsLabel}`;
  return ex.suggestion?.weight ? `${base} · ${ex.suggestion.weight} lb` : base;
}

function PlanList({ plan }) {
  const rows = [];
  let lastGroup = null;
  if (plan.cardio?.length) {
    const a = ACTIVITIES[plan.activity?.type];
    rows.push(<li key="cg" className="pl-group">{plan.cardioTitle || "Cardio"}</li>);
    plan.cardio.forEach((item, i) => rows.push(
      <li key={`c${i}`}>
        <span className="pl-name">{item.text}</span>
        {i === 0 && a && <span className="pl-dose">{plan.activity.minutes} min</span>}
      </li>
    ));
    if (plan.exercises.length) rows.push(<li key="coreg" className="pl-group">{plan.exercises[0].group || "Core"}</li>);
    lastGroup = plan.exercises[0]?.group || null;
  }
  if (plan.kind === "lift" && plan.warmup?.length) {
    rows.push(<li key="wg" className="pl-group">Warm-up</li>);
    plan.warmup.forEach((item, i) => rows.push(<li key={`w${i}`}><span className="pl-name">{item.text.split(",")[0]}</span></li>));
    rows.push(<li key="ramp"><span className="pl-name">Lighter sets of the lifts</span></li>);
    rows.push(<li key="lg" className="pl-group">Lifts</li>);
  }
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
  if (plan.kind === "lift" && plan.cooldown?.length) {
    rows.push(<li key="cdg" className="pl-group">{plan.cooldownTitle || "Cool-down"}</li>);
    plan.cooldown.forEach((item, i) => rows.push(<li key={`cd${i}`}><span className="pl-name">{item.text.split(":")[0]}</span><span className="pl-dose">{item.text.split(": ")[1] || ""}</span></li>));
  }
  if (plan.activity && !plan.cardio?.length) {
    const a = ACTIVITIES[plan.activity.type];
    rows.push(<li key="act"><span className="pl-name"><span aria-hidden="true">{a.emoji} </span>{a.label}</span><span className="pl-dose">{plan.activity.minutes} min</span></li>);
  }
  return <ul className="plan-list">{rows}</ul>;
}

function QuickLog({ onSave, onClose, initialType, activities }) {
  const [activity, setActivity] = useState({ type: initialType, minutes: activities[initialType].minutes, hard: false, options: Object.keys(activities) });
  return (
    <Modal title="Log movement" onClose={onClose}>
      <ActivityPicker activity={activity} activities={activities} onChange={(patch) => setActivity({ ...activity, ...patch })} />
      <button type="button" className="btn-primary" style={{ marginTop: 16 }} disabled={!activity.minutes}
        onClick={() => onSave({ type: activity.type, minutes: activity.minutes, hard: activity.hard })}>
        Save {activities[activity.type].label.toLowerCase()}, {activity.minutes} min
      </button>
    </Modal>
  );
}

export default function TodayScreen({
  today, selectedKey, onSelect, plan, length, onLength, settings, planDone, doneKeys, activeSession,
  onResume, onStart, onQuickLog, status, finish, onFinishDone,
}) {
  const [quick, setQuick] = useState(null);
  const monday = mondayOf(today);
  const todayKey = toKey(today);
  const selected = fromKey(selectedKey);
  const isToday = selectedKey === todayKey;
  const dayPlan = DAY_PLAN[dayIndex(selected)];
  const total = plan.estMinutes + (plan.activity?.minutes || 0);
  const activities = activityMenu(settings);
  const open = plan.kind === "open";

  return (
    <>
      {finish && <FinishCard finish={finish} onDone={onFinishDone} />}
      <StatusLine status={status} />

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

      {open ? (
        <section className="card" aria-label="Open day">
          <div className="row wrap" style={{ marginBottom: 8 }}>
            {doneKeys.has(selectedKey) && <span className="tag green">✓ Moved</span>}
            {!isToday && <span className="tag amber">{DAY_NAMES[dayIndex(selected)]}</span>}
          </div>
          <h2 className="plan-title"><span aria-hidden="true">{plan.emoji} </span>{plan.templateName}</h2>
          <p className="plan-meta">{plan.note}</p>
          {activeSession && (
            <div className="stack" style={{ marginTop: 12 }}>
              <button type="button" className="btn-primary" onClick={onResume}>Resume {activeSession.templateName}</button>
            </div>
          )}
        </section>
      ) : (
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

          <h3 className="label" id="length-pick" style={{ marginTop: 10 }}>Length for this day</h3>
          <div className="chips" role="group" aria-labelledby="length-pick" style={{ marginBottom: 8 }}>
            {LENGTHS.map((l) => (
              <button key={l} type="button" className="chip" aria-pressed={length === l} onClick={() => onLength(l)}>
                {LENGTH_LABEL[l]}{l === settings.minutes ? " (default)" : ""}
              </button>
            ))}
          </div>

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
            </div>
          )}

          <a className="btn-link" href={`/why${plan.why?.length ? `#${plan.why[0]}` : ""}`}>Why this workout?</a>
        </section>
      )}

      <h2 className="label" id="quick-log">{open ? "Log your movement" : "Log other movement"}</h2>
      <div className="chips" role="group" aria-labelledby="quick-log">
        {Object.entries(activities).map(([type, a]) => (
          <button key={type} type="button" className="chip" onClick={() => setQuick(type)}>
            <span aria-hidden="true">{a.emoji} </span>{a.label}
          </button>
        ))}
      </div>

      {quick && (
        <QuickLog initialType={quick} activities={activities} onClose={() => setQuick(null)} onSave={(a) => { onQuickLog(a); setQuick(null); }} />
      )}
    </>
  );
}
