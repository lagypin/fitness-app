import { useState } from "react";
import { EQUIPMENT } from "../engine/program.js";

/** First-run setup and the Settings form are the same four questions. */
export default function SettingsForm({ settings, firstRun = false, onSave }) {
  const [draft, setDraft] = useState(settings);
  const has = (id) => draft.equipment.includes(id);
  const toggleGear = (id) =>
    setDraft({ ...draft, equipment: has(id) ? draft.equipment.filter((e) => e !== id) : [...draft.equipment, id] });

  return (
    <div>
      {firstRun && (
        <div className="card">
          <h2 className="plan-title">Set up your plan</h2>
          <p className="plan-meta">Four quick questions. You can change any of them later on the Week tab.</p>
        </div>
      )}

      <div className="card">
        <h3 className="section-head" id="set-minutes">Minutes per day</h3>
        <div className="chips" role="group" aria-labelledby="set-minutes">
          {[30, 45].map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={draft.minutes === m} onClick={() => setDraft({ ...draft, minutes: m })}>
              {m} minutes
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="section-head" id="set-gear">Equipment you have</h3>
        <p className="muted" style={{ marginBottom: 10 }}>The plan only uses what you select, and swaps in the closest move when something is missing.</p>
        <div className="chips" role="group" aria-labelledby="set-gear">
          {EQUIPMENT.map((e) => (
            <button key={e.id} type="button" className="chip" aria-pressed={has(e.id)} onClick={() => toggleGear(e.id)}>
              {has(e.id) ? "✓ " : ""}{e.label}
            </button>
          ))}
        </div>
      </div>

      {has("barbell") && (
        <div className="card">
          <h3 className="section-head" id="set-bar">Bar weight</h3>
          <div className="chips" role="group" aria-labelledby="set-bar">
            {[35, 45].map((w) => (
              <button key={w} type="button" className="chip" aria-pressed={draft.barWeight === w} onClick={() => setDraft({ ...draft, barWeight: w })}>
                {w} lb
              </button>
            ))}
            <input
              className="minutes-input" type="number" inputMode="numeric" min="5" max="100" aria-label="Bar weight in pounds"
              value={draft.barWeight} onChange={(e) => setDraft({ ...draft, barWeight: Math.max(5, Math.min(100, parseInt(e.target.value, 10) || 45)) })}
            />
            <span className="muted">lb</span>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="section-head" id="set-feet">Foot care add-on</h3>
        <button type="button" className="chip" aria-pressed={draft.footCare} onClick={() => setDraft({ ...draft, footCare: !draft.footCare })}>
          {draft.footCare ? "✓ On" : "Off"}
        </button>
        <p className="muted" style={{ marginTop: 8 }}>
          Adds calf raises, an ankle drill, and two foot stretches to every session. Useful if you manage plantar fasciitis. The Why tab has the research.
        </p>
      </div>

      <button type="button" className="btn-primary" onClick={() => onSave({ ...draft, setupDone: true })}>
        {firstRun ? "Build my plan" : "Save settings"}
      </button>
    </div>
  );
}
