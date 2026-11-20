// ─── Backup files ─────────────────────────────────────────────────────────────
// A backup is { app: "move", version: 2, exportedAt, sessions, programStart,
// swaps, settings }. Version 2.1 wrote the same shape, and the first version of
// the app wrote a bare array of sessions. Both restore.

/** The sessions inside a parsed backup file. Throws when the file is not a Move backup. */
export function parseBackup(data) {
  const incoming = Array.isArray(data) ? data : data?.sessions;
  if (!Array.isArray(incoming)) throw new Error("that file is not a Move backup");
  return incoming;
}

/** Existing entries plus any incoming ones with a new id, in date order. */
export function mergeSessions(existing, incoming) {
  const ids = new Set(existing.map((s) => s.id));
  return [...existing, ...incoming.filter((s) => !ids.has(s.id))].sort((a, b) => new Date(a.date) - new Date(b.date));
}
