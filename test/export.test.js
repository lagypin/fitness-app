import test from "node:test";
import assert from "node:assert/strict";

import { EQUIPMENT, buildSessionFor } from "../src/engine/program.js";
import { addDays, fromKey, toKey } from "../src/engine/dates.js";
import { exportCsvs, parseCsv, SESSION_COLUMNS, SET_COLUMNS, csvCell } from "../src/engine/export.js";

const START = "2026-11-09";
const ME = { minutes: 30, barWeight: 35, equipment: EQUIPMENT.map((e) => e.id) };
const monday = fromKey(START);

function logged(i) {
  const d = addDays(monday, i);
  const s = buildSessionFor(d, START, { settings: ME });
  return {
    ...s, id: `s${i}`, dayKey: toKey(d), completed: true, durationMin: 31,
    exercises: s.exercises.map((ex, j) => ({
      ...ex, feel: j === 0 ? "good" : null,
      sets: ex.sets.map((set, k) => ({ ...set, weight: k === 0 ? "95" : "", reps: "5", done: k !== 1 })),
    })),
  };
}

test("both CSVs parse, carry their headers, quote awkward cells, and use CRLF", () => {
  const sessions = [
    logged(0), logged(1), logged(3), logged(6),
    { id: "q1", kind: "activity", templateName: 'Walk, "long"', dayKey: "2026-11-10", date: "2026-11-10T12:00:00.000Z",
      exercises: [], activity: { type: "walk", minutes: 40, hard: true }, durationMin: 40 },
  ];
  const { sessions: a, sets: b } = exportCsvs(sessions);
  assert.ok(a.endsWith("\r\n") && b.endsWith("\r\n"));
  assert.ok(!/[^\r]\n/.test(a) && !/[^\r]\n/.test(b), "every line break is CRLF");
  const rowsA = parseCsv(a), rowsB = parseCsv(b);
  assert.deepEqual(rowsA[0], SESSION_COLUMNS);
  assert.deepEqual(rowsB[0], SET_COLUMNS);
  assert.equal(rowsA.length, sessions.length + 1);
  for (const r of rowsA.slice(1)) assert.equal(r.length, SESSION_COLUMNS.length);
  for (const r of rowsB.slice(1)) assert.equal(r.length, SET_COLUMNS.length);
  const quick = rowsA.find((r) => r[0] === "q1");
  assert.equal(quick[2], 'Walk, "long"');
  assert.equal(quick[3], "activity");
  assert.equal(quick[7], "Walk");
  assert.equal(quick[8], "40");
  assert.equal(quick[9], "yes");
  assert.match(a, /"Walk, ""long"""/);
  assert.equal(csvCell("plain"), "plain");
});

test("every Sets row points at a Sessions row, and the counts match", () => {
  const sessions = [logged(0), logged(1), logged(4)];
  const { sessions: a, sets: b } = exportCsvs(sessions);
  const rowsA = parseCsv(a).slice(1), rowsB = parseCsv(b).slice(1);
  const ids = new Set(rowsA.map((r) => r[0]));
  const bySession = {};
  for (const r of rowsB) {
    assert.ok(ids.has(r[0]), `orphan set row for ${r[0]}`);
    bySession[r[0]] = (bySession[r[0]] || 0) + 1;
    const s = sessions.find((x) => x.id === r[0]);
    assert.equal(r[1], s.dayKey);
    assert.ok(s.exercises.some((ex) => ex.name === r[2] && ex.category === r[3]), r[2]);
  }
  for (const r of rowsA) {
    const s = sessions.find((x) => x.id === r[0]);
    const done = s.exercises.reduce((n, ex) => n + ex.sets.filter((x) => x.done).length, 0);
    assert.equal(Number(r[11]), done);
    assert.equal(bySession[r[0]] || 0, done, `${s.templateName}: ${bySession[r[0]]} set rows for ${done} done sets`);
    assert.equal(r[5], "30");
    assert.equal(r[6], "31");
  }
  // Tuesday carries its cardio as the session's activity
  const tue = rowsA.find((r) => r[2] === "Cardio + core");
  assert.equal(tue[7], "Row");
  assert.ok(Number(tue[8]) >= 10);
});
