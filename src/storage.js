// Everything lives in the browser's localStorage. No account, no server.

export const KEYS = {
  sessions: "wapp_sessions",       // completed entries (same key as version 1, so old history carries over)
  active: "wapp_active",           // session in progress
  programStart: "move_program_start", // Monday the program began, YYYY-MM-DD
  settings: "move_settings",       // minutes per day, equipment, bar weight, outdoor options
  swaps: "move_swaps",             // standing swaps: { originalExerciseId: replacementId }
  lengths: "move_lengths",         // per-day length picks: { dayKey: "short" | 30 | 45 }
  cheersRecent: "move_cheers_recent",            // the last few finish lines shown, so none repeats soon
  cheersRecentQuick: "move_cheers_recent_quick", // the same for walk and quick-log lines
};

/** Keys that older versions wrote and this one no longer reads. Removed on load. */
export const RETIRED_KEYS = ["move_rerolls"];

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

export function dropRetiredKeys() {
  try {
    for (const k of RETIRED_KEYS) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export const uid = () => Math.random().toString(36).slice(2, 9);
