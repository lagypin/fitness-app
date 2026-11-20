// ─── Rest-timer chime ─────────────────────────────────────────────────────────
//
// iPhone Safari ignores navigator.vibrate, so the timer plays a short, gentle
// two-note tone generated with Web Audio instead (no audio file). iOS only lets
// a page start sound after a user gesture, so primeAudio() runs inside the
// set-tick tap and playChime() reuses that context when the rest ends. With
// navigator.audioSession set to "playback" the tone sounds with the ring
// switch on silent.
// ──────────────────────────────────────────────────────────────────────────────

let ctx = null;

/** Create or resume the audio context. Call synchronously inside a tap handler. */
export function primeAudio() {
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    if (navigator.audioSession && navigator.audioSession.type !== "playback") {
      try { navigator.audioSession.type = "playback"; } catch { /* not supported */ }
    }
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Two soft sine notes, about 0.8 seconds in all. Returns false when audio was never primed. */
export function playChime() {
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.02;
    const note = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0 + start);
      gain.gain.linearRampToValueAtTime(0.2, t0 + start + 0.03);
      gain.gain.setValueAtTime(0.2, t0 + start + dur - 0.12);
      gain.gain.linearRampToValueAtTime(0, t0 + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    };
    note(660, 0, 0.3);
    note(880, 0.32, 0.45);
    return true;
  } catch {
    return false;
  }
}
