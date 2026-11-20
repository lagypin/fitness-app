// Version 2.1: Tuesday cardio, per-day length, outdoor options, planned minutes. Updated for the 2.2 week (open days).
import test from "node:test";
import assert from "node:assert/strict";

import { addDays, fromKey, toKey } from "../src/engine/dates.js";
import {
  buildSessionFor as build, normalizeSession, EQUIPMENT, DEFAULT_SETTINGS,
  activityMenu, plannedAerobicMinutes, CARDIO_TYPES, CARDIO_MINUTES, LENGTHS,
} from "../src/engine/program.js";

const START = "2026-11-09"; // a Monday
const ALL_GEAR = EQUIPMENT.map((e) => e.id);
const ME = { minutes: 30, barWeight: 35, equipment: ALL_GEAR };
const buildSessionFor = (date, start, opts = {}) => build(date, start, { settings: ME, ...opts });
const monday = fromKey(START);
const day = (week, dow) => addDays(monday, week * 7 + dow);
const allText = (s) =>
  [...(s.cardio || []), ...(s.warmup || []), ...(s.cooldown || []), ...(s.main || [])].map((i) => i.text).join(" | ");
const total = (s) => s.estMinutes + (s.activity?.minutes || 0);

test("Tuesday is cardio then core, on the rower or on foot, and fits the day at Short, 30, and 45", () => {
  for (const length of LENGTHS) {
    const cap = length === "short" ? 20 : length;
    for (let w = 0; w < 6; w++) {
      const s = buildSessionFor(day(w, 1), START, { length });
      assert.ok(s.cardio.length >= 1, `cardio on week ${w}`);
      assert.equal(s.activity.type, "row");
      assert.ok(s.activity.minutes >= 10);
      assert.ok(s.exercises.length >= 2 && s.exercises.every((e) => e.role === "core"), `core work on week ${w}`);
      assert.ok(total(s) <= cap, `${length} week ${w}: ${s.estMinutes} + ${s.activity.minutes}`);
      assert.equal(s.length, length);
      assert.match(s.cardio.map((i) => i.text).join(" "), /\d+ min/);
    }
  }
  // the cardio type rotates weekly through all three, then repeats
  const types = [0, 1, 2].map((w) => buildSessionFor(day(w, 1), START).format.id.split("_")[0]);
  assert.deepEqual([...types].sort(), CARDIO_TYPES.map((t) => t.id).sort());
  assert.equal(buildSessionFor(day(3, 1), START).format.id.split("_")[0], types[0]);
  // intervals and tempo are hard minutes, steady is not
  const hard = [0, 1, 2].map((w) => buildSessionFor(day(w, 1), START).activity.hard);
  assert.equal(hard.filter(Boolean).length, 2);
  // without a rower it is a brisk walk
  const walk = buildSessionFor(day(0, 1), START, { settings: { ...ME, equipment: ALL_GEAR.filter((g) => g !== "rower") } });
  assert.equal(walk.activity.type, "walk");
  assert.match(walk.cardio[0].text, /walk/i);
});

test("no hike anywhere with hikes off (the default): any day, menu, or length", () => {
  assert.equal(DEFAULT_SETTINGS.hikes, false);
  assert.equal(DEFAULT_SETTINGS.swims, true);
  for (const start of [START, "2026-06-01", "2026-04-06"]) {
    const m = fromKey(start);
    for (let i = 0; i < 18 * 7; i++) {
      for (const length of LENGTHS) {
        const s = buildSessionFor(addDays(m, i), start, { length });
        const where = `${toKey(addDays(m, i))} ${length}`;
        assert.notEqual(s.activity?.type, "hike", where);
        assert.ok(!(s.activity?.options || []).includes("hike"), `menu on ${where}`);
        assert.ok(!/hike|hiking/i.test(allText(s) + s.templateName), where);
      }
    }
  }
  assert.ok(!("hike" in activityMenu(ME)));
  assert.ok("hike" in activityMenu({ ...ME, hikes: true }));
  // with hikes on, the easy-cardio padding on a 45-minute lift day offers a hike
  let hikes = 0;
  for (let i = 0; i < 56; i++) {
    if ((buildSessionFor(addDays(monday, i), START, { length: 45, settings: { ...ME, hikes: true } }).activity?.options || []).includes("hike")) hikes++;
  }
  assert.ok(hikes > 0);
});

test("summer swims can be switched off", () => {
  const june = fromKey("2026-06-01");
  let on = 0, off = 0, winter = 0;
  for (let i = 0; i < 56; i++) {
    if ((buildSessionFor(addDays(june, i), "2026-06-01", { length: 45 }).activity?.options || []).includes("swim")) on++;
    const s = buildSessionFor(addDays(june, i), "2026-06-01", { length: 45, settings: { ...ME, swims: false } });
    if (s.activity?.type === "swim" || (s.activity?.options || []).includes("swim")) off++;
    if ((buildSessionFor(addDays(monday, i), START, { length: 45 }).activity?.options || []).includes("swim")) winter++;
  }
  assert.ok(on > 0);
  assert.equal(off, 0);
  assert.equal(winter, 0);
  assert.ok(!("swim" in activityMenu({ ...ME, swims: false })));
});

test("no session contains a jumping move, cardio included, at every length", () => {
  const banned = /jump|\bhop\b|\bhops\b|hopping|bound|burpee|plyo|skip/i;
  for (let i = 0; i < 84; i++) {
    for (const length of LENGTHS) {
      const s = buildSessionFor(addDays(monday, i), START, { length });
      const blob = allText(s) + " " + s.exercises.map((e) => `${e.name} ${e.notes}`).join(" ");
      assert.ok(!banned.test(blob), `${toKey(addDays(monday, i))} ${length}: ${blob.match(banned)}`);
    }
  }
});

test("a 45-minute day is longer than a 30-minute day for every planned day, and each length fits its minutes", () => {
  {
    for (let i = 0; i < 42; i++) {
      const d = addDays(monday, i);
      const settings = ME;
      const s30 = buildSessionFor(d, START, { length: 30, settings });
      if (s30.kind === "open") continue;
      const s45 = buildSessionFor(d, START, { length: 45, settings });
      const sh = buildSessionFor(d, START, { length: "short", settings });
      assert.ok(total(s45) > total(s30), `${s30.templateName} ${toKey(d)}: ${total(s30)} vs ${total(s45)}`);
      // Lifting days now carry a 3-minute row and a counted cool-down, so they run a few minutes past the label.
      assert.ok(total(s30) <= 36, `${s30.templateName} at 30: ${total(s30)}`);
      assert.ok(total(s45) >= 35 && total(s45) <= 50, `${s45.templateName} at 45: ${total(s45)}`);
      assert.ok(total(sh) <= 22, `${sh.templateName} short: ${total(sh)}`);
      assert.ok(sh.short);
      // the per-day length and the Settings default build the same day
      const viaSettings = buildSessionFor(d, START, { settings: { ...settings, minutes: 45 } });
      assert.equal(total(viaSettings), total(s45));
    }
  }
  // a gap of 10 or more minutes on a lifting day is filled with easy cardio, logged with the session
  let filled = 0;
  for (let w = 0; w < 6; w++) for (const d of [0, 2, 4]) {
    const s = buildSessionFor(day(w, d), START, { length: 45 });
    if (s.activity) {
      filled++;
      assert.ok(["walk", "row"].includes(s.activity.type));
      assert.ok(s.activity.minutes >= 10);
      assert.match(s.optional, /easy/);
    }
    assert.equal(buildSessionFor(day(w, d), START, { length: 30 }).activity, undefined);
  }
  assert.ok(filled > 0);
});

test("planned aerobic minutes are Tuesday's cardio plus any easy-cardio padding on 45-minute lift days", () => {
  for (let w = 0; w < 18; w++) {
    const m = addDays(monday, w * 7);
    const at30 = plannedAerobicMinutes(m, START, ME);
    const at45 = plannedAerobicMinutes(m, START, { ...ME, minutes: 45 });
    assert.ok(at30 >= CARDIO_MINUTES[30] && at30 <= CARDIO_MINUTES[30] + 3 * 15, `week ${w} at 30: ${at30}`);
    assert.ok(at45 >= CARDIO_MINUTES[45] && at45 <= CARDIO_MINUTES[45] + 3 * 25, `week ${w} at 45: ${at45}`);
    assert.ok(at45 > at30);
  }
  // open days add nothing, whatever length is picked for them
  const open = toKey(day(0, 3));
  assert.equal(plannedAerobicMinutes(monday, START, ME, { lengths: { [open]: 45 } }), plannedAerobicMinutes(monday, START, ME));
  // a lift day's own length pick can change the total
  const push = toKey(day(0, 0));
  assert.ok(plannedAerobicMinutes(monday, START, ME, { lengths: { [push]: 45 } }) >= plannedAerobicMinutes(monday, START, ME));
});

test("old saved sessions without a cardio list still load", () => {
  const n = normalizeSession({ warmup: [], cooldown: [], exercises: [] });
  assert.equal(n.cardio, undefined);
  const c = normalizeSession({ warmup: [], cooldown: [], exercises: [], cardio: ["Row 15 min"] });
  assert.deepEqual(c.cardio, [{ text: "Row 15 min", done: false }]);
});
