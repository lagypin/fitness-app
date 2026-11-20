// ─── Keep the screen on during a session ──────────────────────────────────────
//
// One place owns the wake lock. Call keepAwake() synchronously inside a tap
// handler (Start, Resume, a set tick) so the browser counts it as user
// activation. The Screen Wake Lock API comes first; when it is missing or the
// request is refused, nosleep.js (a silent looping video) stands in. The lock
// drops whenever the page is hidden, so it is requested again when the page is
// visible and a session is still active.
//
// state: "off" | "pending" | "held" | "failed"
// ──────────────────────────────────────────────────────────────────────────────

import NoSleep from "nosleep.js";

let sentinel = null;   // WakeLockSentinel from the native API
let noSleep = null;    // nosleep.js instance, created on first use
let wanted = false;    // a session is active and the screen should stay on
let state = "off";
const listeners = new Set();

function setState(next) {
  if (state === next) return;
  state = next;
  for (const fn of listeners) fn(state);
}

export const getState = () => state;

/** Listen for state changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const hasNative = () => typeof navigator !== "undefined" && "wakeLock" in navigator;

function tryNoSleep() {
  try {
    noSleep = noSleep || new NoSleep();
    Promise.resolve(noSleep.enable())
      .then(() => { if (wanted) setState("held"); })
      .catch(() => setState("failed"));
  } catch {
    setState("failed");
  }
}

function requestNative() {
  let request;
  try {
    request = navigator.wakeLock.request("screen");
  } catch {
    tryNoSleep();
    return;
  }
  request.then((lock) => {
    if (!wanted) { lock.release().catch(() => {}); return; }
    sentinel = lock;
    lock.addEventListener("release", () => {
      if (sentinel === lock) sentinel = null;
      // Released by the system (the page was hidden). Show nothing until it is back.
      if (wanted && state === "held") setState("pending");
    });
    setState("held");
  }).catch(() => {
    sentinel = null;
    tryNoSleep();
  });
}

/** Keep the screen on. Call from a tap handler. Safe to call again while already held. */
export function keepAwake() {
  wanted = true;
  if (state === "held") return;
  setState("pending");
  if (hasNative()) requestNative();
  else tryNoSleep();
}

/** Let the screen lock again: on finish, discard, or pause. */
export function release() {
  wanted = false;
  if (sentinel) {
    const lock = sentinel;
    sentinel = null;
    lock.release().catch(() => {});
  }
  try { noSleep?.disable(); } catch { /* nothing to do */ }
  setState("off");
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !wanted) return;
    if (hasNative() && !sentinel) requestNative();
  });
}
