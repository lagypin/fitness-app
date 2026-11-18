// ─── CSV export ───────────────────────────────────────────────────────────────
//
// Two files: Sessions (one row per logged session or activity) and Sets (one
// row per logged set, keyed to its session by session_id). README.md carries
// the data dictionary for both. Cells are quoted only when they hold a comma,
// a quote, or a line break; rows end in CRLF.
// ──────────────────────────────────────────────────────────────────────────────

import { ACTIVITIES } from "./program.js";

export function csvCell(v) {
  const str = String(v ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

export const SESSION_COLUMNS = [
  "session_id", "date", "day", "kind", "format", "length", "duration_min",
  "activity", "activity_min", "hard", "exercises", "sets_done",
];

export const SET_COLUMNS = [
  "session_id", "date", "exercise", "category", "role", "group", "set", "weight_lb", "reps", "feel",
];

const dateOf = (s) => s.dayKey || (s.date || "").slice(0, 10);
const doneSets = (ex) => (ex.sets || []).filter((x) => x.done);

export function sessionRows(sessions) {
  return sessions.map((s) => {
    const a = s.activity;
    return [
      s.id || "",
      dateOf(s),
      s.templateName || "",
      s.kind || (a ? "activity" : ""),
      s.format?.name || "",
      s.length ?? (s.short ? "short" : ""),
      s.durationMin ?? "",
      a?.type ? ACTIVITIES[a.type]?.label || a.type : "",
      a?.minutes ?? "",
      a?.minutes ? (a.hard ? "yes" : "no") : "",
      (s.exercises || []).length,
      (s.exercises || []).reduce((n, ex) => n + doneSets(ex).length, 0),
    ];
  });
}

export function setRows(sessions) {
  const rows = [];
  for (const s of sessions) {
    for (const ex of s.exercises || []) {
      for (const set of doneSets(ex)) {
        rows.push([
          s.id || "", dateOf(s), ex.name || "", ex.category || "", ex.role || "", ex.group || "",
          set.setNum ?? "", set.weight ?? "", set.reps ?? "", ex.feel || "",
        ]);
      }
    }
  }
  return rows;
}

/** Both CSV files as text. */
export function exportCsvs(sessions) {
  return {
    sessions: toCsv([SESSION_COLUMNS, ...sessionRows(sessions)]),
    sets: toCsv([SET_COLUMNS, ...setRows(sessions)]),
  };
}

/** A small CSV reader for the tests: handles quoted cells, doubled quotes, and CRLF. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\r") { /* CRLF: wait for the \n */ }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
