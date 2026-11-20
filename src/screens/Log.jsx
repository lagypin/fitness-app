import { useState } from "react";
import { ACTIVITIES } from "../engine/program.js";
import { fmtDate } from "../ui.jsx";

function summarize(ex) {
  const done = (ex.sets || []).filter((s) => s.done);
  const maxW = done.reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0);
  return `${done.length} ${done.length === 1 ? "set" : "sets"}${maxW > 0 ? ` · ${maxW} lb` : ""}`;
}

/** History only. Back up, Restore, and Export CSV live under More. */
export default function LogScreen({ sessions, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);

  return (
    <>
      {!sessions.length && <div className="empty">Nothing logged yet. Finish a session and it will show up here.</div>}

      {[...sessions].reverse().map((s) => (
        <div key={s.id} className="card">
          <div className="row spread" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="log-date">{fmtDate(s.date)}</div>
              <div className="log-template">
                <span aria-hidden="true">{s.emoji || ACTIVITIES[s.activity?.type]?.emoji || "🏋️"} </span>
                {s.templateName}
                {s.format?.name && s.kind === "lift" ? ` · ${s.format.name}` : ""}
                {s.activity?.minutes ? ` · ${s.activity.minutes} min${s.activity.hard ? ", hard" : ""}` : ""}
              </div>
            </div>
            {confirmId === s.id ? (
              <div className="row">
                <button type="button" className="btn-small" onClick={() => { onDelete(s.id); setConfirmId(null); }}>Delete</button>
                <button type="button" className="btn-small" onClick={() => setConfirmId(null)}>Keep</button>
              </div>
            ) : (
              <button type="button" className="btn-small" onClick={() => setConfirmId(s.id)}>Remove<span className="sr-only"> {s.templateName} on {fmtDate(s.date)}</span></button>
            )}
          </div>
          {s.exercises?.length > 0 && (
            <div className="log-exercises">
              {s.exercises.map((ex, i) => (
                <div key={i} className="log-ex-row">
                  <span className="log-ex-name">{ex.name}</span>
                  <span className="log-ex-sets">{summarize(ex)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
