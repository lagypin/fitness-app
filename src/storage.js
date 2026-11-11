// Everything lives in the browser's localStorage. No account, no server.

export const KEYS = {
  sessions: "wapp_sessions",       // completed entries (same key as version 1, so old history carries over)
  active: "wapp_active",           // session in progress
  programStart: "move_program_start", // Monday the program began, YYYY-MM-DD
  settings: "move_settings",       // minutes per day, equipment, bar weight, foot care
  swaps: "move_swaps",             // standing swaps: { originalExerciseId: replacementId }
  rerolls: "move_rerolls",         // Sunday surprise rerolls: { dayKey: count }
};

export const LS = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: the app keeps working from memory */
    }
  },
};

export const uid = () => Math.random().toString(36).slice(2, 9);
