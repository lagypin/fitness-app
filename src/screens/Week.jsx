import { useState } from "react";
import { byId } from "../exercises.js";
import { clocks, FORMATS } from "../engine/program.js";
import { addDays, DAY_NAMES, mondayOf, toKey } from "../engine/dates.js";
import {
  AEROBIC_TARGET_MIN, STRENGTH_TARGET_DAYS, SETS_MINIMUM, SETS_GOAL, PATTERNS, weekSummary, weekRecap,
} from "../engine/stats.js";
import { Meter, fmtDate } from "../ui.jsx";
import SettingsForm from "./Settings.jsx";

const short = { month: "short", day: "numeric" };

export default function WeekScreen({ today, sessions, programStart, streakCount, swaps, onRemoveSwap, settings, onSaveSettings }) {
  const [offset, setOffset] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  const [recapText, setRecapText] = useState("");
  const [editing, setEditing] = useState(false);
  const monday = addDays(mondayOf(today), offset * 7);
  const week = weekSummary(sessions, monday);
  const c = clocks(monday, programStart);
  const swapList = Object.entries(swaps).filter(([from, to]) => byId(from) && byId(to));

  async function share() {
    // Share sheet first, then the clipboard, then plain text to copy by hand.
    const text = weekRecap(sessions, monday, today);
    setRecapText("");
    if (navigator.share) {
      try {
        await navigator.share({ text });
        setShareStatus("Shared.");
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Recap copied. Paste it into a message.");
    } catch {
      setRecapText(text);
      setShareStatus("Copy the recap below and paste it into a message.");
    }
  }

  if (editing) {
    return (
      <>
        <button type="button" className="btn-link" onClick={() => setEditing(false)}>Back to the week</button>
        <SettingsForm settings={settings} onSave={(s) => { onSaveSettings(s); setEditing(false); }} />
      </>
    );
  }

  return (
    <>
      <div className="row spread" style={{ marginBottom: 10 }}>
        <button type="button" className="btn-small" onClick={() => setOffset(offset - 1)}><span aria-hidden="true">← </span>Earlier</button>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>
          {fmtDate(monday, short)} to {fmtDate(addDays(monday, 6), short)}
        </h2>
        <button type="button" className="btn-small" onClick={() => setOffset(offset + 1)} disabled={offset >= 0}>Later<span aria-hidden="true"> →</span></button>
      </div>

      <div className="card">
        <p className="plan-meta" style={{ marginTop: 0 }}>
          {FORMATS[c.formatIndex].name} week. Week {c.weekInBlock} of 6 with the current main lifts. Streak: {streakCount} {streakCount === 1 ? "day" : "days"}.
        </p>
        <Meter label="Aerobic minutes" value={week.aerobicMinutes} target={AEROBIC_TARGET_MIN} unit=" min"
          note="WHO target for adults: 150 moderate minutes a week. Hard minutes count double." />
        <Meter label="Strength days" value={week.strengthDays} target={STRENGTH_TARGET_DAYS}
          note="WHO target: muscle strengthening on 2 or more days a week." />
        <Meter label="Days moved" value={week.activeDays} target={7} note="Any logged movement counts, including a 10-minute walk." />
      </div>

      <h2 className="label">Hard sets by movement pattern</h2>
      <div className="card">
        {PATTERNS.map((p) => {
          const n = week.setsByPattern[p];
          const verdict = p === "core" ? "" : n >= SETS_GOAL ? "plenty" : n >= SETS_MINIMUM ? "enough" : offset === 0 ? "so far" : `under the suggested ${SETS_MINIMUM}`;
          return (
            <div className="row spread" key={p} style={{ padding: "6px 0", fontSize: 14 }}>
              <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{p}</span>
              <span className="meter-val">{n} {n === 1 ? "set" : "sets"}{verdict ? ` · ${verdict}` : ""}</span>
            </div>
          );
        })}
        <p className="meter-note">A review of time-efficient training suggests at least {SETS_MINIMUM} weekly sets per muscle group. More sets bring more growth, with smaller returns as you add them.</p>
      </div>

      <h2 className="label">Day by day</h2>
      <div className="card">
        {week.days.map((d, i) => (
          <div className="row spread" key={d.key} style={{ padding: "6px 0", fontSize: 14, alignItems: "flex-start" }}>
            <span style={{ fontWeight: 700 }}>{DAY_NAMES[i]}{d.key === toKey(today) ? " (today)" : ""}</span>
            <span className="meter-val" style={{ textAlign: "right" }}>
              {d.entries.length ? d.entries.map((e) => e.templateName).join(", ") : "nothing logged"}
            </span>
          </div>
        ))}
      </div>

      <button type="button" className="btn-primary" onClick={share}>Share my week</button>
      {shareStatus && <p className="status" role="status">{shareStatus}</p>}
      {recapText && (
        <textarea className="search-input" style={{ marginTop: 8, minHeight: 130 }} readOnly aria-label="Week recap" value={recapText}
          onFocus={(e) => e.target.select()} />
      )}

      {swapList.length > 0 && (
        <>
          <h2 className="label">Standing swaps</h2>
          <div className="card">
            {swapList.map(([from, to]) => (
              <div className="row spread" key={from} style={{ padding: "4px 0", fontSize: 14 }}>
                <span>{byId(from).name}, swapped for <strong>{byId(to).name}</strong></span>
                <button type="button" className="btn-small" onClick={() => onRemoveSwap(from)}>Undo<span className="sr-only"> the {byId(from).name} swap</span></button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="label">Settings</h2>
      <div className="card">
        <p style={{ fontSize: 14 }}>
          {settings.minutes} minutes a day · {settings.equipment.length} kinds of equipment
          {settings.equipment.includes("barbell") ? ` · ${settings.barWeight} lb bar` : ""} · foot care {settings.footCare ? "on" : "off"}
        </p>
        <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>Change settings</button>
      </div>
    </>
  );
}
