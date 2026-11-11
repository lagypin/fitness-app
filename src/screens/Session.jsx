import { useEffect, useMemo, useState } from "react";
import { FORM_GUIDES, swapOptions } from "../exercises.js";
import { ACTIVITIES, canDo, watchWorkoutFor } from "../engine/program.js";
import { rampUpSets } from "../engine/progression.js";
import { ActivityPicker, Checklist, Modal, fmtClock, fmtDate, fmtRest } from "../ui.jsx";

const ROLE_LABEL = { main: "Main lift", second: "Second lift" };

const FEELS = [
  { id: "easy", label: "Easy", sub: "4+ left" },
  { id: "good", label: "Good", sub: "2 or 3 left" },
  { id: "hard", label: "Hard", sub: "0 or 1 left" },
];

function targetLine(ex, grouped) {
  const n = ex.sets.length;
  const sets = `${n} ${n === 1 ? "set" : "sets"}`;
  let line;
  if (ex.repsLabel === "max minus 2") line = `${sets} × as many clean reps as you can, stopping 2 short`;
  else if (ex.unit !== "reps") line = `${sets} × ${ex.repsLabel}`;
  else line = `${sets} × ${ex.repsLabel} reps · leave ${ex.targetRir} in the tank`;
  if (!grouped && ex.restSec > 0) line += ` · rest ${fmtRest(ex.restSec)}`;
  return line;
}

function groupSubtitle(name, items) {
  const first = items[0].ex;
  const rounds = first.sets.length;
  if (name === "On the minute") {
    return `${rounds * items.length} minutes. Start one move at the top of each minute and rest for what's left of it. ${rounds} rounds.`;
  }
  if (name === "Circuit") return `${rounds} rounds. Move through all of them, then rest ${fmtRest(first.restSec)}.`;
  return `${rounds} rounds. Alternate the two moves, then rest ${fmtRest(first.restSec)}.`;
}

function SwapModal({ exercise, inSession, equipment, onSwap, onClose }) {
  const [always, setAlways] = useState(false);
  // Same movement pattern, doable with the person's equipment, not already in this session.
  // Main lifts are only offered for main-lift slots.
  const big = exercise.role === "main" || exercise.role === "second";
  const options = swapOptions(exercise.exerciseId)
    .filter((o) => canDo(o, equipment) && !inSession.has(o.id) && (big || !o.isAnchor));
  return (
    <Modal title={`Swap ${exercise.name}`} onClose={onClose}>
      <button type="button" className="chip" aria-pressed={always} onClick={() => setAlways(!always)} style={{ marginBottom: 6 }}>
        {always ? "✓ " : ""}Use this swap every time
      </button>
      <p className="muted" style={{ marginBottom: 12 }}>
        Handy when a move bothers a joint. You can undo standing swaps on the Week tab.
      </p>
      {options.length === 0 && <p className="muted">No alternatives for this slot with your equipment.</p>}
      {options.map((opt) => (
        <button key={opt.id} type="button" className="swap-option" onClick={() => onSwap(opt.id, always)}>
          <div className="swap-name">{opt.name}</div>
          <div className="swap-notes">{opt.notes?.length > 90 ? opt.notes.slice(0, 90) + "…" : opt.notes}</div>
        </button>
      ))}
    </Modal>
  );
}

function ExerciseCard({ ex, index, grouped, barWeight, onUpdateSet, onToggleSet, onFeel, onSwap }) {
  const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.done);
  const weighted = ex.loadType !== "body";
  const guide = FORM_GUIDES[ex.exerciseId];
  return (
    <div className={`ex-card ${allDone ? "all-done" : ""}`}>
      <div className="ex-header">
        <div>
          <h3 className="ex-name">{ex.name}</h3>
          {ROLE_LABEL[ex.role] && <span className="tag" style={{ marginTop: 6 }}>{ROLE_LABEL[ex.role]}</span>}
        </div>
        <button type="button" className="btn-small" onClick={() => onSwap(index)}>Swap<span className="sr-only"> {ex.name}</span></button>
      </div>

      <div className="ex-target">{targetLine(ex, grouped)}</div>

      {ex.suggestion && (
        <div className="ex-suggest">
          {ex.suggestion.last && <div>Last time: {ex.suggestion.last}</div>}
          {ex.suggestion.basis && <div>{ex.suggestion.basis}</div>}
        </div>
      )}
      {!ex.suggestion && weighted && (
        <div className="ex-suggest">First time logging this one. Pick a weight that leaves about {ex.targetRir} reps in the tank.</div>
      )}
      {ex.role === "main" && (
        <div className="ex-suggest"><strong>Ramp up:</strong> {rampUpSets(ex, barWeight)[0]}</div>
      )}
      {ex.loadType === "body" && (ex.role === "main" || ex.role === "second") && ex.unit === "reps" && ex.repsLabel !== "max minus 2" && (
        <div className="ex-suggest">Bodyweight: change your body angle or foot position to make it harder or easier.</div>
      )}

      {ex.notes && <p className="ex-notes">{ex.notes}</p>}
      {guide && (
        <p className="ex-links">
          <a href={guide} target="_blank" rel="noreferrer">Form guide for {ex.name} (ACE, opens in a new tab)</a>
        </p>
      )}

      <div className={`sets ${weighted ? "" : "no-weight"}`}>
        <div className="sets-head" aria-hidden="true">
          <span>Set</span>
          {weighted && <span>Weight (lb)</span>}
          <span>{ex.unit === "reps" ? "Reps" : ex.unit === "steps" ? "Steps" : "Time"}</span>
          <span>Done</span>
        </div>
        {ex.sets.map((set, si) => (
          <div className="set-row" key={si}>
            <div className="set-num" aria-hidden="true">{set.setNum}</div>
            {weighted && (
              <input
                className={`set-input ${set.done ? "done" : ""}`} type="number" inputMode="decimal"
                aria-label={`${ex.name} set ${set.setNum} weight in pounds`} placeholder="lb"
                value={set.weight} onChange={(e) => onUpdateSet(index, si, { weight: e.target.value })}
              />
            )}
            <input
              className={`set-input ${set.done ? "done" : ""}`} type="text"
              inputMode={ex.unit === "reps" ? "numeric" : "text"}
              aria-label={`${ex.name} set ${set.setNum} ${ex.unit === "reps" ? "reps" : ex.unit}`} placeholder="reps"
              value={set.reps} onChange={(e) => onUpdateSet(index, si, { reps: e.target.value })}
            />
            <button
              type="button" className="set-check" aria-pressed={set.done}
              aria-label={`${ex.name} set ${set.setNum} done`} onClick={() => onToggleSet(index, si)}
            >
              {set.done ? "✓" : ""}
            </button>
          </div>
        ))}
      </div>

      {weighted && (
        <div className="feel">
          <div className="feel-q" id={`feel-${index}`}>How did the last set feel? Reps left in the tank:</div>
          <div className="chips" role="group" aria-labelledby={`feel-${index}`}>
            {FEELS.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={ex.feel === f.id} onClick={() => onFeel(index, ex.feel === f.id ? null : f.id)}>
                {f.label}<small>{f.sub}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionScreen({
  session, barWeight, equipment, onUpdateSet, onToggleCheck, onFeel, onSwap, onActivity, onComplete, onExit, onDiscard,
}) {
  const [swapIndex, setSwapIndex] = useState(null);
  const [timer, setTimer] = useState(null); // { endsAt, label }
  const [now, setNow] = useState(Date.now());
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [restDone, setRestDone] = useState(false);

  useEffect(() => {
    if (!timer) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timer]);

  const remaining = timer ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (timer && remaining === 0) {
      setTimer(null);
      setRestDone(true);
      navigator.vibrate?.(200);
    }
  }, [timer, remaining]);

  // Consecutive exercises that share a group render inside one dashed box.
  const blocks = useMemo(() => {
    const out = [];
    session.exercises.forEach((ex, index) => {
      const last = out[out.length - 1];
      if (ex.group && last && last.group === ex.group) last.items.push({ ex, index });
      else out.push({ group: ex.group || null, items: [{ ex, index }] });
    });
    return out;
  }, [session.exercises]);

  function toggleSet(exIndex, setIndex) {
    const ex = session.exercises[exIndex];
    const wasDone = ex.sets[setIndex].done;
    onUpdateSet(exIndex, setIndex, { done: !wasDone });
    setRestDone(false);
    if (wasDone) return;
    if (ex.group === "On the minute") return;
    if (ex.group) {
      const block = blocks.find((b) => b.items.some((i) => i.index === exIndex));
      const isLastInGroup = block.items[block.items.length - 1].index === exIndex;
      if (!isLastInGroup) { setTimer(null); return; }
    }
    if (ex.restSec > 0) {
      setNow(Date.now());
      setTimer({ endsAt: Date.now() + ex.restSec * 1000, label: ex.group ? `after the ${ex.group.toLowerCase()} round` : `after ${ex.name}` });
    }
  }

  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const checks = [...session.warmup, ...(session.main || []), ...session.cooldown];
  const total = totalSets + checks.length;
  const done = doneSets + checks.filter((c) => c.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <main className="session-screen" aria-label={`${session.templateName} session`}>
      <header className="session-header">
        <div className="session-header-top">
          <div>
            <h1 className="session-title">{session.templateName}</h1>
            <div className="session-meta">
              {fmtDate(session.date)}{totalSets > 0 ? ` · ${doneSets} of ${totalSets} sets` : ""}
            </div>
          </div>
          <button type="button" className="session-exit-btn" onClick={onExit}>Pause</button>
        </div>
        <div className="progress-bar-bg" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="session-body">
        {session.format && (
          <div className="card">
            <div className="row wrap">
              <span className="tag">{session.format.name}</span>
              {session.short && <span className="tag amber">Short version</span>}
            </div>
            <p className="plan-meta">{session.format.tagline}</p>
            <p className="plan-meta"><span aria-hidden="true">⌚ </span>Tracking on a watch? Start: {watchWorkoutFor(session)}</p>
          </div>
        )}

        {session.warmup.length > 0 && (
          <section className="card" aria-label={session.warmupTitle || "Warm-up"}>
            <h3 className="section-head">{session.warmupTitle || "Warm-up"}</h3>
            <Checklist items={session.warmup} onToggle={(i) => onToggleCheck("warmup", i)} />
            {session.flowNote && <p className="muted" style={{ marginTop: 6 }}>{session.flowNote}</p>}
          </section>
        )}

        {session.main?.length > 0 && (
          <section className="card" aria-label="Main work">
            <h3 className="section-head">Main work</h3>
            <Checklist items={session.main} onToggle={(i) => onToggleCheck("main", i)} />
          </section>
        )}

        {blocks.map((block, bi) =>
          block.group ? (
            <section className="group" key={bi} aria-label={block.group}>
              <h3 className="group-head">{block.group}</h3>
              <p className="group-sub">{groupSubtitle(block.group, block.items)}</p>
              {block.items.map(({ ex, index }) => (
                <ExerciseCard key={`${ex.exerciseId}-${index}`} ex={ex} index={index} grouped barWeight={barWeight}
                  onUpdateSet={onUpdateSet} onToggleSet={toggleSet} onFeel={onFeel} onSwap={setSwapIndex} />
              ))}
            </section>
          ) : (
            block.items.map(({ ex, index }) => (
              <ExerciseCard key={`${ex.exerciseId}-${index}`} ex={ex} index={index} barWeight={barWeight}
                onUpdateSet={onUpdateSet} onToggleSet={toggleSet} onFeel={onFeel} onSwap={setSwapIndex} />
            ))
          )
        )}

        {session.activity && (
          <section className="card" aria-label="Movement">
            <h3 className="section-head">{session.exercises.length || session.main ? "Log it" : "Then move"}</h3>
            <p style={{ fontWeight: 800, marginBottom: 10 }}>
              <span aria-hidden="true">{ACTIVITIES[session.activity.type].emoji} </span>
              {ACTIVITIES[session.activity.type].label}, {session.activity.minutes} min
            </p>
            <ActivityPicker activity={session.activity} activities={ACTIVITIES} onChange={onActivity} />
          </section>
        )}

        {session.optional && <p className="muted" style={{ margin: "0 4px 12px" }}>{session.optional}</p>}

        {session.cooldown.length > 0 && (
          <section className="card" aria-label="Cool-down">
            <h3 className="section-head">Cool-down</h3>
            <Checklist items={session.cooldown} onToggle={(i) => onToggleCheck("cooldown", i)} />
          </section>
        )}

        <div className="row wrap" style={{ justifyContent: "center" }}>
          {!confirmDiscard ? (
            <button type="button" className="btn-link btn-danger" onClick={() => setConfirmDiscard(true)}>Discard this session</button>
          ) : (
            <>
              <span className="muted">Discard without saving?</span>
              <button type="button" className="btn-small" onClick={onDiscard}>Yes, discard</button>
              <button type="button" className="btn-small" onClick={() => setConfirmDiscard(false)}>Keep going</button>
            </>
          )}
        </div>
      </div>

      <footer className="session-footer">
        <div aria-live="polite" className="sr-only">{restDone ? "Rest is over." : ""}</div>
        {timer && (
          <div className="timer">
            <div>
              <div className="timer-time" aria-label={`Rest, ${remaining} seconds left`}>Rest {fmtClock(remaining)}</div>
              <div className="timer-label">{timer.label}</div>
            </div>
            <button type="button" className="btn-small" onClick={() => setTimer(null)}>Skip rest</button>
          </div>
        )}
        <button type="button" className="btn-primary" onClick={onComplete}>Finish and save</button>
      </footer>

      {swapIndex !== null && (
        <SwapModal
          exercise={session.exercises[swapIndex]}
          inSession={new Set(session.exercises.map((e) => e.exerciseId))}
          equipment={equipment}
          onSwap={(newId, always) => { onSwap(swapIndex, newId, always); setSwapIndex(null); }}
          onClose={() => setSwapIndex(null)}
        />
      )}
    </main>
  );
}
