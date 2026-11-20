// ─── Finish cheers ────────────────────────────────────────────────────────────
//
// One line when a session is saved, a lighter one when a walk or other quick
// log is saved, and sometimes a fact drawn from the log. Lines never repeat
// within the last RECENT_LIMIT shown (the app keeps the recent picks in
// localStorage, one list for workouts and one for quick logs). Emojis are
// decorative; the text carries the meaning, and splitEmoji() lets a screen
// hide them from the accessibility tree.
// ──────────────────────────────────────────────────────────────────────────────

export const RECENT_LIMIT = 5;

export const WORKOUT_LINES = [
  "You showed up. That's the whole trick.",
  "Your future self just sent a thank-you note.",
  "Muscles: informed. Day: improved.",
  "Another one in the books. Gold star. ⭐",
  "Look at you, doing the thing!",
  "That's what consistency looks like.",
  "Strong looks good on you. 🏋️‍♀️",
  "Somewhere a unicorn is applauding. 🦄",
  "Rainbow unlocked. 🌈",
  "Done and done. Go drink some water.",
  "You did hard things on purpose. Respect.",
  "Today's forecast: 100% chance of awesome. 🌈",
  "Plot twist: you're the strong one. 🏋️‍♀️",
  "Gravity tried. You won.",
  "The weights came, saw, and got lifted.",
  "Unicorn-level effort today. 🦄",
  "You're basically a superhero now. Cape optional.",
  "Showing up is a skill, and you're good at it.",
  "That workout didn't stand a chance.",
  "High five from your hamstrings.",
  "Your muscles say thanks. Your couch says welcome back.",
  "Nailed it. Absolutely nailed it.",
  "Progress, in progress. 🌈",
  "Consistency called. It's proud of you.",
  "Today: you 1, excuses 0.",
  "Sparkly strong. 🦄",
  "Rest up. You did the work.",
  "One more for the win column.",
  "That's how it's done. 🏋️‍♀️",
  "Look who did it again. You!",
  "Strong, steady, and a little bit sparkly. 🦄🌈",
  "Mission accomplished. Go bask in it.",
];

export const QUICK_LINES = [
  "👍 Nice walk.",
  "⭐ Gold star for getting outside.",
  "👍 Fresh air: acquired.",
  "⭐ Every walk counts. This one too.",
  "👍 Your walking buddy approves.",
  "⭐ Moved. Logged. Lovely.",
  "👍 That counts. Nice one.",
  "🌈 Walk complete. Mood: improved.",
];

/** Decorative emoji for the finish card itself. */
export const CELEBRATION_EMOJI = ["🎉", "🌈", "🦄", "⭐", "💪"];

export const FACTS = {
  A: (n) => `That's lift day ${n} of 3 this week.`,
  B: (minutes) => `${minutes} minutes of movement this week and counting.`,
  C: () => "Two strength days done. This week's guideline is covered. ✅",
  D: (name) => `Heaviest ${name} you've logged! 🏋️‍♀️`,
};

/** The quick-log lines for an activity: walks get all of them, anything else skips the ones that say "walk". */
export function quickLinesFor(activityType) {
  return activityType === "walk" ? QUICK_LINES : QUICK_LINES.filter((l) => !/walk/i.test(l));
}

/**
 * Pick a line at random, never one of the last RECENT_LIMIT shown. Returns the
 * line and the updated recent list to store. `rand` is injectable for tests.
 */
export function pickLine(lines, recent = [], rand = Math.random) {
  const fresh = lines.filter((l) => !recent.includes(l));
  const pool = fresh.length ? fresh : lines;
  const line = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
  return { line, recent: [...recent.filter((l) => l !== line), line].slice(-RECENT_LIMIT) };
}

/**
 * The fact line for a finish, or null.
 *   newTops            exercises whose top weight this session beat all earlier history (fact D, always)
 *   kind               "lift", "core", ...
 *   liftDays           lift sessions logged this week, this one included (fact A)
 *   strengthDaysBefore strength days this week before this session was saved
 *   strengthDays       strength days this week after it (fact C fires when 1 becomes 2)
 *   aerobicMinutes     the week's aerobic minutes after it (fact B)
 * Without a new top weight, a fact shows on about one finish in three.
 */
export function chooseFact({ newTops = [], kind, liftDays = 0, strengthDays = 0, strengthDaysBefore = 0, aerobicMinutes = 0, rand = Math.random }) {
  if (newTops.length) return FACTS.D(newTops[0]);
  if (rand() >= 1 / 3) return null;
  if (strengthDays === 2 && strengthDaysBefore < 2) return FACTS.C();
  const options = [];
  if (kind === "lift" && liftDays >= 1 && liftDays <= 3) options.push(FACTS.A(liftDays));
  options.push(FACTS.B(aerobicMinutes));
  return options[Math.min(options.length - 1, Math.floor(rand() * options.length))];
}

const EMOJI = "(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation}|[\\u{1F3FB}-\\u{1F3FF}]|\\u200d|\\ufe0f|\\u2640|\\u2642)";
const TRAILING = new RegExp(`\\s*(${EMOJI}+)$`, "u");
const LEADING = new RegExp(`^(${EMOJI}+)\\s*`, "u");

/** Split a line into its words and its decorative emoji (leading or trailing). */
export function splitEmoji(line) {
  let text = line;
  let emoji = "";
  const lead = LEADING.exec(text);
  if (lead) { emoji = lead[1]; text = text.slice(lead[0].length); }
  const tail = TRAILING.exec(text);
  if (tail) { emoji = emoji ? `${emoji} ${tail[1]}` : tail[1]; text = text.slice(0, text.length - tail[0].length); }
  return { text, emoji };
}
