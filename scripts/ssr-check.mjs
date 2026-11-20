// Renders the main screens to HTML with React's server renderer and checks the
// 2.2 behaviors a browser would show. Run with: node scripts/ssr-check.mjs
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// Minimal browser globals the modules touch at import time.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.__APP_VERSION__ = "2.2.0";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const load = (p) => vite.ssrLoadModule(p);
const { default: TodayScreen } = await load("/src/screens/Today.jsx");
const { default: MoreScreen } = await load("/src/screens/More.jsx");
const { default: SessionScreen } = await load("/src/screens/Session.jsx");
const { default: SettingsForm } = await load("/src/screens/Settings.jsx");
const { default: WhyPage } = await load("/src/screens/WhyPage.jsx");
const { FinishCard, StatusLine } = await load("/src/ui.jsx");
const { buildSessionFor, EQUIPMENT, withDefaults } = await load("/src/engine/program.js");
const { applySuggestions } = await load("/src/engine/progression.js");
const { fromKey } = await load("/src/engine/dates.js");

const settings = withDefaults({ minutes: 30, barWeight: 35, equipment: EQUIPMENT.map((e) => e.id), setupDone: true });
const START = "2026-11-09";
const render = (el) => renderToStaticMarkup(el);
const h = React.createElement;
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "pass" : "FAIL"}  ${label}`); if (!ok) failures++; };
const noop = () => {};

// First-run setup
const setup = render(h(SettingsForm, { settings: withDefaults({}), firstRun: true, onSave: noop }));
check("first-run setup has no foot-care question", !/foot/i.test(setup));
check("first-run setup points to More for later changes", /under More/.test(setup));

// Monday (lift day) on Today
const mon = fromKey("2026-11-16");
const monPlan = applySuggestions(buildSessionFor(mon, START, { settings }), [], { barWeight: 35 });
const todayCommon = { today: mon, onSelect: noop, length: 30, onLength: noop, settings, planDone: false, doneKeys: new Set(), activeSession: null, onResume: noop, onStart: noop, onQuickLog: noop, status: null, finish: null, onFinishDone: noop };
const todayMon = render(h(TodayScreen, { ...todayCommon, selectedKey: "2026-11-16", plan: monPlan }));
check("Monday shows the row warm-up in the plan list", /Easy row/.test(todayMon));
check("Monday plan lists the Cool-down with two stretches", /Cool-down/.test(todayMon) && /hip-flexor/.test(todayMon) && /chest stretch/.test(todayMon));
check("Monday has a Start button", /<button[^>]*>Start<\/button>/.test(todayMon));
check("Monday links to the Why page", /href="\/why#variety"/.test(todayMon));
check("Today has no This week meters", !/Aerobic minutes/.test(todayMon));
check("Today has no streak", !/streak/i.test(todayMon));
check("Week strip shows the rainbow on open days", (todayMon.match(/🌈/g) || []).length === 3);

// Thursday (open day) on Today
const thu = fromKey("2026-11-19");
const thuPlan = buildSessionFor(thu, START, { settings });
const todayThu = render(h(TodayScreen, { ...todayCommon, today: thu, selectedKey: "2026-11-19", plan: thuPlan }));
check("Thursday shows the Open day card", /aria-label="Open day"/.test(todayThu) && /Open day<\/h2>/.test(todayThu));
check("Open day has the one-line note", /Walk, yoga, a swim, or rest\. Log whatever you do below\./.test(todayThu));
check("Open day has no Start button and no length picker", !/>Start</.test(todayThu) && !/Length for this day/.test(todayThu));
check("Open day keeps the quick-log chips", /Log your movement/.test(todayThu) && /🚶/.test(todayThu));

// Session screen for Monday
const session = { ...monPlan, id: "x", startedAt: Date.now() };
const sess = render(h(SessionScreen, { session, barWeight: 35, equipment: settings.equipment, onUpdateSet: noop, onToggleCheck: noop, onFeel: noop, onSwap: noop, onActivity: noop, onComplete: noop, onExit: noop, onDiscard: noop }));
check("session top card is one line: format week and reps", sess.includes(`<span class="tag">${monPlan.format.name} week · ${monPlan.exercises[0].repsLabel} reps</span>`) && !sess.includes(monPlan.format.tagline));
check("session keeps the watch hint", /Tracking on a watch\? Start: Traditional Strength Training/.test(sess));
check("session has the keep-awake status line with aria-live", /class="keep-awake" aria-live="polite"/.test(sess));
check("session shows the ramp-up and the second-lift warm-up set", /Ramp up:/.test(sess) && /Warm up:<\/strong> One lighter set first/.test(sess));
check("Easy/Good/Hard chips hidden until the last set is ticked", !/How did the last set feel/.test(sess));
const doneSession = { ...session, exercises: session.exercises.map((e, i) => (i === 0 ? { ...e, sets: e.sets.map((s) => ({ ...s, done: true, weight: "95" })) } : e)) };
const sessDone = render(h(SessionScreen, { session: doneSession, barWeight: 35, equipment: settings.equipment, onUpdateSet: noop, onToggleCheck: noop, onFeel: noop, onSwap: noop, onActivity: noop, onComplete: noop, onExit: noop, onDiscard: noop }));
check("chips appear once an exercise's last set is ticked", (sessDone.match(/How did the last set feel/g) || []).length === 1);
check("Cool-down card title", /aria-label="Cool-down"/.test(sess));

// A 2.1 in-progress mobility session still opens
const { normalizeSession } = await load("/src/engine/program.js");
const oldActive = normalizeSession({ id: "m", kind: "mobility", templateName: "Mobility", date: "2026-11-12T18:00:00.000Z", format: { id: "hips_legs", name: "Hips + legs", tagline: "x" }, cardio: ["Brisk walk: 15 min"], warmup: ["Pigeon pose: 2 × 30 sec each side"], cooldown: ["Calf stretch: 2 × 30 sec each side"], exercises: [], activity: { type: "walk", minutes: 15, hard: false, options: ["walk"] }, estMinutes: 12 });
const oldSess = render(h(SessionScreen, { session: oldActive, barWeight: 35, equipment: settings.equipment, onUpdateSet: noop, onToggleCheck: noop, onFeel: noop, onSwap: noop, onActivity: noop, onComplete: noop, onExit: noop, onDiscard: noop }));
check("a 2.1 mobility session in progress renders with its checklists and Finish button", /Pigeon pose/.test(oldSess) && /Brisk walk: 15 min/.test(oldSess) && /Finish and save/.test(oldSess));

// Finish card and quick-log status
const card = render(h(FinishCard, { finish: { emoji: "🌈", line: "Strong looks good on you. 🏋️‍♀️", fact: "Two strength days done. This week's guideline is covered. ✅", name: "Push" }, onDone: noop }));
check("finish card heading is focusable and carries the line", /<h2 class="finish-title" tabindex="-1">Strong looks good on you\./.test(card));
check("finish card emojis are aria-hidden", (card.match(/aria-hidden="true"/g) || []).length === 3 && /<span aria-hidden="true"> 🏋️‍♀️<\/span>/.test(card) && /<span aria-hidden="true"> ✅<\/span>/.test(card));
check("finish card has a Done button", /<button[^>]*>Done<\/button>/.test(card));
const quick = render(h(StatusLine, { status: { emoji: "👍", text: "Nice walk. Walk, 30 min logged." } }));
check("quick-log status reads 'Nice walk. Walk, 30 min logged.' with a hidden emoji", /<p class="status" role="status"><span aria-hidden="true">👍 <\/span>Nice walk\. Walk, 30 min logged\.<\/p>/.test(quick));

// More
const more = render(h(MoreScreen, { sessions: [], extras: {}, onReplaceSessions: noop, settings, onSaveSettings: noop, swaps: { ex_back_squat: "ex_box_squat" }, onRemoveSwap: noop, status: null }));
for (const label of ["Change settings", "Standing swaps", "Back up", "Restore", "Export CSV", "Open the library", 'href="/why"', "Move 2.2.0"]) {
  check(`More holds ${label}`, more.includes(label));
}
check("More shows the standing swap", /Back Squat, swapped for <strong>Box Squat<\/strong>/.test(more));

// Why page
const why = render(h(WhyPage));
check("Why page has Back to Move at the top", /header-link" href="\/"/.test(why) && /Back to Move/.test(why));
check("Why page has principle anchors", /id="warmup"/.test(why) && /id="open"/.test(why));
check("Why page has no feet or mobility principle", !/id="feet"/.test(why) && !/id="mobility"/.test(why));
check("Why page cites Fradkin 2010 and Dos Santos 2022", /Fradkin et al\., 2010/.test(why) && /Dos Santos et al\., 2022/.test(why));

// No retired text anywhere rendered
const all = [setup, todayMon, todayThu, sess, card, more, why].join("\n");
check("no plantar, foot care, streak, Surprise, Bend, or Peloton in rendered screens", !/plantar|foot care|streak|surprise|\bbend\b|peloton/i.test(all));
check("no em dashes in rendered screens", !all.includes("—"));

await vite.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
