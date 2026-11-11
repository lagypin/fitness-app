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
// Weekly split: Mon Push · Tue Core · Wed Pull · Thu Mobility · Fri Hinge ·
// Sat Mobility · Sun Surprise.
//
// Settings (see DEFAULT_SETTINGS) adapt the plan to the person: minutes per
// day, the equipment they own, bar weight, and an optional foot-care add-on.
// ──────────────────────────────────────────────────────────────────────────────

import { EXERCISES, byId, loadTypeOf, repUnitOf } from "../exercises.js";
import { dayIndex, toKey, weekIndexFor } from "./dates.js";

const uid = () => Math.random().toString(36).slice(2, 9);

export const DAY_PLAN = [
  { key: "push",     name: "Push",     kind: "lift",     emoji: "💪", blurb: "Squat + press" },
  { key: "core",     name: "Core",     kind: "core",     emoji: "🔥", blurb: "Trunk + carries" },
  { key: "pull",     name: "Pull",     kind: "lift",     emoji: "🧗", blurb: "Rows + pull-ups" },
  { key: "mobility", name: "Mobility", kind: "mobility", emoji: "🌸", blurb: "Flow + easy movement" },
  { key: "hinge",    name: "Hinge",    kind: "lift",     emoji: "⚡", blurb: "Deadlift + press" },
  { key: "mobility", name: "Mobility", kind: "mobility", emoji: "🌸", blurb: "Flow + time outside" },
  { key: "surprise", name: "Surprise", kind: "surprise", emoji: "🎲", blurb: "Something different" },
];

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

// ─── Warm-up and stretch moves ────────────────────────────────────────────────
// Moves with a `url` link to their page in the ACE exercise library.

const ACE = "https://www.acefitness.org/resources/everyone/exercise-library";
const move = (text, acePath) => (acePath ? { text, url: `${ACE}/${acePath}/` } : { text });

const MOVES = {
  // dynamic, for warm-ups
  catCow:          move("Cat-cow: 10 reps", "15/cat-cow"),
  bodyweightSquat: move("Bodyweight squat: 10 reps", "135/bodyweight-squat"),
  iytw:            move("Shoulder I-Y-T-W series: 5 of each", "237/shoulder-stability-mobility-series-i-y-t-w-formations"),
  birdDog:         move("Bird-dog: 8 each side", "14/bird-dog"),
  deadHang:        move("Dead hang: 2 × 20 sec"),
  gluteBridge:     move("Single-leg glute bridge: 8 each side", "145/glute-bridge-single-leg-progression"),
  forwardLunge:    move("Forward lunge, bodyweight: 6 each side", "94/forward-lunge"),
  dirtyDog:        move("Dirty dog: 8 each side", "109/dirty-dog"),
  // gentle neck range of motion, slow and inside a comfortable range
  neckNod:         move("Neck flexion and extension: 5 slow reps, comfortable range", "204/neck-flexion-and-extension"),
  neckSide:        move("Lateral neck flexion: 5 slow reps each side", "202/lateral-neck-flexion"),
  // static, for mobility days: 60 seconds in total per stretch
  hipFlexor:       move("Kneeling hip-flexor stretch: 2 × 30 sec each side", "142/kneeling-hip-flexor-stretch"),
  pigeon:          move("Pigeon pose: 2 × 30 sec each side"),
  downDog:         move("Downward-facing dog: 2 × 30 sec", "18/downward-facing-dog"),
  supineTwist:     move("Supine twist: 2 × 30 sec each side"),
  childsPose:      move("Child's pose: 60 sec", "227/childs-pose"),
  latStretch:      move("Kneeling lat stretch on the bench: 2 × 30 sec", "141/kneeling-lat-stretch-w-bench"),
  latStretchFloor: move("90 lat stretch: 2 × 30 sec each side", "198/90-lat-stretch"),
  triceps:         move("Overhead triceps stretch: 2 × 30 sec each side", "174/overhead-triceps-stretch"),
  cobra:           move("Cobra: 2 × 30 sec", "16/cobra"),
  warriorOne:      move("Warrior I: 2 × 30 sec each side", "228/warrior-i"),
};

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
    prep: [MOVES.catCow, MOVES.bodyweightSquat, MOVES.iytw],
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
    prep: [MOVES.catCow, MOVES.birdDog, MOVES.deadHang],
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
    prep: [MOVES.catCow, MOVES.gluteBridge, MOVES.forwardLunge],
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

const CORE_PREP = [MOVES.catCow, MOVES.birdDog, MOVES.dirtyDog];

// ─── Mobility days ────────────────────────────────────────────────────────────

export const MOBILITY_FLOWS = [
  {
    id: "hips_legs", name: "Hips + legs",
    items: [
      move("Optional: foam roll calves and hamstrings, 60 sec each"),
      MOVES.hipFlexor, MOVES.pigeon, MOVES.downDog, MOVES.supineTwist, MOVES.childsPose,
    ],
  },
  {
    id: "back_shoulders", name: "Back + shoulders",
    items: [
      move("Optional: foam roll upper back and lats, 60 sec each"),
      MOVES.catCow, MOVES.neckNod, MOVES.neckSide,
      MOVES.latStretch, MOVES.triceps, MOVES.cobra, MOVES.warriorOne, MOVES.childsPose,
    ],
  },
  {
    id: "class", name: "Guided class",
    items: [move("Pick a guided mobility or yoga class and log its minutes below (Bend and Peloton both work)")],
  },
];

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

const MOVE_MENU = {
  summer:   ["swim", "walk", "hike", "yoga", "row"],
  shoulder: ["walk", "hike", "yoga", "row"],
  winter:   ["yoga", "row", "walk"],
};

// ─── Sunday surprise ──────────────────────────────────────────────────────────
// `needs` lists equipment a surprise requires. `minutes` is capped by the
// person's minutes-per-day setting.

const SURPRISES = {
  row_intervals: {
    name: "Row intervals", emoji: "🚣", needs: ["rower"],
    tagline: "Short hard efforts on the rower",
    checklist: () => ["Easy row: 5 min", "8 rounds: 30 sec hard, 2 min easy", "Easy row: 5 min"],
    activity: { type: "row", minutes: 30, hard: true }, fixed: true,
  },
  steady_row: {
    name: "Steady row", emoji: "🚣", needs: ["rower"],
    tagline: "A pace you could hold a conversation at",
    checklist: (m) => [`Row ${m} min at a pace you could talk through`],
    activity: { type: "row", minutes: 25, hard: false },
  },
  long_walk: {
    name: "Long walk", emoji: "🚶", needs: [],
    tagline: "Any pace, longer if the day allows",
    checklist: (m) => [`Walk ${m} min or more`],
    activity: { type: "walk", minutes: 45, hard: false },
  },
  hike: {
    name: "Hike", emoji: "🥾", needs: [],
    tagline: "Get on a trail",
    checklist: (m) => [`Hike ${m} min or more`],
    activity: { type: "hike", minutes: 60, hard: false },
  },
  swim: {
    name: "Swim", emoji: "🏊", needs: [],
    tagline: "Outside if the sun is out",
    checklist: (m) => [`Swim ${m} min of easy laps, resting at the wall as needed`],
    activity: { type: "swim", minutes: 30, hard: false },
  },
  yoga_class: {
    name: "Yoga class", emoji: "🧘", needs: [],
    tagline: "A longer class than usual",
    checklist: (m) => [`Pick a yoga class of about ${m} min (Peloton, Apple Fitness+, or any you like)`],
    activity: { type: "yoga", minutes: 30, hard: false },
  },
  kb_circuit: {
    name: "Kettlebell circuit", emoji: "🔔", needs: ["kettlebell"],
    tagline: "4 rounds, rest a minute between rounds",
    circuit: { rounds: 4, rest: 60, ids: ["ex_kb_deadlift", "ex_goblet_squat", "ex_kb_single_arm_row", "ex_farmer_carry"] },
  },
  rings_landmine: {
    name: "Rings + landmine", emoji: "⭕", needs: ["rings", "landmine", "barbell"],
    tagline: "3 rounds, rest a minute between rounds",
    circuit: { rounds: 3, rest: 60, ids: ["ex_ring_rows", "ex_landmine_squat", "ex_landmine_press", "ex_ring_body_saw"] },
  },
  bodyweight_circuit: {
    name: "Bodyweight circuit", emoji: "🤸", needs: [],
    tagline: "4 rounds, rest a minute between rounds",
    circuit: { rounds: 4, rest: 60, ids: ["ex_bodyweight_squat", "ex_push_up", "ex_single_leg_glute_bridge", "ex_plank"] },
  },
};

const SURPRISE_MENU = {
  summer:   ["swim", "kb_circuit", "hike", "row_intervals", "rings_landmine", "long_walk", "bodyweight_circuit", "yoga_class"],
  shoulder: ["kb_circuit", "hike", "row_intervals", "long_walk", "rings_landmine", "steady_row", "bodyweight_circuit", "yoga_class"],
  winter:   ["row_intervals", "kb_circuit", "yoga_class", "rings_landmine", "steady_row", "bodyweight_circuit", "long_walk"],
};

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
  footCare: false,      // calf raises, an ankle drill, and foot stretches in every session
  barWeight: 45,        // lb
  equipment: EQUIPMENT.map((e) => e.id),
  setupDone: false,
};

export const withDefaults = (settings) => ({ ...DEFAULT_SETTINGS, ...(settings || {}) });

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

const ANKLE = [
  { text: "Ankle circles: 10 each direction" },
  { text: "Banded ankle dorsiflexion: 12 each side", needs: "band" },
  { text: "Wall ankle stretch, knee to wall: 30 sec each side" },
];
const CALF_RAISES = "Calf raises on a step: 2 × 15, slow";
const FEET_COOLDOWN = [
  "Plantar fascia stretch: 60 sec each foot",
  "Calf stretch: 2 × 30 sec each side",
];

/** The foot-care add-on: [warm-up items], [cool-down items]. Empty when it is switched off. */
function footCare(settings, i) {
  if (!settings.footCare) return { before: [], after: [] };
  const drills = ANKLE.filter((a) => !a.needs || settings.equipment.includes(a.needs));
  return { before: [pick(drills, i).text, CALF_RAISES], after: FEET_COOLDOWN };
}

// Apple Watch workout type to start alongside each kind of session.
// A web app cannot read Apple Health, so the watch records on its own.
const WATCH = {
  lift: "Traditional Strength Training",
  core: "Core Training",
  mobility: "Flexibility",
  walk: "Outdoor Walk", hike: "Hiking", swim: "Pool Swim", row: "Rower", yoga: "Yoga",
  other: "Other",
};
export const watchWorkoutFor = (session) => {
  if (session.exercises?.length) return session.kind === "core" ? WATCH.core : WATCH.lift;
  if (session.kind === "mobility") return WATCH.mobility;
  return WATCH[session.activity?.type] || WATCH.other;
};

const check = (items) =>
  items.map((item) => (typeof item === "string" ? { text: item, done: false } : { text: item.text, url: item.url, done: false }));

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

/** Rough session length in minutes, not counting a walk, row, swim, or class. */
export function estimateMinutes(session) {
  let sec = 0;
  sec += (session.warmup?.length || 0) * (session.kind === "mobility" ? 80 : 55);
  sec += (session.cooldown?.length || 0) * 80;
  if (session.rampUp) sec += 150;
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
  const feet = footCare(settings, c.weekIndex + dayIndex(date));

  let mainSpec = plan.key === "hinge" ? { ...format.main, ...HINGE_MAIN[format.id] } : { ...format.main };
  if (compact) mainSpec.sets = Math.min(mainSpec.sets, format.id === "density" ? 3 : 4);

  s.format = { id: format.id, name: format.name, tagline: format.tagline };
  s.blockNote = `Week ${c.weekInBlock} of 6 with these main lifts`;
  s.rampUp = true;
  s.why = ["variety", "load", "failure", "rest"];

  const prep = day.prep
    .map((m) => (m === MOVES.deadHang && !gear.includes("pull_up_bar") ? MOVES.iytw : m))
    .slice(0, short ? 1 : compact ? 2 : 3);
  s.warmup = check([...prep, ...feet.before]);
  s.cooldown = check(feet.after);

  const used = new Set();
  const take = (list, index, role, spec, group, opts) => {
    const id = chooseExercise(list, index, gear, used, opts);
    if (!id) return null;
    used.add(id);
    return makeExercise(id, role, spec, group);
  };

  const main = take(day.main, c.blockIndex, "main", mainSpec, null, { anchor: true });

  if (short) {
    s.short = true;
    s.templateName = `${plan.name} (short)`;
    s.exercises = [main && { ...main, sets: main.sets.slice(0, 3) }].filter(Boolean);
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
  s.estMinutes = estimateMinutes(s);
  return s;
}

function buildCore(date, programStart, plan, { short = false, settings }) {
  const c = clocks(date, programStart);
  const format = CORE_FORMATS[c.formatIndex];
  const s = baseSession(date, programStart, plan);
  const feet = footCare(settings, c.weekIndex + 1);
  s.format = { id: format.id, name: format.name, tagline: format.tagline };
  s.why = ["variety", "who"];
  s.warmup = check([...(short ? CORE_PREP.slice(0, 1) : CORE_PREP), ...feet.before]);
  const group = format.style === "straight" ? null : format.style === "emom" ? "On the minute" : "Circuit";
  const slots = short ? format.slots.slice(0, 2) : format.slots;
  const used = new Set();
  s.exercises = slots.map((list) => {
    const id = chooseExercise(list, c.waveIndex, settings.equipment, used);
    if (!id) return null;
    used.add(id);
    return makeExercise(id, "core", { sets: short ? 2 : format.sets, rest: format.style === "emom" ? 25 : format.rest }, group);
  }).filter(Boolean);
  if (short) { s.short = true; s.templateName = `${plan.name} (short)`; }
  s.cooldown = check(feet.after);
  s.optional = short ? null : "Optional: add an easy walk or row afterward and log it from the Today tab.";
  s.estMinutes = estimateMinutes(s);
  return s;
}

function moveMenu(date, settings) {
  return MOVE_MENU[seasonOf(date)].filter((t) => t !== "row" || settings.equipment.includes("rower"));
}

function buildMobility(date, programStart, plan, { short = false, settings }) {
  const c = clocks(date, programStart);
  const isSat = dayIndex(date) === 5;
  const flow = pick(MOBILITY_FLOWS, c.weekIndex * 2 + (isSat ? 1 : 0));
  const menu = moveMenu(date, settings);
  const type = pick(menu, c.weekIndex + (isSat ? 1 : 0));
  const feet = footCare(settings, c.weekIndex + (isSat ? 1 : 0));
  const s = baseSession(date, programStart, plan);
  s.format = { id: flow.id, name: flow.name, tagline: "Hold each stretch to tightness, never pain." };
  s.why = ["mobility", "who"];
  if (short) {
    s.short = true;
    s.templateName = `${plan.name} (short)`;
    s.warmup = check(settings.footCare ? [...feet.before, ...feet.after] : [MOVES.catCow, MOVES.childsPose]);
    s.warmupTitle = settings.footCare ? "Feet" : "Two stretches";
    s.activity = { type: "walk", minutes: 10, hard: false, options: menu };
    s.estMinutes = estimateMinutes(s);
    return s;
  }
  const items = flow.items.map((m) => (m === MOVES.latStretch && !settings.equipment.includes("bench") ? MOVES.latStretchFloor : m));
  s.warmup = check([...items, ...feet.before, ...feet.after]);
  s.warmupTitle = `Stretch: ${flow.name}`;
  if (flow.id !== "class") {
    s.flowNote = "Prefer a guided version? A mobility or yoga class (Bend and Peloton both work) is an equal swap for the stretches.";
  }
  s.estMinutes = estimateMinutes(s);
  const left = Math.max(10, roundTo5(settings.minutes - s.estMinutes));
  const minutes = flow.id === "class" ? Math.max(20, left) : left;
  // A hike needs more room than a short slot gives. Suggest a walk instead.
  s.activity = { type: type === "hike" && minutes < 30 ? "walk" : type, minutes, hard: false, options: menu };
  return s;
}

function buildSurprise(date, programStart, plan, { short = false, reroll = 0, settings }) {
  const c = clocks(date, programStart);
  const gear = settings.equipment;
  const menu = SURPRISE_MENU[seasonOf(date)].filter((id) => SURPRISES[id].needs.every((n) => gear.includes(n)));
  const id = pick(menu, c.weekIndex + reroll);
  const def = SURPRISES[id];
  const feet = footCare(settings, c.weekIndex + 2);
  const s = baseSession(date, programStart, plan);
  s.surpriseId = id;
  s.templateName = `Surprise: ${def.name}`;
  s.emoji = def.emoji;
  s.format = { id, name: def.name, tagline: def.tagline };
  s.why = def.circuit ? ["variety", "who"] : ["who", "cardio"];
  s.warmup = check([...(def.circuit && !short ? [MOVES.catCow, MOVES.bodyweightSquat] : []), ...feet.before]);
  if (short) {
    s.short = true;
    s.templateName = "Surprise (short)";
    s.activity = { type: "walk", minutes: 10, hard: false, options: moveMenu(date, settings) };
  } else if (def.circuit) {
    s.exercises = def.circuit.ids.map((exId) =>
      makeExercise(exId, "accessory", { sets: def.circuit.rounds, reps: 10, rir: 2, rest: def.circuit.rest }, "Circuit")
    );
  } else {
    const minutes = def.fixed ? def.activity.minutes : Math.min(def.activity.minutes, settings.minutes);
    s.main = check(def.checklist(minutes));
    s.activity = { ...def.activity, minutes, options: [def.activity.type] };
  }
  s.cooldown = check(feet.after);
  s.estMinutes = estimateMinutes(s);
  return s;
}

const BUILDERS = { lift: buildLift, core: buildCore, mobility: buildMobility, surprise: buildSurprise };

/**
 * The session planned for a date.
 * options.settings -> the person's settings (minutes, equipment, foot care)
 * options.short    -> a 10 to 15 minute version of the same day
 * options.reroll   -> Sunday only: deal a different surprise
 */
export function buildSessionFor(date, programStart, options = {}) {
  const plan = DAY_PLAN[dayIndex(date)];
  return BUILDERS[plan.kind](date, programStart, plan, { ...options, settings: withDefaults(options.settings) });
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

/** Older saved sessions stored warm-ups as plain strings. */
export function normalizeSession(s) {
  if (!s) return s;
  const fix = (list) => (list || []).map((x) => (typeof x === "string" ? { text: x, done: false } : x));
  return { ...s, warmup: fix(s.warmup), cooldown: fix(s.cooldown), main: s.main ? fix(s.main) : undefined };
}
