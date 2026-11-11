import test from "node:test";
import assert from "node:assert/strict";

import { EXERCISES, byId, FORM_GUIDES } from "../src/exercises.js";
import { addDays, fromKey, mondayOf, toKey, weekIndexFor } from "../src/engine/dates.js";
import {
  buildSessionFor as build, clocks, DAY_PLAN, FORMATS, LIFT_DAYS, CORE_FORMATS, swapExercise, normalizeSession,
  EQUIPMENT, DEFAULT_SETTINGS, canDo,
} from "../src/engine/program.js";
import { applySuggestions, suggestWeight, rampUpSets } from "../src/engine/progression.js";
import { streak, weekSummary, weekRecap, aerobicMinutesOf, isStrengthEntry } from "../src/engine/stats.js";
import { PRINCIPLES, SOURCES } from "../src/engine/evidence.js";

const START = "2026-11-09"; // a Monday

// The settings of the person this was first built for: everything in the gym,
// a 35 lb bar, 30 minutes a day, foot care on. Tests use these unless they say otherwise.
const ALL_GEAR = EQUIPMENT.map((e) => e.id);
const ME = { minutes: 30, footCare: true, barWeight: 35, equipment: ALL_GEAR };
const buildSessionFor = (date, start, opts = {}) => build(date, start, { settings: ME, ...opts });
const monday = fromKey(START);
const day = (week, dow) => addDays(monday, week * 7 + dow);

const allText = (s) =>
  [...(s.warmup || []), ...(s.cooldown || []), ...(s.main || [])].map((i) => i.text).join(" | ");

test("dates: week index and Monday math", () => {
  assert.equal(toKey(mondayOf(fromKey("2026-11-11"))), "2026-11-09");
  assert.equal(toKey(mondayOf(fromKey("2026-11-15"))), "2026-11-09");
  assert.equal(weekIndexFor(fromKey("2026-11-15"), START), 0);
  assert.equal(weekIndexFor(fromKey("2026-11-16"), START), 1);
  assert.equal(weekIndexFor(fromKey("2027-03-20"), START), 18); // across the DST change
  assert.equal(weekIndexFor(fromKey("2026-01-01"), START), 0);  // never negative
});

test("the weekly split matches the plan", () => {
  assert.deepEqual(DAY_PLAN.map((d) => d.name),
    ["Push", "Core", "Pull", "Mobility", "Hinge", "Mobility", "Surprise"]);
});

test("every day for 18 weeks builds, in winter and summer", () => {
  for (const start of [START, "2026-06-01"]) {
    const m = fromKey(start);
    for (let i = 0; i < 18 * 7; i++) {
      const d = addDays(m, i);
      for (const opts of [{}, { short: true }]) {
        const s = buildSessionFor(d, start, opts);
        assert.ok(s.templateName, `name on ${toKey(d)}`);
        assert.ok(s.estMinutes > 0, `duration on ${toKey(d)}`);
        for (const ex of s.exercises) assert.ok(byId(ex.exerciseId), ex.exerciseId);
      }
    }
  }
});

test("same date always gives the same workout", () => {
  const a = buildSessionFor(day(2, 0), START);
  const b = buildSessionFor(day(2, 0), START);
  assert.deepEqual(a.exercises.map((e) => [e.exerciseId, e.sets.length, e.repsLabel]),
                   b.exercises.map((e) => [e.exerciseId, e.sets.length, e.repsLabel]));
});

test("format changes every week; main lifts hold for six weeks; accessories hold for three", () => {
  const mains = [], formats = [], accessories = [];
  for (let w = 0; w < 12; w++) {
    const s = buildSessionFor(day(w, 0), START, { settings: { ...ME, minutes: 45 } });
    formats.push(s.format.id);
    mains.push(s.exercises[0].exerciseId);
    accessories.push(s.exercises.filter((e) => e.role === "accessory").map((e) => e.exerciseId).join("+"));
  }
  assert.deepEqual(formats.slice(0, 6), ["heavy", "volume", "density", "heavy", "volume", "density"]);
  assert.equal(new Set(mains.slice(0, 6)).size, 1);
  assert.equal(new Set(mains.slice(6, 12)).size, 1);
  assert.notEqual(mains[0], mains[6]);
  assert.equal(new Set(accessories.slice(0, 3)).size, 1);
  assert.notEqual(accessories[0], accessories[3]);
  // the set and rep scheme really differs across the wave
  const schemes = [0, 1, 2].map((w) => {
    const m = buildSessionFor(day(w, 0), START).exercises[0];
    return `${m.sets.length}x${m.repsLabel}`;
  });
  assert.equal(new Set(schemes).size, 3);
});

test("no jumping anywhere", () => {
  const banned = /jump|hop|bound|burpee|plyo/i;
  for (const ex of EXERCISES) assert.ok(!banned.test(ex.name), ex.name);
  for (let i = 0; i < 126; i++) {
    const s = buildSessionFor(addDays(monday, i), START);
    assert.ok(!banned.test(allText(s)), toKey(addDays(monday, i)));
  }
});

test("calf raises and ankle or foot work are in every session, short ones included", () => {
  for (let i = 0; i < 42; i++) {
    for (const opts of [{}, { short: true }]) {
      const s = buildSessionFor(addDays(monday, i), START, opts);
      const text = allText(s);
      assert.match(text, /calf raises/i, `${s.templateName} ${toKey(addDays(monday, i))}`);
      assert.match(text, /ankle|plantar/i, `${s.templateName} ${toKey(addDays(monday, i))}`);
    }
  }
});

test("the PT exercises are gone from the program and the library", () => {
  const gone = /Joe|\bPT\b|hip sinks|Midfoot mobilization|Yielding hip|Knee extensions|Spanish squat/i;
  for (const ex of EXERCISES) assert.ok(!gone.test(ex.name + " " + ex.notes), ex.name);
  for (let i = 0; i < 126; i++) {
    for (const opts of [{}, { short: true }]) {
      const s = buildSessionFor(addDays(monday, i), START, opts);
      assert.ok(!gone.test(allText(s) + s.exercises.map((e) => e.name + e.notes).join(" ")), toKey(addDays(monday, i)));
    }
  }
  assert.ok(!gone.test(JSON.stringify(PRINCIPLES)));
});

test("mobility days hold static stretches for 60 seconds in total; lifting warm-ups have no static holds", () => {
  const thu = buildSessionFor(day(0, 3), START);
  const stretches = thu.warmup.filter((i) => /stretch|pose|dog|twist/i.test(i.text) && !/Optional/.test(i.text));
  assert.ok(stretches.length >= 4);
  for (const st of stretches) assert.match(st.text, /2 × 30 sec|60 sec/, st.text);
  for (const d of [0, 2, 4]) {
    const s = buildSessionFor(day(0, d), START);
    for (const item of s.warmup) assert.ok(!/stretch: |pose/i.test(item.text) || /ankle/i.test(item.text), item.text);
    assert.equal(s.cooldown.length, 2);
  }
});

test("upper-back and shoulder accessories show up every week; neck moves are on the Back + shoulders day", () => {
  const upper = new Set(["ex_barbell_row", "ex_ring_rows", "ex_db_single_arm_row", "ex_face_pull", "ex_kb_single_arm_row", "ex_incline_reverse_fly", "ex_landmine_row", "ex_rear_delt_fly", "ex_lateral_raise"]);
  for (let w = 0; w < 12; w++) {
    let n = 0;
    for (const d of [0, 2, 4]) n += buildSessionFor(day(w, d), START).exercises.filter((e) => upper.has(e.exerciseId)).length;
    assert.ok(n >= 2, `week ${w}`);
  }
  let found = false;
  for (let i = 0; i < 21; i++) {
    const s = buildSessionFor(addDays(monday, i), START);
    if (s.format?.id === "back_shoulders") { found = true; assert.match(allText(s), /Neck flexion/); assert.match(allText(s), /Lateral neck flexion/); }
  }
  assert.ok(found);
});

test("warm-up and stretch links point at the ACE library", () => {
  for (let i = 0; i < 21; i++) {
    const s = buildSessionFor(addDays(monday, i), START);
    for (const item of [...s.warmup, ...s.cooldown]) {
      if (item.url) assert.match(item.url, /^https:\/\/www\.acefitness\.org\/resources\/everyone\/exercise-library\/\d+\/[a-z0-9-]+\/$/);
    }
  }
});

test("lifting sessions fit the minutes setting; short versions fit in 20", () => {
  for (const [minutes, lo, hi] of [[30, 20, 31], [45, 28, 45]]) {
    const settings = { ...ME, minutes };
    for (let w = 0; w < 12; w++) {
      for (const d of [0, 2, 4]) {
        const s = buildSessionFor(day(w, d), START, { settings });
        assert.ok(s.estMinutes >= lo && s.estMinutes <= hi, `${minutes}: ${s.templateName} ${s.format.id}: ${s.estMinutes}`);
        const short = buildSessionFor(day(w, d), START, { settings, short: true });
        assert.ok(short.estMinutes <= 20, `short ${short.templateName}: ${short.estMinutes}`);
        assert.equal(short.exercises.length, 1);
      }
      const core = buildSessionFor(day(w, 1), START, { settings });
      assert.ok(core.estMinutes <= 30, `core ${core.format.id}: ${core.estMinutes}`);
      for (const d of [3, 5]) {
        const m = buildSessionFor(day(w, d), START, { settings });
        if (m.format.id !== "class") assert.ok(m.estMinutes + m.activity.minutes <= minutes + 5, `mobility: ${m.estMinutes}+${m.activity.minutes}`);
      }
    }
  }
});

test("weekly sets per pattern stay between 6 and 13 (the range the Why tab states), at 30 and 45 minutes", () => {
  for (const minutes of [30, 45]) {
    for (let w = 0; w < 12; w++) {
      const sets = { squat: 0, hinge: 0, press: 0, pull: 0 };
      for (const d of [0, 2, 4]) {
        for (const ex of buildSessionFor(day(w, d), START, { settings: { ...ME, minutes } }).exercises) {
          if (ex.category in sets) sets[ex.category] += ex.sets.length;
        }
      }
      for (const [p, n] of Object.entries(sets)) assert.ok(n >= 6 && n <= 13, `${minutes} min, week ${w} ${p}: ${n}`);
    }
  }
});

test("foot care is an add-on: on puts it in every session, off removes every trace", () => {
  const feet = /calf|ankle|plantar/i;
  for (let i = 0; i < 42; i++) {
    for (const opts of [{}, { short: true }]) {
      const off = buildSessionFor(addDays(monday, i), START, { ...opts, settings: { ...ME, footCare: false } });
      assert.ok(!feet.test(allText(off)), `${off.templateName}: ${allText(off)}`);
    }
  }
  assert.equal(DEFAULT_SETTINGS.footCare, false);
});

test("the plan only uses equipment the person has", () => {
  const kits = [["dumbbell", "bench"], ["kettlebell"], ["band", "pull_up_bar"], []];
  for (const equipment of kits) {
    const settings = { minutes: 30, footCare: true, equipment };
    for (let i = 0; i < 84; i++) {
      for (const opts of [{}, { short: true }, { reroll: 1 }]) {
        const s = buildSessionFor(addDays(monday, i), START, { ...opts, settings });
        for (const ex of s.exercises) assert.ok(canDo(byId(ex.exerciseId), equipment), `${equipment}: ${ex.name}`);
        if (!equipment.includes("rower")) assert.notEqual(s.activity?.type, "row");
        if (!equipment.includes("band")) assert.ok(!/banded/i.test(allText(s)));
        if (!equipment.includes("pull_up_bar")) assert.ok(!/dead hang/i.test(allText(s)));
        if (!equipment.includes("bench")) assert.ok(!/on the bench/i.test(allText(s)));
        const ids = s.exercises.map((e) => e.exerciseId);
        assert.equal(new Set(ids).size, ids.length);
      }
    }
  }
  // dumbbells and a bench are enough for a real main lift on all three lifting days
  const db = { minutes: 30, footCare: false, equipment: ["dumbbell", "bench"] };
  for (const d of [0, 2, 4]) {
    const s = buildSessionFor(day(0, d), START, { settings: db });
    assert.equal(s.exercises[0].loadType, "dumbbell", s.exercises[0].name);
    assert.ok(s.exercises.length >= 3);
  }
});

test("no exercise repeats within a session, and none repeats as an accessory in the same week", () => {
  for (let w = 0; w < 12; w++) {
    const weekAccessories = [];
    for (const d of [0, 2, 4]) {
      const s = buildSessionFor(day(w, d), START);
      const ids = s.exercises.map((e) => e.exerciseId);
      assert.equal(new Set(ids).size, ids.length, `${s.templateName} week ${w}`);
      weekAccessories.push(...s.exercises.filter((e) => e.role === "accessory").map((e) => e.exerciseId));
    }
    assert.equal(new Set(weekAccessories).size, weekAccessories.length, `week ${w}`);
  }
});

test("Sunday reroll deals something different; swim only shows up in summer", () => {
  const a = buildSessionFor(day(0, 6), START);
  const b = buildSessionFor(day(0, 6), START, { reroll: 1 });
  assert.notEqual(a.surpriseId, b.surpriseId);
  for (let w = 0; w < 12; w++) {
    for (const d of [3, 5, 6]) {
      const s = buildSessionFor(day(w, d), START); // Nov to Jan
      assert.notEqual(s.activity?.type, "swim");
    }
  }
  const june = fromKey("2026-06-01");
  let swims = 0;
  for (let i = 0; i < 28; i++) if (buildSessionFor(addDays(june, i), "2026-06-01").activity?.type === "swim") swims++;
  assert.ok(swims > 0);
});

test("program data only references real exercises; form guides too", () => {
  const ids = [];
  for (const d of Object.values(LIFT_DAYS)) ids.push(...d.main, ...d.second, ...d.accessories.flat(), ...d.finisher);
  for (const f of CORE_FORMATS) ids.push(...f.slots.flat());
  ids.push(...Object.keys(FORM_GUIDES));
  for (const id of ids) assert.ok(byId(id), id);
  assert.equal(FORMATS.length, 3);
});

test("swap keeps the role and scheme", () => {
  const s = buildSessionFor(day(1, 0), START);
  const swapped = swapExercise(s.exercises[0], "ex_box_squat");
  assert.equal(swapped.role, "main");
  assert.equal(swapped.sets.length, s.exercises[0].sets.length);
  assert.equal(swapped.targetReps, s.exercises[0].targetReps);
});

test("old saved sessions with string warm-ups still load", () => {
  const n = normalizeSession({ warmup: ["Cat-cow"], cooldown: ["Pigeon"], exercises: [] });
  assert.deepEqual(n.warmup, [{ text: "Cat-cow", done: false }]);
});

// ─── progression ──────────────────────────────────────────────────────────────

const logged = (exerciseId, targetReps, sets, feel, extra = {}) => ({
  id: "x", date: "2026-11-02T12:00:00.000Z", exercises: [{
    exerciseId, name: byId(exerciseId).name, category: byId(exerciseId).category, targetReps, feel,
    sets: sets.map(([weight, reps], i) => ({ setNum: i + 1, weight: String(weight), reps: String(reps), done: true })),
  }], ...extra,
});
const target = (exerciseId, loadType, targetReps, targetRir = 2) => ({ exerciseId, loadType, targetReps, targetRir });

test("progression: first time gives no suggestion", () => {
  assert.equal(suggestWeight(target("ex_back_squat", "barbell", 5), []), null);
});

test("progression: same rep target", () => {
  const five = (w, reps, feel) => [logged("ex_back_squat", 5, Array(5).fill(0).map((_, i) => [w, reps[i] ?? reps[0]]), feel)];
  const t = target("ex_back_squat", "barbell", 5);
  assert.equal(suggestWeight(t, five(100, [5], "good")).weight, 105);
  assert.equal(suggestWeight(t, five(100, [5], "easy")).weight, 110);
  assert.equal(suggestWeight(t, five(100, [5], "hard")).weight, 100);
  assert.equal(suggestWeight(t, five(100, [5, 5, 5, 4, 4], "good")).weight, 100);
  assert.equal(suggestWeight(t, five(100, [5, 4, 3, 3, 3], "hard")).weight, 95);
  assert.equal(suggestWeight(t, five(100, [5], null)).weight, 105);
});

test("progression: a different rep target gives a lighter or heavier estimate, rounded down to 5", () => {
  const hist = [logged("ex_back_squat", 5, Array(5).fill([100, 5]), "good")];
  const eight = suggestWeight(target("ex_back_squat", "barbell", 8), hist);
  const ten = suggestWeight(target("ex_back_squat", "barbell", 10, 3), hist);
  assert.ok(eight.weight < 100 && eight.weight >= 85, String(eight.weight));
  assert.ok(ten.weight < eight.weight, `${ten.weight} < ${eight.weight}`);
  assert.equal(eight.weight % 5, 0);
  const back = suggestWeight(target("ex_back_squat", "barbell", 5),
    [logged("ex_back_squat", 8, Array(4).fill([90, 8]), "good")]);
  assert.ok(back.weight > 90);
});

test("progression: equipment limits", () => {
  // never below the 35 lb bar
  const light = [logged("ex_barbell_ohp", 5, Array(3).fill([35, 5]), "hard")];
  assert.equal(suggestWeight(target("ex_barbell_ohp", "barbell", 10, 3), light, { barWeight: 35 }).weight, 35);
  assert.equal(suggestWeight(target("ex_barbell_ohp", "barbell", 10, 3), light).weight, 45);
  // dumbbells stop at 55
  const top = [logged("ex_db_flat_press", 8, Array(3).fill([55, 8]), "easy")];
  const s = suggestWeight(target("ex_db_flat_press", "dumbbell", 8), top);
  assert.equal(s.weight, 55);
  assert.match(s.basis, /rep/);
  // kettlebells keep the same bell
  const kb = [logged("ex_goblet_squat", 10, Array(3).fill([40, 10]), "good")];
  assert.equal(suggestWeight(target("ex_goblet_squat", "kettlebell", 10), kb).weight, 40);
  // bodyweight gets none
  assert.equal(suggestWeight(target("ex_ring_rows", "body", 8), kb), null);
});

test("progression: history from the first version of the app (no feel, no target) still works", () => {
  const old = [{ id: "o", date: "2026-04-01T12:00:00.000Z", templateId: "session_a", exercises: [{
    exerciseId: "ex_back_squat", name: "Back Squat", category: "squat", isAnchor: true,
    sets: [1, 2, 3].map((n) => ({ setNum: n, weight: "95", reps: "5", done: true })),
  }] }];
  const s = suggestWeight(target("ex_back_squat", "barbell", 5), old);
  assert.ok(s.weight >= 90 && s.weight <= 100, String(s.weight));
});

test("applySuggestions prefills weights and ramp-up sets read from them", () => {
  const hist = [logged("ex_back_squat", 5, Array(5).fill([135, 5]), "good")];
  const s = applySuggestions(buildSessionFor(day(0, 0), START, { settings: { ...ME, minutes: 45 } }), hist, { barWeight: 35 });
  assert.equal(s.exercises[0].sets[0].weight, "140");
  assert.match(rampUpSets(s.exercises[0], 35)[0], /Empty bar \(35 lb\) × 8, then 70 × 5, then 105 × 3/);
  assert.equal(s.exercises[1].sets[0].weight, ""); // no history for the press yet
});

// ─── stats ────────────────────────────────────────────────────────────────────

const entry = (dayKey, extra = {}) => ({ id: dayKey + Math.random(), dayKey, date: fromKey(dayKey).toISOString(), exercises: [], ...extra });

test("streak counts back from today, and forgives an empty today", () => {
  const s = [entry("2026-11-09"), entry("2026-11-10"), entry("2026-11-11")];
  assert.equal(streak(s, fromKey("2026-11-11")), 3);
  assert.equal(streak(s, fromKey("2026-11-12")), 3);
  assert.equal(streak(s, fromKey("2026-11-13")), 0);
  assert.equal(streak([], fromKey("2026-11-13")), 0);
});

test("weekly totals: hard minutes count double, yoga is not aerobic, strength days need real lifting", () => {
  const lift = { ...buildSessionFor(day(0, 0), START, { settings: { ...ME, minutes: 45 } }) };
  lift.exercises = lift.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, weight: "50", done: true })) }));
  const s = [
    lift,
    entry("2026-11-10", { templateName: "Walk", activity: { type: "walk", minutes: 30 } }),
    entry("2026-11-11", { templateName: "Row", activity: { type: "row", minutes: 20, hard: true } }),
    entry("2026-11-12", { templateName: "Yoga", activity: { type: "yoga", minutes: 30 } }),
    entry("2026-11-16", { templateName: "Walk", activity: { type: "walk", minutes: 99 } }), // next week
  ];
  assert.equal(aerobicMinutesOf(s[2]), 40);
  assert.ok(isStrengthEntry(lift));
  const w = weekSummary(s, monday);
  assert.equal(w.aerobicMinutes, 70);
  assert.equal(w.strengthDays, 1);
  assert.equal(w.activeDays, 4);
  assert.equal(w.setsByPattern.squat, 5);
  const recap = weekRecap(s, monday, fromKey("2026-11-12"));
  assert.match(recap, /Moved 4 of 7 days/);
  assert.match(recap, /Aerobic minutes: 70/);
  assert.ok(!recap.includes("—"));
});

// ─── evidence ─────────────────────────────────────────────────────────────────

test("every principle cites real sources, every source is used, and session 'why' ids resolve", () => {
  const used = new Set();
  for (const p of PRINCIPLES) for (const k of p.sources) { assert.ok(SOURCES[k], k); used.add(k); }
  for (const k of Object.keys(SOURCES)) assert.ok(used.has(k), `unused source ${k}`);
  for (const s of Object.values(SOURCES)) assert.match(s.doi, /^10\.\d{4,}\//);
  const ids = new Set(PRINCIPLES.map((p) => p.id));
  for (let i = 0; i < 21; i++) {
    for (const id of buildSessionFor(addDays(monday, i), START).why || []) assert.ok(ids.has(id), id);
  }
});

test("no em dashes in the new copy", () => {
  const blob = JSON.stringify(PRINCIPLES) + JSON.stringify(
    Array.from({ length: 42 }, (_, i) => buildSessionFor(addDays(monday, i), START)).map((s) => [allText(s), s.format, s.templateName, s.optional, s.flowNote])
  );
  assert.ok(!blob.includes("—"));
});
