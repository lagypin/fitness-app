// ─── Weekly totals, days moved, and the shareable recap ──────────────────────────

import { ACTIVITIES } from "./program.js";
import { addDays, entryDayKey, mondayOf, toKey } from "./dates.js";

// World Health Organization 2020 guidelines for adults (see evidence.js).
export const AEROBIC_TARGET_MIN = 150;
export const STRENGTH_TARGET_DAYS = 2;
// Weekly hard sets per movement pattern (see evidence.js).
export const SETS_MINIMUM = 4;
export const SETS_GOAL = 10;

export const PATTERNS = ["squat", "hinge", "press", "pull", "core"];
const STRENGTH_PATTERNS = new Set(["squat", "hinge", "press", "pull"]);

const doneSets = (entry, filter = () => true) =>
  (entry.exercises || []).reduce(
    (n, ex) => n + (filter(ex) ? (ex.sets || []).filter((s) => s.done).length : 0), 0
  );

/** Moderate-equivalent aerobic minutes. Hard minutes count double, per WHO. */
export function aerobicMinutesOf(entry) {
  const a = entry.activity;
  if (!a || !a.minutes) return 0;
  if (!ACTIVITIES[a.type]?.aerobic) return 0;
  return a.minutes * (a.hard ? 2 : 1);
}

/** A day counts toward the strength target with 6+ sets of squat, hinge, press, or pull. */
export function isStrengthEntry(entry) {
  return doneSets(entry, (ex) => STRENGTH_PATTERNS.has(ex.category)) >= 6;
}

/** Days with any logged movement in the week (Monday to Sunday) that holds `today`. Resets every Monday. */
export function daysMovedThisWeek(sessions, today = new Date()) {
  return weekSummary(sessions, mondayOf(today)).activeDays;
}

export function weekSummary(sessions, monday) {
  const keys = Array.from({ length: 7 }, (_, i) => toKey(addDays(monday, i)));
  const keySet = new Set(keys);
  const inWeek = sessions.filter((s) => keySet.has(entryDayKey(s)));

  const days = keys.map((key) => ({
    key,
    entries: inWeek.filter((s) => entryDayKey(s) === key),
  }));

  const setsByPattern = Object.fromEntries(PATTERNS.map((p) => [p, 0]));
  for (const s of inWeek) {
    for (const ex of s.exercises || []) {
      if (ex.category in setsByPattern) {
        setsByPattern[ex.category] += (ex.sets || []).filter((x) => x.done).length;
      }
    }
  }

  const strengthDays = new Set(inWeek.filter(isStrengthEntry).map(entryDayKey)).size;

  return {
    days,
    entries: inWeek,
    activeDays: days.filter((d) => d.entries.length).length,
    aerobicMinutes: inWeek.reduce((n, s) => n + aerobicMinutesOf(s), 0),
    strengthDays,
    totalMinutes: inWeek.reduce((n, s) => n + (s.durationMin || s.activity?.minutes || 0), 0),
    setsByPattern,
  };
}

const topWeight = (ex) =>
  Math.max(0, ...(ex.sets || []).filter((s) => s.done).map((s) => parseFloat(s.weight) || 0));

/**
 * Exercises in `session` whose heaviest done set beats every done set of that
 * exercise in `prior` (the entries saved before it). Exercises with no earlier
 * weighted history are skipped, so a first-time lift is never a record.
 */
export function newTopWeights(session, prior) {
  const best = new Map();
  for (const s of prior) {
    for (const ex of s.exercises || []) {
      const w = topWeight(ex);
      if (w > 0) best.set(ex.exerciseId, Math.max(w, best.get(ex.exerciseId) || 0));
    }
  }
  const out = [];
  for (const ex of session.exercises || []) {
    const w = topWeight(ex);
    if (w > 0 && best.has(ex.exerciseId) && w > best.get(ex.exerciseId)) out.push(ex.name);
  }
  return out;
}

/** Lifts whose top weight this week beat everything logged before this week. */
export function liftsThatWentUp(sessions, monday) {
  const start = toKey(monday);
  const before = new Map();
  const thisWeek = new Map();
  for (const s of sessions) {
    const key = entryDayKey(s);
    const target = key < start ? before : key <= toKey(addDays(monday, 6)) ? thisWeek : null;
    if (!target) continue;
    for (const ex of s.exercises || []) {
      const w = topWeight(ex);
      if (w > 0) target.set(ex.name, Math.max(w, target.get(ex.name) || 0));
    }
  }
  const ups = [];
  for (const [name, w] of thisWeek) {
    if (before.has(name) && w > before.get(name)) ups.push({ name, weight: w, from: before.get(name) });
  }
  return ups.sort((a, b) => b.weight - b.from - (a.weight - a.from));
}

/** Plain-text week recap for the share sheet. */
export function weekRecap(sessions, monday) {
  const w = weekSummary(sessions, monday);
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const lines = [`My week in Move (${fmt(monday)} to ${fmt(addDays(monday, 6))})`];
  lines.push(`Moved ${w.activeDays} of 7 days.`);
  const names = w.entries.map((s) => s.templateName).filter(Boolean);
  if (names.length) lines.push(`Sessions: ${names.join(", ")}.`);
  lines.push(`Strength days: ${w.strengthDays}. Aerobic minutes: ${w.aerobicMinutes}.`);
  const ups = liftsThatWentUp(sessions, monday).slice(0, 2);
  for (const u of ups) lines.push(`${u.name} went up: ${u.from} to ${u.weight} lb.`);
  return lines.join("\n");
}
