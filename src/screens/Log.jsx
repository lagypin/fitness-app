import { useRef, useState } from "react";
import { ACTIVITIES } from "../engine/program.js";
import { fmtDate } from "../ui.jsx";
import { isPreview } from "../platform.js";

function summarize(ex) {
  const done = (ex.sets || []).filter((s) => s.done);
  const maxW = done.reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0);
  return `${done.length} ${done.length === 1 ? "set" : "sets"}${maxW > 0 ? ` · ${maxW} lb` : ""}`;
}

export default function LogScreen({ sessions, extras, onReplace, onDelete }) {
  const fileInput = useRef(null);
  const [pending, setPending] = useState(null);   // sessions read from a backup file, awaiting a choice
  const [message, setMessage] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  async function exportBackup() {
    const payload = { app: "move", version: 2, exportedAt: new Date().toISOString(), sessions, ...extras };
    const json = JSON.stringify(payload, null, 2);
    const filename = `move-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], filename, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Move backup" }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage("Backup saved to your downloads.");
  }

  async function readFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.sessions;
      if (!Array.isArray(incoming)) throw new Error("that file is not a Move backup");
      setPending(incoming);
      setMessage("");
    } catch (err) {
      setMessage(`Couldn't read the file: ${err.message}.`);
    }
  }

  function finishImport(mode) {
    if (mode === "replace") onReplace(pending);
    if (mode === "merge") {
      const ids = new Set(sessions.map((s) => s.id));
      onReplace([...sessions, ...pending.filter((s) => !ids.has(s.id))].sort((a, b) => new Date(a.date) - new Date(b.date)));
    }
    if (mode !== "cancel") setMessage(`Imported ${pending.length} entries.`);
    setPending(null);
  }

  return (
    <>
      {isPreview() ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          This is a preview. What you log here stays in this browser, and backups are switched off.
        </p>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <button type="button" className="btn-secondary" onClick={exportBackup} disabled={!sessions.length}>Back up</button>
            <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>Restore</button>
            <input ref={fileInput} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={readFile} aria-label="Backup file" />
          </div>
          <p className="muted" style={{ marginBottom: 12 }}>Your history lives only on this device. Back it up now and then.</p>
        </>
      )}

      {pending && (
        <div className="card" role="alertdialog" aria-label="Import backup">
          <p style={{ fontWeight: 800 }}>Import {pending.length} entries?</p>
          <div className="stack" style={{ marginTop: 10 }}>
            <button type="button" className="btn-secondary" onClick={() => finishImport("merge")}>Merge with what's here</button>
            <button type="button" className="btn-secondary" onClick={() => finishImport("replace")}>Replace everything here</button>
            <button type="button" className="btn-secondary" onClick={() => finishImport("cancel")}>Cancel</button>
          </div>
        </div>
      )}
      {message && <p className="status" role="status">{message}</p>}

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
