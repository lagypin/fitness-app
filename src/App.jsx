import { useState, useMemo } from "react";
import { EXERCISES, SESSION_TEMPLATES, swapOptions } from "./exercises.js";

// ─── Storage ──────────────────────────────────────────────────────────────────
const LS = {
  get: (k, fb = null) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const uid = () => Math.random().toString(36).slice(2, 9);

// ─── Warm-up / cool-down ──────────────────────────────────────────────────────
const WARMUPS = {
  session_a: [
    "Cat-cow — 10 reps",
    "Ankle circles — 10 each direction",
    "Banded ankle dorsiflexion — 12 each side",
    "Goblet squat (light KB) — 10 reps",
    "Diagonal hip sinks — 10 each side  (Joe's PT)",
    "Knee extensions — 15 reps  (Joe's PT)",
  ],
  session_b: [
    "Cat-cow — 10 reps",
    "Down dog — 60 sec, pedal heels",
    "Diagonal hip sinks — 10 each side  (Joe's PT)",
    "Midfoot mobilization — 10 each side  (Joe's PT)",
    "Yielding hip exercises — 10 each side  (Joe's PT)",
    "Calf raises on step — 2×15 slow",
  ],
  session_c: [
    "Cat-cow — 10 reps",
    "Arm circles — 30 sec each direction",
    "Band pull-aparts — 20 reps",
    "Knee extensions — 15 reps  (Joe's PT)",
    "Yielding hip exercises — 10 each side  (Joe's PT)",
  ],
  session_d: [
    "Cat-cow — 10 reps",
    "Dead hang — 2×20 sec",
    "Band pull-aparts — 20 reps",
    "Diagonal hip sinks — 10 each side  (Joe's PT)",
    "Midfoot mobilization — 10 each side  (Joe's PT)",
  ],
};

const COOLDOWN = [
  "Pigeon pose — 90 sec each side",
  "Supine twist — 60 sec each side",
  "Child's pose — 60 sec",
  "Plantar fascia stretch — 60 sec each foot",
  "Calf stretch — 30 sec each side",
];

// ─── Session builder ──────────────────────────────────────────────────────────
function buildSession(templateId, prevExercises = []) {
  const template = SESSION_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;
  const prevIds = prevExercises.map(e => e.exerciseId);

  const exercises = template.slots.map(slot => {
    const pool = EXERCISES.filter(e =>
      e.category === slot.category && e.isAnchor === slot.isAnchor
    );
    const fresh = pool.filter(e => !prevIds.includes(e.id));
    const pick = (fresh.length > 0 ? fresh : pool)[Math.floor(Math.random() * (fresh.length > 0 ? fresh.length : pool.length))];
    return {
      exerciseId: pick.id,
      name: pick.name,
      category: pick.category,
      isAnchor: pick.isAnchor,
      notes: pick.notes,
      sets: Array.from({ length: pick.defaultSets }, (_, i) => ({
        setNum: i + 1,
        weight: "",
        reps: pick.defaultReps,
        done: false,
      })),
    };
  });

  return {
    id: uid(),
    templateId,
    templateName: template.name,
    anchorCategory: template.anchorCategory,
    date: new Date().toISOString(),
    exercises,
    warmup: WARMUPS[templateId] || WARMUPS.session_a,
    cooldown: COOLDOWN,
    completed: false,
  };
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #fff0f3; --surface: #fff; --surface2: #fce8ed;
  --border: #f5ccd6; --border2: #f0afc0;
  --hot: #ff2d78; --hot-dark: #e0005f; --hot-dim: #ff80aa; --hot-pale: #ffe0ea;
  --blush: #f7a8bf; --blush-dim: #e8849f;
  --text: #2d1a22; --text-mid: #7a4d5e; --text-dim: #c4899e;
  --green: #2ecc71; --green-bg: #edfdf4; --green-border: #a3e6c0;
  --font: 'Plus Jakarta Sans', sans-serif; --radius: 16px;
}
body { background: var(--bg); color: var(--text); font-family: var(--font); min-height: 100dvh; }
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
input[type=number] { -moz-appearance: textfield; }

.app { width: 100%; max-width: 480px; margin: 0 auto; min-height: 100dvh; display: flex; flex-direction: column; }

/* ── Header ── */
.header { background: var(--hot); padding: 22px 22px 16px; position: relative; overflow: hidden; }
.header::before { content: ''; position: absolute; top: -40px; right: -40px; width: 160px; height: 160px; border-radius: 50%; background: rgba(255,255,255,0.08); }
.header-top { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
.app-title { font-size: 26px; font-weight: 800; color: #fff; letter-spacing: -0.02em; line-height: 1.1; }
.app-sub { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 3px; }
.streak-badge { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); border-radius: 12px; padding: 8px 12px; text-align: center; flex-shrink: 0; }
.streak-num { font-size: 22px; font-weight: 800; color: #fff; line-height: 1; }
.streak-label { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.65); margin-top: 2px; }

/* ── Nav ── */
.nav { display: flex; background: var(--hot); padding: 0 16px 14px; gap: 5px; }
.nav-btn { flex: 1; padding: 8px 4px; background: rgba(255,255,255,0.13); border: 1.5px solid rgba(255,255,255,0.18); border-radius: 8px; color: rgba(255,255,255,0.65); font-size: 11px; font-weight: 700; font-family: var(--font); cursor: pointer; transition: all 0.15s; position: relative; }
.nav-btn:hover { background: rgba(255,255,255,0.22); color: #fff; }
.nav-btn.active { background: #fff; border-color: #fff; color: var(--hot); }
.active-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #fff; margin-left: 4px; vertical-align: middle; }
.nav-btn.active .active-dot { background: var(--hot); }

/* ── Scroll area ── */
.scroll { flex: 1; overflow-y: auto; padding: 16px 16px 100px; -webkit-overflow-scrolling: touch; }

/* ── Typography ── */
.label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px; margin-top: 20px; }
.label:first-child { margin-top: 0; }

/* ── Session grid ── */
.session-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.session-btn { padding: 14px 12px; border-radius: var(--radius); border: 1.5px solid var(--border); background: var(--surface); color: var(--text-mid); font-family: var(--font); cursor: pointer; text-align: left; transition: all 0.12s; }
.session-btn:hover { border-color: var(--blush); }
.session-btn.active { background: var(--hot-pale); border-color: var(--hot); color: var(--hot); }
.sb-emoji { font-size: 20px; display: block; margin-bottom: 6px; }
.sb-name { font-size: 13px; font-weight: 700; display: block; }
.sb-anchor { font-size: 10px; color: var(--text-dim); display: block; margin-top: 2px; line-height: 1.4; }
.session-btn.active .sb-anchor { color: var(--hot-dim); }

/* ── Buttons ── */
.btn-primary { width: 100%; margin-top: 14px; padding: 15px; border-radius: var(--radius); border: none; background: var(--hot); color: #fff; font-size: 14px; font-weight: 700; font-family: var(--font); cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 20px rgba(255,45,120,0.35); }
.btn-primary:hover { background: var(--hot-dark); transform: translateY(-1px); box-shadow: 0 6px 24px rgba(255,45,120,0.45); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* ── Active session banner ── */
.active-banner { background: var(--hot-pale); border: 1.5px solid var(--hot); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.active-banner-text { font-size: 13px; font-weight: 700; color: var(--hot); }
.active-banner-sub { font-size: 11px; color: var(--blush-dim); margin-top: 2px; }
.active-banner-arrow { font-size: 18px; color: var(--hot); }

/* ── Session screen (full screen) ── */
.session-screen { position: fixed; inset: 0; background: var(--bg); z-index: 100; display: flex; flex-direction: column; max-width: 480px; left: 50%; transform: translateX(-50%); }
.session-header { background: var(--hot); padding: 20px 18px 14px; position: sticky; top: 0; z-index: 10; flex-shrink: 0; }
.session-header-top { display: flex; justify-content: space-between; align-items: flex-start; }
.session-title { font-size: 18px; font-weight: 800; color: #fff; }
.session-meta { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 3px; }
.session-exit-btn { background: rgba(255,255,255,0.2); border: none; border-radius: 8px; color: #fff; font-size: 12px; font-weight: 700; font-family: var(--font); cursor: pointer; padding: 8px 12px; flex-shrink: 0; margin-left: 10px; }
.progress-bar-bg { margin-top: 10px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; }
.progress-bar-fill { height: 100%; background: #fff; border-radius: 2px; transition: width 0.3s ease; }
.session-body { flex: 1; overflow-y: auto; padding: 14px 14px 100px; -webkit-overflow-scrolling: touch; }
.session-footer { position: sticky; bottom: 0; padding: 10px 14px 14px; background: var(--bg); border-top: 1.5px solid var(--border); flex-shrink: 0; }

/* ── Section cards (warmup/cooldown) ── */
.section-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 10px; }
.section-head { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--hot); margin-bottom: 8px; }
.section-item { font-size: 13px; color: var(--text-mid); padding-left: 12px; position: relative; margin-bottom: 5px; line-height: 1.5; }
.section-item::before { content: "–"; position: absolute; left: 0; color: var(--blush); }

/* ── Exercise card ── */
.ex-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 10px; transition: border-color 0.2s, background 0.2s; }
.ex-card.all-done { border-color: var(--green-border); background: var(--green-bg); }
.ex-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
.ex-name { font-size: 15px; font-weight: 800; color: var(--text); line-height: 1.2; }
.anchor-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--hot); background: var(--hot-pale); border-radius: 6px; padding: 3px 7px; margin-top: 4px; display: inline-block; }
.ex-notes { font-size: 12px; color: var(--text-dim); margin: 8px 0 12px; line-height: 1.5; }
.swap-btn { background: var(--surface2); border: 1px solid var(--border2); border-radius: 8px; color: var(--text-mid); font-size: 11px; font-weight: 700; font-family: var(--font); cursor: pointer; padding: 6px 10px; white-space: nowrap; flex-shrink: 0; transition: all 0.12s; }
.swap-btn:hover { border-color: var(--hot); color: var(--hot); background: var(--hot-pale); }

/* ── Set rows ── */
.sets-head { display: grid; grid-template-columns: 28px 1fr 1fr 36px; gap: 5px; padding: 0 2px; margin-bottom: 5px; }
.sets-head span { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); text-align: center; }
.sets-head span:first-child { text-align: left; }
.set-row { display: grid; grid-template-columns: 28px 1fr 1fr 36px; gap: 5px; align-items: center; margin-bottom: 5px; }
.set-num { font-size: 12px; font-weight: 700; color: var(--text-dim); text-align: center; }
.set-input { border: 1.5px solid var(--border); border-radius: 8px; padding: 9px 6px; font-size: 14px; font-family: var(--font); font-weight: 600; color: var(--text); background: var(--bg); text-align: center; width: 100%; transition: all 0.12s; }
.set-input:focus { outline: none; border-color: var(--hot); background: #fff; }
.set-input.done { background: var(--green-bg); border-color: var(--green-border); color: #1a7a4a; }
.set-check { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid var(--border); background: transparent; color: var(--text-dim); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
.set-check.done { background: var(--green); border-color: var(--green); color: #fff; }
.set-check:hover:not(.done) { border-color: var(--hot); color: var(--hot); }

/* ── Swap modal ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(45,26,34,0.55); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
.modal-sheet { background: var(--surface); border-radius: 20px 20px 0 0; width: 100%; max-width: 480px; padding: 20px 16px 44px; max-height: 75vh; overflow-y: auto; }
.modal-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.modal-title { font-size: 16px; font-weight: 800; color: var(--text); }
.modal-sub { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
.modal-close { background: var(--surface2); border: none; border-radius: 8px; padding: 7px 12px; font-size: 12px; font-weight: 700; font-family: var(--font); color: var(--text-mid); cursor: pointer; flex-shrink: 0; }
.swap-option { padding: 12px 14px; border-radius: 12px; border: 1.5px solid var(--border); margin-bottom: 8px; background: var(--surface); cursor: pointer; transition: all 0.12s; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.swap-option:hover { border-color: var(--hot); background: var(--hot-pale); }
.swap-name { font-size: 14px; font-weight: 700; color: var(--text); }
.swap-notes { font-size: 11px; color: var(--text-dim); margin-top: 2px; line-height: 1.4; }
.swap-anchor-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--hot); background: var(--hot-pale); border-radius: 6px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0; }

/* ── Library ── */
.search-input { width: 100%; border: 1.5px solid var(--border); border-radius: 10px; padding: 11px 14px; font-size: 14px; font-family: var(--font); background: var(--surface); color: var(--text); margin-bottom: 10px; }
.search-input:focus { outline: none; border-color: var(--hot); }
.cat-filter { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 10px; scrollbar-width: none; }
.cat-filter::-webkit-scrollbar { display: none; }
.cat-pill { padding: 6px 12px; border-radius: 20px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-dim); font-size: 11px; font-weight: 700; font-family: var(--font); cursor: pointer; white-space: nowrap; transition: all 0.12s; }
.cat-pill.active { background: var(--hot); border-color: var(--hot); color: #fff; }
.ex-count { font-size: 11px; color: var(--text-dim); margin-bottom: 10px; }
.lib-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 13px 14px; margin-bottom: 8px; }
.lib-name { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.lib-meta { font-size: 11px; color: var(--text-dim); display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.lib-notes { font-size: 12px; color: var(--text-mid); margin-top: 7px; line-height: 1.5; }
.cat-badge { display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 5px; }
.cat-badge.squat    { background: #fef3c7; color: #92400e; }
.cat-badge.hinge    { background: #ffe4e6; color: #9f1239; }
.cat-badge.press    { background: #e0e7ff; color: #3730a3; }
.cat-badge.pull     { background: #d1fae5; color: #065f46; }
.cat-badge.core     { background: #fee2e2; color: #991b1b; }
.cat-badge.mobility { background: #f3e8ff; color: #6b21a8; }
.anchor-star { color: var(--hot); margin-right: 3px; }

/* ── Log ── */
.log-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 10px; }
.log-top { display: flex; justify-content: space-between; align-items: flex-start; }
.log-date { font-size: 14px; font-weight: 700; color: var(--text); }
.log-template { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
.log-check { font-size: 18px; color: var(--green); }
.log-exercises { margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.log-ex-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; }
.log-ex-name { color: var(--text-mid); font-weight: 500; }
.log-ex-sets { color: var(--text-dim); font-size: 11px; }

/* ── Empty state ── */
.empty { text-align: center; padding: 60px 20px; }
.empty-icon { font-size: 40px; margin-bottom: 14px; opacity: 0.4; }
.empty-text { font-size: 14px; color: var(--text-dim); line-height: 1.7; font-weight: 500; }

@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.fade-up { animation: fadeUp 0.25s ease; }
`;

// ─── Session definitions (for UI display) ────────────────────────────────────
const SESSION_DEFS = [
  { id: "session_a", emoji: "🏋️", name: "Squat",  anchor: "Back squat · front squat" },
  { id: "session_b", emoji: "☠️",  name: "Hinge",  anchor: "Conventional · sumo deadlift" },
  { id: "session_c", emoji: "💪",  name: "Press",  anchor: "Bench press · overhead press" },
  { id: "session_d", emoji: "🧗",  name: "Pull",   anchor: "Barbell row · ring rows" },
  { id: "yoga",      emoji: "🌸",  name: "Yoga",              anchor: "Movement & recovery" },
  { id: "sprints",   emoji: "🚣",  name: "Row Sprints",       anchor: "30s on / 2 min off × 8–10" },
];

// ─── SwapModal ────────────────────────────────────────────────────────────────
function SwapModal({ exerciseIndex, session, onSwap, onClose }) {
  const current = session.exercises[exerciseIndex];
  const options = swapOptions(current.exerciseId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <div className="modal-title">Swap exercise</div>
            <div className="modal-sub">Replacing: {current.name}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {options.length === 0 && (
          <div className="empty-text">No alternatives in this category.</div>
        )}
        {options.map(ex => (
          <div key={ex.id} className="swap-option" onClick={() => onSwap(exerciseIndex, ex)}>
            <div>
              <div className="swap-name">{ex.name}</div>
              <div className="swap-notes">
                {ex.notes?.length > 80 ? ex.notes.slice(0, 80) + "…" : ex.notes}
              </div>
            </div>
            {ex.isAnchor && <div className="swap-anchor-badge">Main lift</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SetRow ───────────────────────────────────────────────────────────────────
function SetRow({ set, onUpdate, onToggle }) {
  return (
    <div className="set-row">
      <div className="set-num">{set.setNum}</div>
      <input
        className={`set-input ${set.done ? "done" : ""}`}
        type="number"
        inputMode="decimal"
        placeholder="lbs"
        value={set.weight}
        onChange={e => onUpdate({ weight: e.target.value })}
      />
      <input
        className={`set-input ${set.done ? "done" : ""}`}
        type="text"
        inputMode="text"
        placeholder={set.reps || "reps"}
        value={set.reps}
        onChange={e => onUpdate({ reps: e.target.value })}
      />
      <button
        className={`set-check ${set.done ? "done" : ""}`}
        onClick={onToggle}
      >
        {set.done ? "✓" : "·"}
      </button>
    </div>
  );
}

// ─── ExerciseBlock ────────────────────────────────────────────────────────────
function ExerciseBlock({ exercise, exerciseIndex, onUpdateSet, onSwap }) {
  const allDone = exercise.sets.length > 0 && exercise.sets.every(s => s.done);
  return (
    <div className={`ex-card fade-up ${allDone ? "all-done" : ""}`}>
      <div className="ex-header">
        <div style={{ flex: 1 }}>
          <div className="ex-name">{exercise.name}</div>
          {exercise.isAnchor && <span className="anchor-badge">Main lift</span>}
        </div>
        <button className="swap-btn" onClick={() => onSwap(exerciseIndex)}>
          ↔ Swap
        </button>
      </div>
      {exercise.notes && <div className="ex-notes">{exercise.notes}</div>}
      <div className="sets-head">
        <span>Set</span>
        <span>Weight</span>
        <span>Reps</span>
        <span></span>
      </div>
      {exercise.sets.map((set, si) => (
        <SetRow
          key={si}
          set={set}
          onUpdate={updates => onUpdateSet(exerciseIndex, si, updates)}
          onToggle={() => onUpdateSet(exerciseIndex, si, { done: !set.done })}
        />
      ))}
    </div>
  );
}

// ─── SessionScreen ────────────────────────────────────────────────────────────
function SessionScreen({ session, onUpdateSet, onSwap, onComplete, onExit }) {
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets  = session.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  return (
    <div className="session-screen">
      <div className="session-header">
        <div className="session-header-top">
          <div style={{ flex: 1 }}>
            <div className="session-title">{session.templateName}</div>
            <div className="session-meta">
              {new Date(session.date).toLocaleDateString("en-US", {
                weekday: "long", month: "short", day: "numeric",
              })}
              {totalSets > 0 && ` · ${doneSets}/${totalSets} sets`}
            </div>
          </div>
          <button className="session-exit-btn" onClick={onExit}>Exit</button>
        </div>
        {totalSets > 0 && (
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="session-body">
        <div className="section-card">
          <div className="section-head">Warm-Up</div>
          {session.warmup.map((item, i) => (
            <div key={i} className="section-item">{item}</div>
          ))}
        </div>

        {session.exercises.map((ex, i) => (
          <ExerciseBlock
            key={`${ex.exerciseId}-${i}`}
            exercise={ex}
            exerciseIndex={i}
            onUpdateSet={onUpdateSet}
            onSwap={onSwap}
          />
        ))}

        <div className="section-card">
          <div className="section-head">Cool-Down</div>
          {session.cooldown.map((item, i) => (
            <div key={i} className="section-item">{item}</div>
          ))}
        </div>
      </div>

      <div className="session-footer">
        <button className="btn-primary" onClick={onComplete}>
          Complete Session ✓
        </button>
      </div>
    </div>
  );
}

// ─── TodayScreen ──────────────────────────────────────────────────────────────
function TodayScreen({ onStart, activeSession, onResume }) {
  const [selected, setSelected] = useState("session_a");

  return (
    <>
      {activeSession && (
        <div className="active-banner" onClick={onResume}>
          <div>
            <div className="active-banner-text">Session in progress</div>
            <div className="active-banner-sub">{activeSession.templateName} — tap to return</div>
          </div>
          <div className="active-banner-arrow">→</div>
        </div>
      )}

      <div className="label">Choose your session</div>
      <div className="session-grid">
        {SESSION_DEFS.map(s => (
          <button
            key={s.id}
            className={`session-btn ${selected === s.id ? "active" : ""}`}
            onClick={() => setSelected(s.id)}
          >
            <span className="sb-emoji">{s.emoji}</span>
            <span className="sb-name">{s.name}</span>
            <span className="sb-anchor">{s.anchor}</span>
          </button>
        ))}
      </div>

      <button
        className="btn-primary"
        onClick={() => onStart(selected)}
        disabled={!selected}
      >
        {activeSession ? "Start New Session →" : "Build & Start Session →"}
      </button>
    </>
  );
}

// ─── LibraryScreen ────────────────────────────────────────────────────────────
function LibraryScreen() {
  const [query, setQuery]       = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const cats = ["all", "squat", "hinge", "press", "pull", "core", "mobility"];

  const filtered = useMemo(() =>
    EXERCISES.filter(e => {
      const matchCat = catFilter === "all" || e.category === catFilter;
      const matchQ   = !query || e.name.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQ;
    }),
    [query, catFilter]
  );

  return (
    <>
      <input
        className="search-input"
        placeholder="Search exercises…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="cat-filter">
        {cats.map(c => (
          <button
            key={c}
            className={`cat-pill ${catFilter === c ? "active" : ""}`}
            onClick={() => setCatFilter(c)}
          >
            {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      <div className="ex-count">{filtered.length} exercises</div>
      {filtered.map(ex => (
        <div key={ex.id} className="lib-card">
          <div className="lib-name">
            {ex.isAnchor && <span className="anchor-star">★</span>}
            {ex.name}
          </div>
          <div className="lib-meta">
            <span className={`cat-badge ${ex.category}`}>{ex.category}</span>
            <span>{ex.equipment.join(", ")}</span>
            <span>·</span>
            <span>{ex.defaultSets}×{ex.defaultReps}</span>
          </div>
          {ex.notes && <div className="lib-notes">{ex.notes}</div>}
        </div>
      ))}
    </>
  );
}

// ─── LogScreen ────────────────────────────────────────────────────────────────
function LogScreen({ sessions }) {
  if (!sessions.length) {
    return (
      <div className="empty">
        <div className="empty-icon">📋</div>
        <div className="empty-text">
          No sessions yet.<br />Complete a workout to start your log.
        </div>
      </div>
    );
  }

  return (
    <>
      {[...sessions].reverse().map(sess => {
        const def = SESSION_DEFS.find(d => d.id === sess.templateId);
        return (
          <div key={sess.id} className="log-card">
            <div className="log-top">
              <div>
                <div className="log-date">
                  {new Date(sess.date).toLocaleDateString("en-US", {
                    weekday: "long", month: "short", day: "numeric",
                  })}
                </div>
                <div className="log-template">
                  {def?.emoji} {sess.templateName}
                </div>
              </div>
              <div className="log-check">✓</div>
            </div>

            {sess.exercises?.length > 0 && (
              <div className="log-exercises">
                {sess.exercises.map((ex, i) => {
                  const done = ex.sets.filter(s => s.done);
                  const maxW = done.reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0);
                  return (
                    <div key={i} className="log-ex-row">
                      <span className="log-ex-name">{ex.name}</span>
                      <span className="log-ex-sets">
                        {done.length} sets{maxW > 0 ? ` · ${maxW} lbs` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,           setTab]           = useState("today");
  const [activeSession, setActiveSession] = useState(() => LS.get("wapp_active", null));
  const [sessions,      setSessions]      = useState(() => LS.get("wapp_sessions", []));
  const [swapTarget,    setSwapTarget]    = useState(null);
  const [showSession,   setShowSession]   = useState(false);

  const streakCount = useMemo(() => {
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (sessions.some(s => new Date(s.date).toDateString() === d.toDateString())) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, [sessions]);

  // ── Session management ──
  function handleStart(templateId) {
    let sess;
    if (["yoga", "sprints"].includes(templateId)) {
      sess = {
        id: uid(),
        templateId,
        templateName: templateId === "yoga" ? "Yoga" : "Row Sprints",
        date: new Date().toISOString(),
        exercises: [],
        warmup: templateId === "yoga"
          ? ["Arrive on your mat — no rush", "Set a timer for however long feels right"]
          : ["Easy row 5 min — settle in"],
        cooldown: templateId === "yoga"
          ? ["Savasana — stay as long as you like"]
          : [
              "Easy row 5 min — cool down",
              "Pigeon pose — 90 sec each side",
              "Child's pose — 60 sec",
            ],
        completed: false,
      };
    } else {
      const lastOfType = [...sessions].reverse().find(s => s.templateId === templateId);
      sess = buildSession(templateId, lastOfType?.exercises || []);
    }
    setActiveSession(sess);
    LS.set("wapp_active", sess);
    setShowSession(true);
  }

  function handleUpdateSet(exIdx, setIdx, updates) {
    setActiveSession(prev => {
      const next = {
        ...prev,
        exercises: prev.exercises.map((ex, ei) => {
          if (ei !== exIdx) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s, si) => si === setIdx ? { ...s, ...updates } : s),
          };
        }),
      };
      LS.set("wapp_active", next);
      return next;
    });
  }

  function handleSwap(exIdx, newEx) {
    setActiveSession(prev => {
      const next = {
        ...prev,
        exercises: prev.exercises.map((ex, ei) => {
          if (ei !== exIdx) return ex;
          return {
            exerciseId: newEx.id,
            name: newEx.name,
            category: newEx.category,
            isAnchor: newEx.isAnchor,
            notes: newEx.notes,
            sets: Array.from({ length: newEx.defaultSets }, (_, i) => ({
              setNum: i + 1,
              weight: "",
              reps: newEx.defaultReps,
              done: false,
            })),
          };
        }),
      };
      LS.set("wapp_active", next);
      return next;
    });
    setSwapTarget(null);
  }

  function handleComplete() {
    const completed = { ...activeSession, completed: true };
    const next = [...sessions, completed];
    setSessions(next);
    LS.set("wapp_sessions", next);
    LS.set("wapp_active", null);
    setActiveSession(null);
    setShowSession(false);
    setTab("log");
  }

  function handleExit() {
    // Keep active session in storage — they can resume
    setShowSession(false);
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* ── Session full-screen overlay ── */}
        {showSession && activeSession && (
          <SessionScreen
            session={activeSession}
            onUpdateSet={handleUpdateSet}
            onSwap={idx => setSwapTarget(idx)}
            onComplete={handleComplete}
            onExit={handleExit}
          />
        )}

        {/* ── Swap modal ── */}
        {swapTarget !== null && activeSession && (
          <SwapModal
            exerciseIndex={swapTarget}
            session={activeSession}
            onSwap={handleSwap}
            onClose={() => setSwapTarget(null)}
          />
        )}

        {/* ── Header ── */}
        <div className="header">
          <div className="header-top">
            <div>
              <div className="app-title">Let's move, Lindsay.</div>
              <div className="app-sub">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                })}
              </div>
            </div>
            <div className="streak-badge">
              <div className="streak-num">{streakCount}</div>
              <div className="streak-label">day streak</div>
            </div>
          </div>
        </div>

        {/* ── Nav ── */}
        <div className="nav">
          {[
            ["today",   "Today"],
            ["library", "Library"],
            ["log",     "Log"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`nav-btn ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
              {id === "today" && activeSession && (
                <span className="active-dot" />
              )}
            </button>
          ))}
        </div>

        {/* ── Screen content ── */}
        <div className="scroll">
          {tab === "today" && (
            <TodayScreen
              onStart={handleStart}
              activeSession={activeSession}
              onResume={() => setShowSession(true)}
            />
          )}
          {tab === "library" && <LibraryScreen />}
          {tab === "log"     && <LogScreen sessions={sessions} />}
        </div>

      </div>
    </>
  );
}
