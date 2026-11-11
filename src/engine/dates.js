// Local-date helpers. Weeks run Monday to Sunday.

const pad = (n) => String(n).padStart(2, "0");

/** Local calendar day as YYYY-MM-DD. */
export const toKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const startOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** 0 = Monday ... 6 = Sunday */
export const dayIndex = (d) => (d.getDay() + 6) % 7;

export const mondayOf = (d) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - dayIndex(x));
  return x;
};

export const addDays = (d, n) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Whole weeks between the program's first Monday and the week containing `date`. */
export const weekIndexFor = (date, startKey) => {
  const ms = mondayOf(date) - fromKey(startKey);
  return Math.max(0, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
};

export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** Day key for a logged entry (older entries only have an ISO timestamp). */
export const entryDayKey = (s) => s.dayKey || toKey(new Date(s.date));
