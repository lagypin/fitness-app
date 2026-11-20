// Version 2.2: finish cheers, data compatibility with 2.1 (backups and in-progress sessions).
import test from "node:test";
import assert from "node:assert/strict";

import { byId } from "../src/exercises.js";
import { addDays, fromKey } from "../src/engine/dates.js";
import { buildSessionFor as build, completedEntry, normalizeSession, watchWorkoutFor, EQUIPMENT } from "../src/engine/program.js";
import { newTopWeights, weekSummary, isStrengthEntry } from "../src/engine/stats.js";
import { mergeSessions, parseBackup } from "../src/engine/backup.js";
import { exportCsvs, parseCsv } from "../src/engine/export.js";
import {
  WORKOUT_LINES, QUICK_LINES, FACTS, RECENT_LIMIT, pickLine, quickLinesFor, chooseFact, splitEmoji, CELEBRATION_EMOJI,
} from "../src/cheers.js";

const START = "2026-11-09";
const ME = { minutes: 30, barWeight: 35, equipment: EQUIPMENT.map((e) => e.id) };
const monday = fromKey(START);
const day = (week, dow) => addDays(monday, week * 7 + dow);
const buildSessionFor = (date, start, opts = {}) => build(date, start, { settings: ME, ...opts });

// A deterministic stand-in for Math.random: returns the given values in turn, then repeats the last.
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

// ─── cheers ───────────────────────────────────────────────────────────────────

test("the cheer lists are exactly as written: 32 workout lines, 8 quick-log lines, no em dashes", () => {
  assert.equal(WORKOUT_LINES.length, 32);
  assert.equal(WORKOUT_LINES[0], "You showed up. That's the whole trick.");
  assert.equal(WORKOUT_LINES[31], "Mission accomplished. Go bask in it.");
  assert.equal(QUICK_LINES.length, 8);
  assert.equal(new Set(WORKOUT_LINES).size, 32);
  for (const l of [...WORKOUT_LINES, ...QUICK_LINES, FACTS.A(1), FACTS.B(10), FACTS.C(), FACTS.D("Back Squat")]) assert.ok(!l.includes("—"), l);
});

test("cheers never repeat within the last 5 shown, and the recent list is capped at 5", () => {
  let recent = [];
  const shown = [];
  for (let i = 0; i < 400; i++) {
    const r = pickLine(WORKOUT_LINES, recent);
    assert.ok(WORKOUT_LINES.includes(r.line));
    assert.ok(!shown.slice(-RECENT_LIMIT).includes(r.line), `repeat at ${i}: ${r.line}`);
    shown.push(r.line);
    recent = r.recent;
    assert.ok(recent.length <= RECENT_LIMIT);
    assert.equal(recent[recent.length - 1], r.line);
  }
  assert.ok(new Set(shown).size > 20, "random picks spread across the list");
  // the pick is random but steerable
  assert.equal(pickLine(WORKOUT_LINES, [], seq(0)).line, WORKOUT_LINES[0]);
  assert.equal(pickLine(WORKOUT_LINES, [], seq(0.999)).line, WORKOUT_LINES[31]);
  // with the first five recent, rand 0 gives the sixth
  assert.equal(pickLine(WORKOUT_LINES, WORKOUT_LINES.slice(0, 5), seq(0)).line, WORKOUT_LINES[5]);
  // a short list that is all recent still returns something
  assert.ok(pickLine(["a", "b"], ["a", "b"]).line);
});

test("quick-log lines: walks get all 8, other activities skip every line that says walk, separate recent list", () => {
  assert.equal(quickLinesFor("walk").length, 8);
  const swim = quickLinesFor("swim");
  assert.equal(swim.length, 4);
  for (const l of swim) assert.ok(!/walk/i.test(l), l);
  assert.deepEqual(quickLinesFor("yoga"), swim);
  for (const l of QUICK_LINES) assert.match(l, /^(👍|⭐|🌈) /);
  const { text, emoji } = splitEmoji("👍 Nice walk.");
  assert.equal(text, "Nice walk.");
  assert.equal(emoji, "👍");
});

test("splitEmoji separates decorative emoji from the words, at either end", () => {
  assert.deepEqual(splitEmoji("Rainbow unlocked. 🌈"), { text: "Rainbow unlocked.", emoji: "🌈" });
  assert.deepEqual(splitEmoji("Strong looks good on you. 🏋️‍♀️"), { text: "Strong looks good on you.", emoji: "🏋️‍♀️" });
  assert.deepEqual(splitEmoji("Strong, steady, and a little bit sparkly. 🦄🌈"), { text: "Strong, steady, and a little bit sparkly.", emoji: "🦄🌈" });
  assert.deepEqual(splitEmoji(FACTS.C()), { text: "Two strength days done. This week's guideline is covered.", emoji: "✅" });
  assert.deepEqual(splitEmoji(FACTS.D("Back Squat")), { text: "Heaviest Back Squat you've logged!", emoji: "🏋️‍♀️" });
  assert.deepEqual(splitEmoji("You showed up. That's the whole trick."), { text: "You showed up. That's the whole trick.", emoji: "" });
  assert.deepEqual(splitEmoji("Today: you 1, excuses 0."), { text: "Today: you 1, excuses 0.", emoji: "" });
  for (const e of CELEBRATION_EMOJI) assert.equal(splitEmoji(`x ${e}`).emoji, e);
});

test("fact D fires on a real new top weight only, never for a first-time exercise", () => {
  const lift = (id, weights, extra = {}) => ({
    id: Math.random().toString(), kind: "lift", exercises: [{
      exerciseId: id, name: byId(id).name, category: byId(id).category,
      sets: weights.map((w, i) => ({ setNum: i + 1, weight: String(w), reps: "5", done: true })),
    }], ...extra,
  });
  const prior = [lift("ex_back_squat", [95, 95, 100]), lift("ex_barbell_bench", [65, 65])];
  // heavier than every earlier set: a record
  assert.deepEqual(newTopWeights(lift("ex_back_squat", [100, 105]), prior), ["Back Squat"]);
  // equal to the old top is not a record; lighter is not
  assert.deepEqual(newTopWeights(lift("ex_back_squat", [100, 100]), prior), []);
  assert.deepEqual(newTopWeights(lift("ex_back_squat", [90]), prior), []);
  // an undone heavier set does not count
  const undone = lift("ex_back_squat", [120]);
  undone.exercises[0].sets[0].done = false;
  assert.deepEqual(newTopWeights(undone, prior), []);
  // first time logging an exercise: never a record
  assert.deepEqual(newTopWeights(lift("ex_conventional_deadlift", [135]), prior), []);
  assert.deepEqual(newTopWeights(lift("ex_back_squat", [105]), []), []);
  // two records in one session list both; chooseFact always shows D for the first
  const two = { ...lift("ex_back_squat", [105]), exercises: [...lift("ex_back_squat", [105]).exercises, ...lift("ex_barbell_bench", [70]).exercises] };
  assert.deepEqual(newTopWeights(two, prior), ["Back Squat", "Barbell Bench Press"]);
  assert.equal(chooseFact({ newTops: ["Back Squat"], kind: "lift", rand: seq(0.99) }), "Heaviest Back Squat you've logged! 🏋️‍♀️");
});

test("other facts show on about one finish in three and only when their condition holds", () => {
  // rand >= 1/3: no fact
  assert.equal(chooseFact({ kind: "lift", liftDays: 1, strengthDays: 1, aerobicMinutes: 40, rand: seq(0.5) }), null);
  // C only on the finish that brings strength days to exactly 2
  assert.equal(chooseFact({ kind: "lift", liftDays: 2, strengthDays: 2, strengthDaysBefore: 1, aerobicMinutes: 40, rand: seq(0.1) }), FACTS.C());
  assert.notEqual(chooseFact({ kind: "lift", liftDays: 2, strengthDays: 2, strengthDaysBefore: 2, aerobicMinutes: 40, rand: seq(0.1, 0) }), FACTS.C());
  assert.notEqual(chooseFact({ kind: "lift", liftDays: 3, strengthDays: 3, strengthDaysBefore: 2, aerobicMinutes: 40, rand: seq(0.1, 0) }), FACTS.C());
  // A after a lift session, B any time
  assert.equal(chooseFact({ kind: "lift", liftDays: 1, strengthDays: 1, aerobicMinutes: 40, rand: seq(0.1, 0) }), "That's lift day 1 of 3 this week.");
  assert.equal(chooseFact({ kind: "lift", liftDays: 1, strengthDays: 1, aerobicMinutes: 40, rand: seq(0.1, 0.9) }), "40 minutes of movement this week and counting.");
  assert.equal(chooseFact({ kind: "core", liftDays: 1, strengthDays: 1, aerobicMinutes: 55, rand: seq(0.1, 0) }), "55 minutes of movement this week and counting.");
  // a fourth lift in a week is never "lift day 4 of 3"
  assert.equal(chooseFact({ kind: "lift", liftDays: 4, strengthDays: 3, strengthDaysBefore: 3, aerobicMinutes: 10, rand: seq(0.1, 0) }), FACTS.B(10));
  // over many finishes without a record, roughly a third carry a fact
  let n = 0;
  for (let i = 0; i < 3000; i++) if (chooseFact({ kind: "lift", liftDays: 1, strengthDays: 1, aerobicMinutes: 20 })) n++;
  assert.ok(n > 800 && n < 1200, String(n));
});

// ─── compatibility with 2.1 ───────────────────────────────────────────────────

// Entries as version 2.1 saved them: a mobility day, a Sunday surprise, a walk, and a lift.
const V21 = [
  {
    id: "m1", kind: "mobility", templateId: "mobility", templateName: "Mobility", emoji: "🌸",
    date: "2026-11-12T18:00:00.000Z", dayKey: "2026-11-12", weekIndex: 0, length: 30, completed: true, durationMin: 30,
    format: { id: "hips_legs", name: "Hips + legs", tagline: "Hold each stretch to tightness, never pain." },
    cardio: [{ text: "Brisk walk: 15 min", done: true }], cardioTitle: "Cardio first",
    warmup: [{ text: "Kneeling hip-flexor stretch: 2 × 30 sec each side", done: true }, { text: "Pigeon pose: 2 × 30 sec each side", done: false }],
    warmupTitle: "Stretch: Hips + legs", cooldown: [], exercises: [],
    activity: { type: "walk", minutes: 15, hard: false, options: ["walk", "row"] }, estMinutes: 12,
  },
  {
    id: "s1", kind: "surprise", templateId: "surprise", templateName: "Surprise: Row intervals", emoji: "🚣", surpriseId: "row_intervals",
    date: "2026-11-15T15:00:00.000Z", dayKey: "2026-11-15", length: 30, completed: true, durationMin: 32,
    format: { id: "row_intervals", name: "Row intervals", tagline: "Short hard efforts on the rower" },
    warmup: [], cooldown: ["Plantar fascia stretch: 60 sec each foot", "Calf stretch: 2 × 30 sec each side"],
    main: [{ text: "Easy row: 5 min", done: true }, { text: "8 rounds: 30 sec hard, 2 min easy", done: true }], exercises: [],
    activity: { type: "row", minutes: 30, hard: true, options: ["row"] }, estMinutes: 2,
  },
  {
    id: "w1", kind: "activity", templateId: "walk", templateName: "Walk", emoji: "🚶",
    date: "2026-11-13T12:00:00.000Z", dayKey: "2026-11-13", exercises: [], activity: { type: "walk", minutes: 30, hard: false }, durationMin: 30, completed: true,
  },
];

test("history from 2.1, mobility and surprise entries included, still counts in Week and exports to CSV untouched", () => {
  const lift = buildSessionFor(day(0, 0), START);
  lift.id = "l1"; lift.completed = true; lift.durationMin = 31;
  lift.exercises = lift.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, weight: "50", done: true })) }));
  const sessions = [lift, ...V21];
  const w = weekSummary(sessions, monday);
  assert.equal(w.activeDays, 4);
  assert.equal(w.aerobicMinutes, 15 + 60 + 30); // the surprise row was hard: double
  assert.equal(w.strengthDays, 1);
  assert.ok(isStrengthEntry(lift));
  assert.deepEqual(w.days[3].entries.map((e) => e.templateName), ["Mobility"]);
  assert.deepEqual(w.days[6].entries.map((e) => e.templateName), ["Surprise: Row intervals"]);
  const rows = parseCsv(exportCsvs(sessions).sessions).slice(1);
  const mob = rows.find((r) => r[0] === "m1");
  assert.equal(mob[2], "Mobility");
  assert.equal(mob[3], "mobility");
  assert.equal(mob[4], "Hips + legs");
  const sur = rows.find((r) => r[0] === "s1");
  assert.equal(sur[3], "surprise");
  assert.equal(sur[7], "Row");
  assert.equal(sur[9], "yes");
  // nothing was rewritten
  assert.equal(JSON.stringify(sessions.slice(1)), JSON.stringify(V21));
});

test("a 2.1 backup (version 2) restores, as a replace or a merge, and so does a version-1 bare array", () => {
  const backup = { app: "move", version: 2, exportedAt: "2026-11-16T12:00:00.000Z", sessions: V21, programStart: START, swaps: {}, settings: { ...ME, footCare: true, setupDone: true } };
  const incoming = parseBackup(backup);
  assert.equal(incoming.length, 3);
  assert.deepEqual(parseBackup(V21), V21);
  assert.throws(() => parseBackup({ app: "move", version: 2 }), /not a Move backup/);
  assert.throws(() => parseBackup("nope"), /not a Move backup/);
  const existing = [{ id: "w1", date: "2026-11-13T12:00:00.000Z" }, { id: "x9", date: "2026-11-20T12:00:00.000Z", templateName: "Pull" }];
  const merged = mergeSessions(existing, incoming);
  assert.deepEqual(merged.map((s) => s.id), ["m1", "w1", "s1", "x9"]);
  assert.equal(merged.filter((s) => s.id === "w1").length, 1);
});

test("a mobility session that 2.1 left in progress still opens, finishes, and saves", () => {
  const active = normalizeSession({
    ...V21[0], id: "a1", completed: false, startedAt: Date.UTC(2026, 10, 19, 17, 0), planDayKey: "2026-11-19",
    cooldown: ["Calf stretch: 2 × 30 sec each side"],
  });
  assert.deepEqual(active.cooldown, [{ text: "Calf stretch: 2 × 30 sec each side", done: false }]);
  assert.equal(active.warmup.length, 2);
  assert.equal(active.cardio.length, 1);
  assert.equal(watchWorkoutFor(active), "Outdoor Walk, then Flexibility");
  const entry = completedEntry(active, Date.UTC(2026, 10, 19, 17, 40));
  assert.equal(entry.completed, true);
  assert.equal(entry.durationMin, 12 + 15); // no lifts: planned length, not the clock
  assert.equal(entry.kind, "mobility");
  assert.equal(entry.templateName, "Mobility");
  // a surprise circuit in progress, with lifts, times itself
  const circuit = normalizeSession({
    id: "a2", kind: "surprise", templateName: "Surprise: Kettlebell circuit", startedAt: Date.UTC(2026, 10, 19, 17, 0), warmup: ["Cat-cow: 10 reps"], cooldown: [],
    exercises: [{ exerciseId: "ex_goblet_squat", name: "Goblet Squat", category: "squat", role: "accessory", sets: [{ setNum: 1, weight: "40", reps: "10", done: true }] }], estMinutes: 20,
  });
  assert.equal(watchWorkoutFor(circuit), "Traditional Strength Training");
  assert.equal(completedEntry(circuit, Date.UTC(2026, 10, 19, 17, 24)).durationMin, 24);
  // and a 2.2 lift session completes the same way
  const lift = buildSessionFor(day(1, 0), START);
  assert.equal(completedEntry({ ...lift, startedAt: 0 }, 0).durationMin, lift.estMinutes);
});
