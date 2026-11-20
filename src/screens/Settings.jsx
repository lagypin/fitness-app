import { useState } from "react";
import { EQUIPMENT } from "../engine/program.js";

/** First-run setup and the Settings form are the same questions: minutes, equipment, bar weight, outdoor options. */
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
          <p className="plan-meta">A few quick questions. You can change any of them later under More.</p>
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
        <h3 className="section-head" id="set-outdoor">Outdoor options</h3>
        <p className="muted" style={{ marginBottom: 10 }}>Walks are always in the plan. Switch these on to have the app suggest them too.</p>
        <div className="chips" role="group" aria-labelledby="set-outdoor">
          <button type="button" className="chip" aria-pressed={!!draft.hikes} onClick={() => setDraft({ ...draft, hikes: !draft.hikes })}>
            {draft.hikes ? "✓ " : ""}Hikes
          </button>
          <button type="button" className="chip" aria-pressed={!!draft.swims} onClick={() => setDraft({ ...draft, swims: !draft.swims })}>
            {draft.swims ? "✓ " : ""}Summer swims
          </button>
        </div>
      </div>

      <button type="button" className="btn-primary" onClick={() => onSave({ ...draft, setupDone: true })}>
        {firstRun ? "Build my plan" : "Save settings"}
      </button>
    </div>
  );
}
