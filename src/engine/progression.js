// ─── Weight suggestions ───────────────────────────────────────────────────────
//
// Two rules, both shown to the lifter so nothing is a black box:
//
// 1. Same rep target as last time (double progression): if every set hit the
//    target and it didn't feel hard, add one step. If it felt easy, add two.
//    If it felt hard or reps were missed, repeat the weight.
//
// 2. Different rep target (a different week of the wave): estimate a one-rep
//    max from the last session with the Epley formula, then work back to a
//    weight for today's reps. This is an estimate, rounded down.
//
// Step sizes follow the equipment: 5 lb on the bar and dumbbells. Kettlebells
// jump 20 lb at a time, so they progress by reps instead.
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_BAR_WEIGHT = 45;
export const DUMBBELL_RANGE = [5, 55];
export const KETTLEBELLS = [20, 40, 60, 80];
const STEP = { barbell: 5, landmine: 5, dumbbell: 5 };
const FEEL_RIR = { easy: 4, good: 2, hard: 0.5 };

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const floorTo = (w, step) => Math.floor(w / step) * step;

function clamp(w, loadType, barWeight) {
  if (loadType === "barbell") return Math.max(barWeight, w);
  if (loadType === "dumbbell") return Math.min(DUMBBELL_RANGE[1], Math.max(DUMBBELL_RANGE[0], w));
  return Math.max(0, w);
}

/** Past logged performances of one exercise, newest first. */
export function performancesFor(exerciseId, sessions) {
  const out = [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    for (const ex of s.exercises || []) {
      if (ex.exerciseId !== exerciseId) continue;
      const sets = (ex.sets || [])
        .filter((x) => x.done && num(x.weight) > 0)
        .map((x) => ({ weight: num(x.weight), reps: parseInt(x.reps, 10) || 0 }));
      if (sets.length) {
        out.push({ date: s.date, targetReps: ex.targetReps ?? null, feel: ex.feel ?? null, sets });
      }
    }
  }
  return out;
}

/** "95 × 5, 5, 5" or "95×5, 100×5" */
export function describePerformance(perf) {
  if (!perf) return "";
  const same = perf.sets.every((s) => s.weight === perf.sets[0].weight);
  if (same) return `${perf.sets[0].weight} × ${perf.sets.map((s) => s.reps).join(", ")}`;
  return perf.sets.map((s) => `${s.weight}×${s.reps}`).join(", ");
}

/**
 * Suggest a weight for an exercise in today's session.
 * Returns null when there is nothing to go on (first time, or bodyweight).
 */
export function suggestWeight(exercise, sessions, { barWeight = DEFAULT_BAR_WEIGHT } = {}) {
  const { loadType, targetReps, targetRir = 2 } = exercise;
  if (!loadType || loadType === "body") return null;

  const last = performancesFor(exercise.exerciseId, sessions)[0];
  if (!last) return null;

  const top = Math.max(...last.sets.map((s) => s.weight));
  const atTop = last.sets.filter((s) => s.weight === top);
  const minReps = Math.min(...atTop.map((s) => s.reps));
  const lastText = describePerformance(last);
  const feel = last.feel;

  if (loadType === "kettlebell") {
    const earned = targetReps && minReps >= targetReps && feel !== "hard";
    return {
      weight: top,
      last: lastText,
      basis: earned
        ? "Same bell. Add a rep per set, and move up a bell once that feels easy."
        : "Same bell as last time.",
    };
  }

  const step = STEP[loadType] || 5;

  if (targetReps && last.targetReps === targetReps) {
    const hit = minReps >= targetReps;
    let weight = top;
    let basis;
    if (hit && feel === "easy") {
      weight = top + 2 * step;
      basis = `All reps last time and it felt easy: up ${2 * step} lb.`;
    } else if (hit && feel !== "hard") {
      weight = top + step;
      basis = `All reps last time: up ${step} lb.`;
    } else if (hit) {
      basis = "All reps last time but it felt hard: repeat the weight.";
    } else if (minReps <= targetReps - 2 && feel === "hard") {
      weight = top - step;
      basis = `Missed reps and it felt hard: down ${step} lb.`;
    } else {
      basis = "Missed a rep or two last time: repeat the weight.";
    }
    const clamped = clamp(weight, loadType, barWeight);
    if (loadType === "dumbbell" && weight > clamped) {
      basis = "Top of the dumbbell rack. Add a rep per set instead.";
    }
    return { weight: clamped, last: lastText, basis };
  }

  if (targetReps && minReps > 0) {
    const rirFelt = FEEL_RIR[feel] ?? 2;
    const e1rm = top * (1 + (minReps + rirFelt) / 30);
    const raw = e1rm / (1 + (targetReps + targetRir) / 30);
    const weight = clamp(floorTo(raw, step), loadType, barWeight);
    return {
      weight,
      last: lastText,
      basis: `Estimated from ${top} × ${minReps} for today's ${targetReps} reps.`,
    };
  }

  return { weight: clamp(top, loadType, barWeight), last: lastText, basis: "Same as last time." };
}

/** Fill suggested weights into a freshly built session. Returns a new session. */
export function applySuggestions(session, sessions, options = {}) {
  return {
    ...session,
    exercises: (session.exercises || []).map((ex) => {
      const s = suggestWeight(ex, sessions, options);
      if (!s) {
        const last = performancesFor(ex.exerciseId, sessions)[0];
        return last ? { ...ex, suggestion: { weight: null, last: describePerformance(last), basis: "" } } : ex;
      }
      return {
        ...ex,
        suggestion: s,
        sets: ex.sets.map((set) => ({ ...set, weight: String(s.weight) })),
      };
    }),
  };
}

/** Ramp-up sets before a barbell main lift. */
export function rampUpSets(exercise, barWeight = DEFAULT_BAR_WEIGHT) {
  if (exercise.loadType !== "barbell") {
    return ["One or two lighter sets first, building toward your working weight."];
  }
  const w = num(exercise.suggestion?.weight ?? exercise.sets?.[0]?.weight);
  if (!w || w <= barWeight + 10) {
    return [`Empty bar (${barWeight} lb) × 8, then one lighter set before your working weight.`];
  }
  const half = Math.max(barWeight, floorTo(w * 0.5, 5));
  const most = floorTo(w * 0.75, 5);
  const steps = [`Empty bar (${barWeight} lb) × 8`];
  if (half > barWeight) steps.push(`${half} × 5`);
  if (most > half && most < w) steps.push(`${most} × 3`);
  return [steps.join(", then ") + "."];
}
