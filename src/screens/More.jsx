import { useState } from "react";
import { byId } from "../exercises.js";
import { StatusLine } from "../ui.jsx";
import SettingsForm from "./Settings.jsx";
import LibraryScreen from "./Library.jsx";
import YourData from "./YourData.jsx";

// The app version comes from package.json at build time (see vite.config.js).
const VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

export default function MoreScreen({
  sessions, extras, onReplaceSessions, settings, onSaveSettings, swaps, onRemoveSwap, status,
}) {
  const [view, setView] = useState("menu"); // menu | settings | library
  const swapList = Object.entries(swaps).filter(([from, to]) => byId(from) && byId(to));

  if (view === "settings") {
    return (
      <>
        <button type="button" className="btn-link" onClick={() => setView("menu")}>Back to More</button>
        <SettingsForm settings={settings} onSave={(s) => { onSaveSettings(s); setView("menu"); }} />
      </>
    );
  }

  if (view === "library") {
    return (
      <>
        <button type="button" className="btn-link" onClick={() => setView("menu")}>Back to More</button>
        <LibraryScreen />
      </>
    );
  }

  return (
    <>
      <StatusLine status={status} />

      <h2 className="label">Settings</h2>
      <div className="card">
        <p style={{ fontSize: 14 }}>
          {settings.minutes} minutes a day · {settings.equipment.length} kinds of equipment
          {settings.equipment.includes("barbell") ? ` · ${settings.barWeight} lb bar` : ""} · hikes {settings.hikes ? "on" : "off"} · summer swims {settings.swims ? "on" : "off"}
        </p>
        <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setView("settings")}>Change settings</button>
      </div>

      <h2 className="label">Standing swaps</h2>
      <div className="card">
        {swapList.length === 0 && <p className="muted">None yet. In a session, tap Swap on an exercise and choose "Use this swap every time".</p>}
        {swapList.map(([from, to]) => (
          <div className="row spread" key={from} style={{ padding: "4px 0", fontSize: 14 }}>
            <span>{byId(from).name}, swapped for <strong>{byId(to).name}</strong></span>
            <button type="button" className="btn-small" onClick={() => onRemoveSwap(from)}>Undo<span className="sr-only"> the {byId(from).name} swap</span></button>
          </div>
        ))}
      </div>

      <h2 className="label">Your data</h2>
      <div className="card">
        <YourData sessions={sessions} extras={extras} onReplace={onReplaceSessions} />
      </div>

      <h2 className="label">Library</h2>
      <div className="card">
        <p className="muted" style={{ marginBottom: 10 }}>Every exercise the plan can draw on, with notes and form guides.</p>
        <button type="button" className="btn-secondary" onClick={() => setView("library")}>Open the library</button>
      </div>

      <h2 className="label">Why</h2>
      <div className="card">
        <p className="muted" style={{ marginBottom: 10 }}>Each rule the app follows, the research behind it, and the limits of that research.</p>
        <a className="btn-secondary" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href="/why">Why the app works this way</a>
      </div>

      <p className="muted" style={{ textAlign: "center", marginTop: 20 }}>Move {VERSION}</p>
    </>
  );
}
