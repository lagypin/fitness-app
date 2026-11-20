// ─── The program ──────────────────────────────────────────────────────────────
//
// Everything here is deterministic: the same date always produces the same
// session, so the app opens to a workout that is ready to go.
//
// Three clocks drive the variety (see evidence.js for the sources):
//   week   -> format rotates Heavy, Volume, Density (a 3-week wave)
//   wave   -> accessory exercises change every 3 weeks
//   block  -> main lifts change every 6 weeks
//
// Weekly split: Mon Push · Tue Cardio + core · Wed Pull · Thu open · Fri Hinge ·
// Sat open · Sun open. Open days plan nothing: walk, yoga, a swim, or rest.
//
// Settings (see DEFAULT_SETTINGS) adapt the plan to the person: minutes per
// day, the equipment they own, bar weight, and outdoor options (hikes, summer
// swims). Each day can also be built at a different length (Short, 30, or 45)
// than the Settings default.
// ──────────────────────────────────────────────────────────────────────────────

import { EXERCISES, byId, loadTypeOf, repUnitOf } from "../exercises.js";
import { dayIndex, toKey, weekIndexFor } from "./dates.js";

const uid = () => Math.random().toString(36).slice(2, 9);

export const DAY_PLAN = [
  { key: "push",     name: "Push",     kind: "lift",     emoji: "💪", blurb: "Squat + press" },
  { key: "core",     name: "Cardio + core", kind: "core", emoji: "🔥", blurb: "Cardio + trunk work" },
  { key: "pull",     name: "Pull",     kind: "lift",     emoji: "🧗", blurb: "Rows + pull-ups" },
  { key: "open",     name: "Open day", kind: "open",     emoji: "🌈", blurb: "Walk, yoga, a swim, or rest" },
  { key: "hinge",    name: "Hinge",    kind: "lift",     emoji: "⚡", blurb: "Deadlift + press" },
  { key: "open",     name: "Open day", kind: "open",     emoji: "🌈", blurb: "Walk, yoga, a swim, or rest" },
  { key: "open",     name: "Open day", kind: "open",     emoji: "🌈", blurb: "Walk, yoga, a swim, or rest" },
];

/** The one line shown on an open day. */
export const OPEN_DAY_NOTE = "Walk, yoga, a swim, or rest. Log whatever you do below.";

// ─── Formats (the weekly wave) ────────────────────────────────────────────────
// rir = reps in reserve: how many more good reps you could have done.

export const FORMATS = [
  {
    id: "heavy", name: "Heavy",
    tagline: "Heavier weight, fewer reps, long rests",
    main:      { sets: 5, reps: 5,  rir: 2, rest: 150 },
    second:    { sets: 3, reps: 5,  rir: 2, rest: 120 },
    accessory: { sets: 2, reps: 8,  rir: 2, rest: 60, style: "pair" },
    finisher:  null,
  },
  {
    id: "volume", name: "Volume",
    tagline: "Moderate weight, more reps, supersets",
    main:      { sets: 4, reps: 8,  rir: 2, rest: 120 },
    second:    { sets: 3, reps: 8,  rir: 2, rest: 90 },
    accessory: { sets: 3, reps: 10, rir: 2, rest: 60, style: "pair" },
    finisher:  { sets: 2, rest: 30 },
  },
  {
    id: "density", name: "Density",
    tagline: "Lighter weight, steady pace, circuit finish",
    main:      { sets: 3, reps: 10, rir: 3, rest: 90 },
    second:    { sets: 3, reps: 10, rir: 3, rest: 75 },
    accessory: { sets: 3, reps: 12, rir: 2, rest: 45, style: "circuit" },
    finisher:  { sets: 3, rest: 0, inCircuit: true },
  },
];

// Deadlifts get fewer reps per set than other main lifts.
const HINGE_MAIN = {
  heavy:   { sets: 5, reps: 5 },
  volume:  { sets: 4, reps: 6 },
  density: { sets: 4, reps: 8 },
};

// Bodyweight lifts where a fixed rep target makes little sense.
const MAX_MINUS_TWO = new Set(["ex_pull_ups"]);

// ─── Cool-down stretches ──────────────────────────────────────────────────────
// Moves with a `url` link to their page in the ACE exercise library. `family`
// groups stretches that work the same muscles, so a session never holds two.

const ACE = "https://www.acefitness.org/resources/everyone/exercise-library";
const move = (text, acePath, family) => ({ text, ...(acePath ? { url: `${ACE}/${acePath}/` } : {}), ...(family ? { family } : {}) });

const MOVES = {
  // static, 60 seconds in total per stretch
  hipFlexor:       move("Kneeling hip-flexor stretch: 2 × 30 sec each side", "142/kneeling-hip-flexor-stretch", "hips"),
  pigeon:          move("Pigeon pose: 2 × 30 sec each side", null, "hips"),
  downDog:         move("Downward-facing dog: 2 × 30 sec", "18/downward-facing-dog"),
  childsPose:      move("Child's pose: 60 sec", "227/childs-pose"),
  latStretch:      move("Kneeling lat stretch on the bench: 2 × 30 sec", "141/kneeling-lat-stretch-w-bench", "lats"),
  latStretchFloor: move("90 lat stretch: 2 × 30 sec each side", "198/90-lat-stretch", "lats"),
  triceps:         move("Overhead triceps stretch: 2 × 30 sec each side", "174/overhead-triceps-stretch"),
  chestStretch:    move("Standing chest stretch: 2 × 30 sec", "209/standing-chest-stretch"),
};

// ─── Lift-day warm-up and cool-down ───────────────────────────────────────────
// The warm-up is a few minutes of easy rowing (or walking), then lighter sets
// of the lifts themselves (see rampUpSets and secondLiftWarmup in
// progression.js). The cool-down is one static stretch per main or second lift.
// Lists are ordered: the first entry is preferred, the rest are used when an
// earlier lift in the same session already took it or its family. Lifts that
// are not listed (equipment fallbacks) use their movement pattern's entry.

export const WARMUP_ROW_MIN = { full: 3, short: 2 };

const LIFT_PREP = {
  ex_back_squat:            { stretch: [MOVES.hipFlexor, MOVES.pigeon] },
  ex_front_squat:           { stretch: [MOVES.hipFlexor, MOVES.pigeon] },
  ex_barbell_bench:         { stretch: [MOVES.chestStretch, MOVES.triceps] },
  ex_barbell_ohp:           { stretch: [MOVES.triceps, MOVES.chestStretch] },
  ex_barbell_row:           { stretch: [MOVES.latStretch, MOVES.childsPose] },
  ex_ring_rows:             { stretch: [MOVES.latStretch, MOVES.childsPose] },
  ex_db_single_arm_row:     { stretch: [MOVES.latStretch, MOVES.childsPose] },
  ex_pull_ups:              { stretch: [MOVES.latStretch, MOVES.childsPose] },
  ex_conventional_deadlift: { stretch: [MOVES.downDog, MOVES.pigeon] },
  ex_sumo_deadlift:         { stretch: [MOVES.pigeon, MOVES.downDog] },
};

const PATTERN_PREP = {
  squat: LIFT_PREP.ex_back_squat,
  press: LIFT_PREP.ex_barbell_ohp,
  pull:  LIFT_PREP.ex_barbell_row,
  hinge: LIFT_PREP.ex_conventional_deadlift,
};

const prepFor = (id) => LIFT_PREP[id] || PATTERN_PREP[byId(id)?.category] || PATTERN_PREP.squat;

/**
 * One cool-down stretch per lift, in lift order, with no repeats and never two
 * from the same family (so never two lat stretches). The bench lat stretch
 * needs a bench; without one the floor version stands in.
 */
export function liftStretches(ids, gear) {
  const adapt = (m) => (m === MOVES.latStretch && !gear.includes("bench") ? MOVES.latStretchFloor : m);
  const out = [];
  const taken = (m) => out.includes(m) || (m.family && out.some((o) => o.family === m.family));
  for (const id of ids) {
    const st = prepFor(id).stretch.map(adapt).find((m) => !taken(m));
    if (st) out.push(st);
  }
  return out;
}

/** The easy cardio that opens a lifting day. */
export function warmupRow(settings, short = false) {
  const minutes = WARMUP_ROW_MIN[short ? "short" : "full"];
  const text = settings.equipment.includes("rower")
    ? `Easy row: ${minutes} min, easy enough to chat`
    : `Brisk walk or march in place: ${minutes} min`;
  return { text, minutes };
}

// ─── Lifting days ─────────────────────────────────────────────────────────────
// main / second: [block A, block B]. Accessories and finishers rotate by wave.

export const LIFT_DAYS = {
  push: {
    main:   ["ex_back_squat", "ex_front_squat"],
    second: ["ex_barbell_bench", "ex_barbell_ohp"],
    accessories: [
      ["ex_face_pull", "ex_kb_single_arm_row", "ex_incline_reverse_fly", "ex_landmine_row"],
      ["ex_kb_rdl", "ex_hip_thrust", "ex_single_leg_rdl", "ex_step_up"],
    ],
    heavyAccessory: 1, // hinge accessory: the pattern with the fewest sets otherwise
    finisher: ["ex_dead_bug", "ex_plank", "ex_hollow_body"],
  },
  pull: {
    main:   ["ex_barbell_row", "ex_ring_rows"],
    second: ["ex_pull_ups", "ex_db_single_arm_row"],
    accessories: [
      ["ex_bulgarian_split_squat", "ex_landmine_squat", "ex_goblet_squat", "ex_box_squat"],
      ["ex_db_incline_press", "ex_landmine_press", "ex_lateral_raise", "ex_ring_pushups"],
    ],
    heavyAccessory: 0, // squat accessory
    finisher: ["ex_side_plank", "ex_pallof_press", "ex_bird_dog"],
  },
  hinge: {
    main:   ["ex_conventional_deadlift", "ex_sumo_deadlift"],
    second: ["ex_barbell_ohp", "ex_barbell_bench"],
    accessories: [
      ["ex_rear_delt_fly", "ex_face_pull", "ex_hammer_curl", "ex_kb_single_arm_row"],
      ["ex_goblet_squat", "ex_bulgarian_split_squat", "ex_lateral_lunge", "ex_landmine_squat"],
    ],
    heavyAccessory: 0, // pull accessory
    finisher: ["ex_suitcase_carry", "ex_copenhagen_plank", "ex_overhead_carry"],
  },
};

// ─── Core day ─────────────────────────────────────────────────────────────────

export const CORE_FORMATS = [
  {
    id: "carry", name: "Carries + anti-rotation",
    tagline: "Straight sets, rest about 45 sec",
    style: "straight", sets: 3, rest: 45,
    slots: [
      ["ex_suitcase_carry", "ex_farmer_carry"],
      ["ex_pallof_press", "ex_kb_windmill"],
      ["ex_dead_bug", "ex_bird_dog"],
      ["ex_side_plank", "ex_copenhagen_plank"],
    ],
  },
  {
    id: "circuit", name: "Circuit",
    tagline: "3 rounds, rest a minute between rounds",
    style: "circuit", sets: 3, rest: 60,
    slots: [
      ["ex_plank", "ex_ring_body_saw"],
      ["ex_bird_dog", "ex_dead_bug"],
      ["ex_slider_knee_tucks", "ex_slider_mountain_climbers"],
      ["ex_overhead_carry", "ex_suitcase_carry"],
    ],
  },
  {
    id: "emom", name: "On the minute",
    tagline: "12 minutes: start one move each minute, rest for what's left of it",
    style: "emom", sets: 3, rest: 0,
    slots: [
      ["ex_hollow_body", "ex_plank"],
      ["ex_slider_pikes", "ex_slider_knee_tucks"],
      ["ex_pallof_press", "ex_dead_bug"],
      ["ex_farmer_carry", "ex_overhead_carry"],
    ],
  },
];

// ─── Tuesday cardio ───────────────────────────────────────────────────────────
// The cardio rotates weekly through intervals, steady, and tempo. On a rower
// when the person has one, otherwise a brisk walk. Minutes depend on the
// day's length; `build` returns the checklist and whether the effort is hard.
// Intervals and tempo count as hard (vigorous) minutes; steady does not.

export const CARDIO_MINUTES = { short: 10, 30: 15, 45: 25 };

export const CARDIO_TYPES = [
  {
    id: "intervals", name: "Intervals", hard: true,
    tagline: "Short hard efforts with easy minutes between",
    build: (verb, minutes) => {
      const easyIn = minutes >= 15 ? 3 : 2;
      const easyOut = 2;
      const rounds = Math.floor((minutes - easyIn - easyOut) / 2);
      return [`Easy ${verb}: ${easyIn} min`, `${rounds} rounds: 1 min hard, 1 min easy`, `Easy ${verb}: ${easyOut} min`];
    },
  },
  {
    id: "steady", name: "Steady", hard: false,
    tagline: "One pace you could hold a conversation at",
    build: (verb, minutes) => [`${cap(verb)} ${minutes} min at a pace you could talk through`],
  },
  {
    id: "tempo", name: "Tempo", hard: true,
    tagline: "Comfortably hard, held for the middle block",
    build: (verb, minutes) => {
      const easyIn = minutes >= 15 ? 3 : 2;
      const easyOut = 2;
      return [`Easy ${verb}: ${easyIn} min`, `${cap(verb)} ${minutes - easyIn - easyOut} min at a pace where talking takes effort`, `Easy ${verb}: ${easyOut} min`];
    },
  },
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Activities (walks, rows, swims...) ───────────────────────────────────────

export const ACTIVITIES = {
  walk:  { label: "Walk",  emoji: "🚶", minutes: 30, aerobic: true },
  hike:  { label: "Hike",  emoji: "🥾", minutes: 60, aerobic: true },
  swim:  { label: "Swim",  emoji: "🏊", minutes: 30, aerobic: true },
  row:   { label: "Row",   emoji: "🚣", minutes: 20, aerobic: true },
  yoga:  { label: "Yoga",  emoji: "🧘", minutes: 30, aerobic: false },
  other: { label: "Other", emoji: "✨", minutes: 20, aerobic: true },
};

/** Outdoor pool season in Ann Arbor is roughly June through August. */
export const seasonOf = (date) => {
  const m = date.getMonth();
  if (m >= 5 && m <= 7) return "summer";
  if (m === 11 || m <= 1) return "winter";
  return "shoulder";
};

/** Is this activity allowed by the person's settings? Hikes off removes every hike; swims off removes every swim. */
export const outdoorOk = (type, settings) =>
  !(type === "hike" && !settings.hikes) && !(type === "swim" && !settings.swims);

/** The activities offered for quick logging, with hikes and swims filtered by the Outdoor options. */
export const activityMenu = (settings) =>
  Object.fromEntries(Object.entries(ACTIVITIES).filter(([type]) => outdoorOk(type, withDefaults(settings))));

// ─── Settings ─────────────────────────────────────────────────────────────────

export const EQUIPMENT = [
  { id: "barbell",     label: "Barbell + plates" },
  { id: "dumbbell",    label: "Dumbbells" },
  { id: "kettlebell",  label: "Kettlebells" },
  { id: "bench",       label: "Bench" },
  { id: "pull_up_bar", label: "Pull-up bar" },
  { id: "rings",       label: "Gymnastic rings" },
  { id: "landmine",    label: "Landmine" },
  { id: "band",        label: "Resistance bands" },
  { id: "sliders",     label: "Core sliders" },
  { id: "box",         label: "Box or sturdy step" },
  { id: "rower",       label: "Rowing machine" },
];

export const DEFAULT_SETTINGS = {
  minutes: 30,          // 30 or 45 per day
  barWeight: 45,        // lb
  equipment: EQUIPMENT.map((e) => e.id),
  hikes: false,         // Outdoor options: suggest hikes
  swims: true,          // Outdoor options: suggest swims in summer
  setupDone: false,
};

/** The lengths a single day can be built at. Short is about 10 to 20 minutes. */
export const LENGTHS = ["short", 30, 45];

/** Fill in defaults. The foot-care setting from versions 2.0 and 2.1 is dropped here, so the next save removes it. */
export const withDefaults = (settings) => {
  const { footCare, ...rest } = settings || {};
  return { ...DEFAULT_SETTINGS, ...rest };
};

const ALWAYS_AVAILABLE = new Set(["bodyweight", "step", "foam_roller"]);

/** Can this exercise be done with the equipment the person has? */
export const canDo = (ex, equipment) =>
  (ex.equipment || []).every((e) => ALWAYS_AVAILABLE.has(e) || equipment.includes(e));

/**
 * Pick the exercise for a slot: the planned one for this point in the rotation
 * if the person has the gear, otherwise the next one in the list they can do,
 * otherwise anything suitable from the same category.
 */
export function chooseExercise(list, index, equipment, used, { anchor = false } = {}) {
  const n = list.length;
  const ok = (id) => byId(id) && canDo(byId(id), equipment) && !used.has(id);
  for (let k = 0; k < n; k++) {
    const id = list[(((index + k) % n) + n) % n];
    if (ok(id)) return id;
  }
  const category = byId(list[0])?.category;
  if (anchor) {
    const next = (MAIN_FALLBACKS[category] || []).find(ok);
    if (next) return next;
  }
  const pool = EXERCISES.filter((e) => e.category === category && canDo(e, equipment) && !used.has(e.id));
  if (!pool.length) return null;
  const score = (e) => (anchor && e.isAnchor ? 4 : 0) + (loadTypeOf(e) !== "body" ? 2 : 0) + (repUnitOf(e) === "reps" ? 1 : 0);
  return [...pool].sort((a, b) => score(b) - score(a))[0].id;
}

// Main-lift substitutes, best first, for people without a barbell or rack.
const MAIN_FALLBACKS = {
  squat: ["ex_db_goblet_squat", "ex_goblet_squat", "ex_landmine_squat", "ex_bulgarian_split_squat", "ex_bodyweight_squat"],
  hinge: ["ex_romanian_deadlift", "ex_db_rdl", "ex_kb_deadlift", "ex_kb_rdl", "ex_hip_thrust", "ex_single_leg_glute_bridge"],
  press: ["ex_db_flat_press", "ex_db_overhead_press", "ex_landmine_press", "ex_ring_pushups", "ex_push_up"],
  pull:  ["ex_db_single_arm_row", "ex_kb_single_arm_row", "ex_landmine_row", "ex_chin_ups", "ex_face_pull", "ex_band_bicep_curl"],
};

// ─── Shared pieces ────────────────────────────────────────────────────────────

// Apple Watch workout type to start alongside each kind of session.
// A web app cannot read Apple Health, so the watch records on its own.
const WATCH = {
  lift: "Traditional Strength Training",
  core: "Core Training",
  mobility: "Flexibility", // sessions saved by version 2.1
  walk: "Outdoor Walk", hike: "Hiking", swim: "Pool Swim", row: "Rower", yoga: "Yoga",
  other: "Other",
};
export const watchWorkoutFor = (session) => {
  const cardio = session.cardio?.length && session.activity ? WATCH[session.activity.type] || WATCH.other : null;
  let rest;
  if (session.exercises?.length) rest = session.kind === "core" ? WATCH.core : WATCH.lift;
  else if (session.kind === "mobility") rest = WATCH.mobility;
  else rest = WATCH[session.activity?.type] || WATCH.other;
  return cardio && cardio !== rest ? `${cardio}, then ${rest}` : cardio || rest;
};

const check = (items) =>
  items.map((item) => (typeof item === "string"
    ? { text: item, done: false }
    : { text: item.text, url: item.url, ...(item.minutes ? { minutes: item.minutes } : {}), done: false }));

function pick(list, i) {
  return list[((i % list.length) + list.length) % list.length];
}

const roundTo5 = (n) => Math.round(n / 5) * 5;

/** Where a date falls on the three clocks. */
export function clocks(date, programStart) {
  const weekIndex = weekIndexFor(date, programStart);
  return {
    weekIndex,
    formatIndex: weekIndex % 3,
    waveIndex: Math.floor(weekIndex / 3),
    blockIndex: Math.floor(weekIndex / 6) % 2,
    weekInBlock: (weekIndex % 6) + 1,
  };
}

/** Build one exercise entry from a library id, a role, and a set/rep spec. */
export function makeExercise(id, role, spec, group = null) {
  const ex = byId(id);
  if (!ex) throw new Error(`Unknown exercise: ${id}`);
  const loadType = loadTypeOf(ex);
  const unit = repUnitOf(ex);
  const isBig = role === "main" || role === "second";

  let targetReps = null;
  let repsLabel;
  if (MAX_MINUS_TWO.has(id)) {
    repsLabel = "max minus 2";
  } else if (unit !== "reps") {
    repsLabel = ex.defaultReps;                 // holds and carries keep their own dose
  } else if (loadType === "body" && !isBig) {
    targetReps = parseInt(ex.defaultReps, 10);  // bands and bodyweight keep their own dose
    repsLabel = ex.defaultReps;
  } else {
    targetReps = spec.reps;
    repsLabel = String(spec.reps);
  }

  const prefill = targetReps ? String(targetReps) : unit !== "reps" ? ex.defaultReps : "";

  return {
    exerciseId: id,
    name: ex.name,
    category: ex.category,
    isAnchor: isBig,
    role,
    group,
    notes: ex.notes,
    loadType,
    unit,
    targetReps,
    repsLabel,
    targetRir: spec.rir ?? 2,
    restSec: spec.rest ?? 60,
    feel: null,
    sets: Array.from({ length: spec.sets }, (_, i) => ({
      setNum: i + 1, weight: "", reps: prefill, done: false,
    })),
  };
}

const WORK_SEC = { main: 45, second: 45, accessory: 35, finisher: 35, core: 35 };

/**
 * Rough session length in minutes, not counting the cardio or activity minutes
 * (those live in session.activity). Checklist items with their own `minutes`
 * (a guided class) count at face value.
 */
export function estimateMinutes(session) {
  let sec = 0;
  const itemSec = (item, fallback) => (item.minutes ? item.minutes * 60 : fallback);
  for (const item of session.warmup || []) sec += itemSec(item, session.kind === "mobility" ? 80 : 55);
  for (const item of (session.cooldown || []).filter((i) => !i.optional)) sec += itemSec(item, 80);
  if (session.rampUp) sec += 150;
  if (session.rampUp && (session.exercises || []).some((e) => e.role === "second")) sec += 45;
  const groups = new Map();
  for (const ex of session.exercises || []) {
    const sets = ex.sets.length;
    const work = WORK_SEC[ex.role] || 35;
    if (ex.group) {
      const g = groups.get(ex.group) || { sets, work: 0, rest: ex.restSec };
      g.work += work;
      groups.set(ex.group, g);
    } else {
      sec += sets * (work + ex.restSec);
    }
  }
  for (const g of groups.values()) sec += g.sets * (g.work + g.rest);
  return Math.max(1, Math.round(sec / 60));
}

function baseSession(date, programStart, plan) {
  const c = clocks(date, programStart);
  return {
    id: uid(),
    kind: plan.kind,
    templateId: plan.key,
    templateName: plan.name,
    emoji: plan.emoji,
    date: date.toISOString(),
    dayKey: toKey(date),
    weekIndex: c.weekIndex,
    exercises: [],
    warmup: [],
    cooldown: [],
    completed: false,
  };
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildLift(date, programStart, plan, { short = false, settings }) {
  const c = clocks(date, programStart);
  const format = FORMATS[c.formatIndex];
  const day = LIFT_DAYS[plan.key];
  const s = baseSession(date, programStart, plan);
  const compact = settings.minutes < 45;
  const gear = settings.equipment;

  let mainSpec = plan.key === "hinge" ? { ...format.main, ...HINGE_MAIN[format.id] } : { ...format.main };
  if (compact) mainSpec.sets = Math.min(mainSpec.sets, format.id === "density" ? 3 : 4);

  s.format = { id: format.id, name: format.name, tagline: format.tagline };
  s.blockNote = `Week ${c.weekInBlock} of 6 with these main lifts`;
  s.rampUp = true;
  s.why = ["variety", "load", "failure", "rest", "warmup"];
  s.cooldownTitle = "Cool-down";

  const used = new Set();
  const take = (list, index, role, spec, group, opts) => {
    const id = chooseExercise(list, index, gear, used, opts);
    if (!id) return null;
    used.add(id);
    return makeExercise(id, role, spec, group);
  };

  const main = take(day.main, c.blockIndex, "main", mainSpec, null, { anchor: true });

  // The warm-up is easy rowing, then lighter sets of the lifts themselves (shown
  // on each lift's card). The cool-down stretches follow the lifts actually chosen.
  const prepFrom = (lifts) => {
    s.warmup = check([warmupRow(settings, short)]);
    s.cooldown = check(liftStretches(lifts.filter(Boolean).map((e) => e.exerciseId), gear));
  };

  if (short) {
    s.short = true;
    s.templateName = `${plan.name} (short)`;
    s.exercises = [main && { ...main, sets: main.sets.slice(0, 3) }].filter(Boolean);
    prepFrom([main]);
    s.estMinutes = estimateMinutes(s);
    return s;
  }

  let rest;
  if (!compact) {
    // 45 minutes: second lift on its own, accessories paired, optional finisher.
    const groupName = format.accessory.style === "circuit" ? "Circuit" : "Superset";
    rest = [
      take(day.second, c.blockIndex, "second", format.second, null, { anchor: true }),
      ...day.accessories.map((list) => take(list, c.waveIndex, "accessory", format.accessory, groupName)),
    ];
    if (format.finisher) {
      rest.push(take(day.finisher, c.waveIndex, "finisher",
        { sets: format.finisher.sets, rest: format.finisher.inCircuit ? format.accessory.rest : format.finisher.rest },
        format.finisher.inCircuit ? groupName : null));
    }
  } else if (format.id === "heavy") {
    // 30 minutes, Heavy: the second lift keeps a real rest by pairing with one accessory.
    const pair = { rest: 90 };
    rest = [
      take(day.second, c.blockIndex, "second", { ...format.second, ...pair }, "Superset", { anchor: true }),
      take(day.accessories[day.heavyAccessory], c.waveIndex, "accessory", { ...format.accessory, sets: 3, ...pair }, "Superset"),
    ];
  } else {
    // 30 minutes, Volume and Density: everything after the main lift is one circuit.
    const roundRest = { rest: format.id === "density" ? 45 : 60 };
    rest = [
      take(day.second, c.blockIndex, "second", { ...format.second, ...roundRest }, "Circuit", { anchor: true }),
      ...day.accessories.map((list) => take(list, c.waveIndex, "accessory", { ...format.accessory, ...roundRest }, "Circuit")),
    ];
    if (format.id === "density") rest.push(take(day.finisher, c.waveIndex, "finisher", { sets: 3, ...roundRest }, "Circuit"));
  }

  s.exercises = [main, ...rest].filter(Boolean);
  // With no second lift (equipment too thin), the main lift's alternate stretch fills in.
  const second = rest.find((e) => e && e.role === "second");
  prepFrom([main, second || main]);
  s.estMinutes = estimateMinutes(s);
  return s;
}

/** Tuesday: the week's cardio on the rower (or a brisk walk), then a short core circuit. */
function buildCore(date, programStart, plan, { short = false, settings }) {
  const c = clocks(date, programStart);
  const format = CORE_FORMATS[c.formatIndex];
  const cardio = CARDIO_TYPES[c.weekIndex % CARDIO_TYPES.length];
  const s = baseSession(date, programStart, plan);
  const rower = settings.equipment.includes("rower");
  const length = short ? "short" : settings.minutes;
  const minutes = CARDIO_MINUTES[length] ?? CARDIO_MINUTES[30];

  s.format = { id: `${cardio.id}_${format.id}`, name: `${cardio.name} + ${format.name.toLowerCase()}`, tagline: cardio.tagline };
  s.why = ["cardio", "variety", "who"];
  s.cardioTitle = rower ? `Cardio: ${cardio.name.toLowerCase()} on the rower` : `Cardio: brisk walk, ${cardio.name.toLowerCase()}`;
  s.cardio = check(cardio.build(rower ? "row" : "walk", minutes));
  s.activity = { type: rower ? "row" : "walk", minutes, hard: cardio.hard, options: [rower ? "row" : "walk"] };
  // The cardio is the warm-up, so there is no separate checklist before the core work.

  const group = format.style === "straight" ? null : format.style === "emom" ? "On the minute" : "Circuit";
  const rounds = short || settings.minutes < 45 ? 2 : 3;
  const slotCount = short ? 2 : settings.minutes < 45 || format.style === "straight" ? 3 : 4;
  const slots = format.slots.slice(0, slotCount);
  const used = new Set();
  s.exercises = slots.map((list) => {
    const id = chooseExercise(list, c.waveIndex, settings.equipment, used);
    if (!id) return null;
    used.add(id);
    return makeExercise(id, "core", { sets: rounds, rest: format.style === "emom" ? 25 : format.rest }, group);
  }).filter(Boolean);
  if (short) { s.short = true; s.templateName = `${plan.name} (short)`; }
  s.estMinutes = estimateMinutes(s);
  return s;
}

/** Aerobic activities the easy-cardio padding can be logged as, walks first: rows need a rower, swims are summer only. */
function cardioMenu(date, settings) {
  const menu = Object.keys(ACTIVITIES)
    .filter((t) => ACTIVITIES[t].aerobic && t !== "other")
    .filter((t) => t !== "row" || settings.equipment.includes("rower"))
    .filter((t) => t !== "swim" || seasonOf(date) === "summer")
    .filter((t) => outdoorOk(t, settings));
  return ["walk", ...menu.filter((t) => t !== "walk")];
}

/**
 * Fill a gap of 10 minutes or more with easy cardio, so a 45-minute day is a
 * 45-minute day. Sessions that already have cardio get more of it; lifting days
 * get an easy walk or row to log afterward.
 */
function fillGap(s, date, settings) {
  const planned = s.estMinutes + (s.activity?.minutes || 0);
  const gap = Math.floor((settings.minutes - planned) / 5) * 5;
  if (gap < 10) return s;
  const rower = settings.equipment.includes("rower");
  if (s.activity) {
    // A class or other non-aerobic activity is as long as the person wants it.
    if (!ACTIVITIES[s.activity.type]?.aerobic) return s;
    const more = check([`Easy ${s.activity.type}: ${gap} min more`]);
    if (s.cardio) s.cardio = [...s.cardio, ...more];
    else s.main = [...(s.main || []), ...more];
    s.activity = { ...s.activity, minutes: s.activity.minutes + gap };
  } else {
    s.activity = { type: rower ? "row" : "walk", minutes: gap, hard: false, options: cardioMenu(date, settings) };
    s.optional = `Time left over: finish with an easy ${rower ? "row" : "walk"} of about ${gap} min and log it below.`;
  }
  return s;
}

/** Thursday, Saturday, Sunday: nothing is planned. Whatever gets logged counts, and rest counts too. */
function buildOpen(date, programStart, plan) {
  const s = baseSession(date, programStart, plan);
  s.note = OPEN_DAY_NOTE;
  s.why = ["open", "who"];
  s.estMinutes = 0;
  return s;
}

const BUILDERS = { lift: buildLift, core: buildCore, open: buildOpen };

/**
 * The session planned for a date.
 * options.settings -> the person's settings (minutes, equipment, outdoor options)
 * options.length   -> "short", 30, or 45 for this one day; defaults to settings.minutes
 * options.short    -> the same as length "short" (kept for older callers)
 */
export function buildSessionFor(date, programStart, options = {}) {
  const plan = DAY_PLAN[dayIndex(date)];
  const base = withDefaults(options.settings);
  const length = options.length ?? (options.short ? "short" : base.minutes);
  const short = length === "short";
  const settings = short ? base : { ...base, minutes: length };
  const s = BUILDERS[plan.kind](date, programStart, plan, { ...options, short, settings });
  s.length = length;
  return short || s.kind === "open" ? s : fillGap(s, date, settings);
}

/**
 * Aerobic minutes the plan itself schedules in the week that starts on `monday`:
 * Tuesday's cardio plus any easy cardio that pads a 45-minute lift day. The
 * warm-up row is not counted. Open days plan nothing, so logged walks cover the
 * rest of the 150-minute target. `lengths` maps day keys to a chosen length.
 */
export function plannedAerobicMinutes(monday, programStart, settings, { lengths = {} } = {}) {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = toKey(date);
    const s = buildSessionFor(date, programStart, { settings, length: lengths[key] });
    if (s.activity && ACTIVITIES[s.activity.type]?.aerobic) total += s.activity.minutes;
  }
  return total;
}

/** Rebuild one exercise slot after a swap, keeping its role and set/rep scheme. */
export function swapExercise(current, newId) {
  const spec = {
    sets: current.sets.length,
    reps: current.targetReps ?? 10,
    rir: current.targetRir,
    rest: current.restSec,
  };
  return makeExercise(newId, current.role || "accessory", spec, current.group || null);
}

/**
 * The log entry for a finished session. A lifting session times itself;
 * anything else (and a lift logged much later) uses the planned length. Works
 * for sessions version 2.1 left in progress, mobility and surprise included.
 */
export function completedEntry(active, now = Date.now()) {
  const elapsed = Math.round((now - (active.startedAt || now)) / 60000);
  const lifted = (active.exercises || []).length > 0;
  const planned = (active.estMinutes || 0) + (active.activity?.minutes || 0);
  const durationMin = lifted && elapsed >= 5 && elapsed <= 150 ? elapsed : planned;
  return { ...active, completed: true, completedAt: new Date(now).toISOString(), durationMin };
}

/** Older saved sessions stored warm-ups as plain strings. */
export function normalizeSession(s) {
  if (!s) return s;
  const fix = (list) => (list || []).map((x) => (typeof x === "string" ? { text: x, done: false } : x));
  return {
    ...s, warmup: fix(s.warmup), cooldown: fix(s.cooldown),
    main: s.main ? fix(s.main) : undefined, cardio: s.cardio ? fix(s.cardio) : undefined,
  };
}
