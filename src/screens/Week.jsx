import { useState } from "react";
import { clocks, FORMATS, plannedAerobicMinutes } from "../engine/program.js";
import { addDays, DAY_NAMES, mondayOf, toKey } from "../engine/dates.js";
import {
  AEROBIC_TARGET_MIN, STRENGTH_TARGET_DAYS, SETS_MINIMUM, SETS_GOAL, PATTERNS, weekSummary, weekRecap,
} from "../engine/stats.js";
import { Meter, fmtDate } from "../ui.jsx";

const short = { month: "short", day: "numeric" };

export default function WeekScreen({ today, sessions, programStart, settings, lengths = {} }) {
  const [offset, setOffset] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  const [recapText, setRecapText] = useState("");
  const monday = addDays(mondayOf(today), offset * 7);
  const week = weekSummary(sessions, monday);
  const c = clocks(monday, programStart);
  const planned = plannedAerobicMinutes(monday, programStart, settings, { lengths });

  async function share() {
    // Share sheet first, then the clipboard, then plain text to copy by hand.
    const text = weekRecap(sessions, monday);
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
          {FORMATS[c.formatIndex].name} week. Week {c.weekInBlock} of 6 with the current main lifts. {week.activeDays} {week.activeDays === 1 ? "day" : "days"} moved this week.
        </p>
        <Meter label="Aerobic minutes" value={week.aerobicMinutes} target={AEROBIC_TARGET_MIN} unit=" min"
          note={`WHO target for adults: ${AEROBIC_TARGET_MIN} moderate minutes a week. Hard minutes count double.`} />
        <p className="meter-note" style={{ marginTop: -4 }}>
          Planned in this week's sessions: <strong>{planned} min</strong> of the {AEROBIC_TARGET_MIN} (Tuesday's cardio, plus any easy cardio on a 45-minute lift day). The walks you log cover the rest.
        </p>
        <Meter label="Strength days" value={week.strengthDays} target={STRENGTH_TARGET_DAYS}
          note="WHO target: muscle strengthening on 2 or more days a week." />
        <Meter label="Days moved" value={week.activeDays} target={7} note="Any logged movement counts, including a 10-minute walk. The count starts over every Monday." />
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

    </>
  );
}
