import { useEffect, useRef } from "react";

export const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, "0")}`;

export const fmtRest = (sec) => {
  if (sec < 60) return `${sec} sec`;
  const m = sec / 60;
  return `${Number.isInteger(m) ? m : m.toFixed(1)} min`;
};

export const fmtDate = (d, opts = { weekday: "long", month: "short", day: "numeric" }) =>
  new Date(d).toLocaleDateString("en-US", opts);

/** A tappable checklist. Items are { text, done, url? }. */
export function Checklist({ items, onToggle }) {
  return (
    <ul className="checklist">
      {items.map((item, i) => (
        <li key={i}>
          <button type="button" className="check-item" aria-pressed={!!item.done} onClick={() => onToggle(i)}>
            <span className="check-box" aria-hidden="true">{item.done ? "✓" : ""}</span>
            <span className="check-text">{item.text}</span>
          </button>
          {item.url && (
            <div className="ex-links" style={{ margin: "-4px 0 6px 34px" }}>
              <a href={item.url} target="_blank" rel="noreferrer">
                How to do it: {item.text.split(":")[0]} (ACE, opens in a new tab)
              </a>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Bottom sheet dialog. Closes on Escape or a tap outside, and returns focus on close. */
export function Modal({ title, onClose, children }) {
  const sheet = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    sheet.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !sheet.current) return;
      const items = sheet.current.querySelectorAll("button:not([disabled]), a[href], input, textarea, select");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = sheet.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet" role="dialog" aria-modal="true" aria-label={title}
        tabIndex={-1} ref={sheet} onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-top">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="btn-small" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Labeled progress bar with the numbers in text, so color is never the only signal. */
export function Meter({ label, value, target, unit = "", note }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const full = value >= target;
  return (
    <div className="meter">
      <div className="meter-top">
        <span>{label}</span>
        <span className="meter-val">{value} of {target}{unit}{full ? " ✓" : ""}</span>
      </div>
      <div
        className="meter-track" role="progressbar" aria-label={label}
        aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(value, target)}
        aria-valuetext={`${value} of ${target}${unit}`}
      >
        <div className={`meter-fill ${full ? "full" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      {note && <div className="meter-note">{note}</div>}
    </div>
  );
}

export function ActivityPicker({ activity, activities, onChange }) {
  const presets = [10, 20, 30, 45, 60];
  const options = activity.options?.length ? activity.options : Object.keys(activities);
  return (
    <div>
      {options.length > 1 && (
        <div className="chips" role="group" aria-label="Activity" style={{ marginBottom: 10 }}>
          {options.map((t) => (
            <button
              key={t} type="button" className="chip" aria-pressed={activity.type === t}
              onClick={() => onChange({ type: t, minutes: activities[t].minutes })}
            >
              <span aria-hidden="true">{activities[t].emoji} </span>{activities[t].label}
            </button>
          ))}
        </div>
      )}
      <div className="chips" role="group" aria-label="Minutes">
        {presets.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={activity.minutes === m} onClick={() => onChange({ minutes: m })}>
            {m}
          </button>
        ))}
        <input
          className="minutes-input" type="number" inputMode="numeric" min="1" max="600"
          aria-label="Minutes" value={activity.minutes || ""}
          onChange={(e) => onChange({ minutes: Math.max(0, Math.min(600, parseInt(e.target.value, 10) || 0)) })}
        />
        <span className="muted">min</span>
      </div>
      {activities[activity.type]?.aerobic && (
        <div style={{ marginTop: 10 }}>
          <button type="button" className="chip" aria-pressed={!!activity.hard} onClick={() => onChange({ hard: !activity.hard })}>
            Hard effort
          </button>
          <span className="muted" style={{ marginLeft: 8 }}>Hard minutes count double.</span>
        </div>
      )}
    </div>
  );
}
