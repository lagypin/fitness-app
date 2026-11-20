import { useRef, useState } from "react";
import { exportCsvs } from "../engine/export.js";
import { isPreview } from "../platform.js";

/** Back up, Restore, and Export CSV. Backups from version 2.1 (`version: 2`) restore as before. */
export default function YourData({ sessions, extras, onReplace }) {
  const fileInput = useRef(null);
  const [pending, setPending] = useState(null);   // sessions read from a backup file, awaiting a choice
  const [message, setMessage] = useState("");

  async function exportBackup() {
    const payload = { app: "move", version: 2, exportedAt: new Date().toISOString(), sessions, ...extras };
    const json = JSON.stringify(payload, null, 2);
    const filename = `move-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], filename, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Move backup" }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    download(json, filename, "application/json");
    setMessage("Backup saved to your downloads.");
  }

  function download(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Two CSV files, Sessions and Sets (see the data dictionary in README.md). Shared together where the share sheet allows, otherwise both download. */
  async function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    const { sessions: sessionsCsv, sets: setsCsv } = exportCsvs(sessions);
    const files = [
      new File([sessionsCsv], `move-sessions-${stamp}.csv`, { type: "text/csv" }),
      new File([setsCsv], `move-sets-${stamp}.csv`, { type: "text/csv" }),
    ];
    if (navigator.canShare?.({ files })) {
      try { await navigator.share({ files, title: "Move log" }); setMessage("Sessions and Sets exported."); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    download(sessionsCsv, files[0].name, "text/csv");
    download(setsCsv, files[1].name, "text/csv");
    setMessage("Two files saved to your downloads: Sessions and Sets.");
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

  if (isPreview()) {
    return <p className="muted">This is a preview. What you log here stays in this browser, and backups are switched off.</p>;
  }

  return (
    <>
      <p className="muted" style={{ marginBottom: 10 }}>Your history lives only on this device. Back it up now and then.</p>
      <div className="row wrap">
        <button type="button" className="btn-secondary" style={{ width: "auto", flex: 1 }} onClick={exportBackup} disabled={!sessions.length}>Back up</button>
        <button type="button" className="btn-secondary" style={{ width: "auto", flex: 1 }} onClick={() => fileInput.current?.click()}>Restore</button>
        <button type="button" className="btn-secondary" style={{ width: "auto", flex: 1 }} onClick={exportCsv} disabled={!sessions.length}>Export CSV</button>
        <input ref={fileInput} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={readFile} aria-label="Backup file" />
      </div>

      {pending && (
        <div className="card" role="alertdialog" aria-label="Import backup" style={{ marginTop: 12, marginBottom: 0 }}>
          <p style={{ fontWeight: 800 }}>Import {pending.length} entries?</p>
          <div className="stack" style={{ marginTop: 10 }}>
            <button type="button" className="btn-secondary" onClick={() => finishImport("merge")}>Merge with what's here</button>
            <button type="button" className="btn-secondary" onClick={() => finishImport("replace")}>Replace everything here</button>
            <button type="button" className="btn-secondary" onClick={() => finishImport("cancel")}>Cancel</button>
          </div>
        </div>
      )}
      {message && <p className="status" role="status">{message}</p>}
    </>
  );
}
