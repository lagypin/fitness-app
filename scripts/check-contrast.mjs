// Checks the color pairs used in src/styles.css against WCAG 2.1 AA.
// Text needs 4.5:1. Control outlines and large bold text need 3:1.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum, where it is used]
const pairs = [
  ["text", "bg", 4.5, "body text on the page"],
  ["text", "surface", 4.5, "body text on cards"],
  ["text-mid", "surface", 4.5, "secondary text on cards"],
  ["text-mid", "bg", 4.5, "secondary text on the page"],
  ["text-mid", "surface2", 4.5, "suggestion boxes"],
  ["text-dim", "surface", 4.5, "labels on cards"],
  ["text-dim", "bg", 4.5, "labels on the page"],
  ["text-dim", "surface2", 4.5, "labels in suggestion boxes"],
  ["on-hot", "hot", 4.5, "white text on the header and primary buttons"],
  ["on-hot-soft", "hot", 4.5, "date line on the header"],
  ["on-hot", "hot-deep", 4.5, "nav buttons, pause button"],
  ["hot", "surface", 4.5, "links and pink text on cards"],
  ["hot", "bg", 4.5, "links on the page"],
  ["hot", "hot-pale", 4.5, "secondary button hover, active banner"],
  ["hot-deep", "hot-pale", 4.5, "tags, selected day"],
  ["hot-deep", "surface", 4.5, "section headings"],
  ["hot-deep", "bg", 4.5, "group headings on the page"],
  ["green", "green-bg", 4.5, "done text"],
  ["green", "surface", 4.5, "status messages, day check marks"],
  ["green", "bg", 4.5, "status messages on the page"],
  ["on-hot", "green", 4.5, "check mark on a done button"],
  ["amber", "amber-bg", 4.5, "short-version tag"],
  ["on-hot", "text", 4.5, "rest timer"],
  ["control", "surface", 3, "input and button outlines on cards"],
  ["control", "bg", 3, "outlines on the page"],
  ["green-border", "green-bg", 3, "done input outline"],
];

let failed = 0;
for (const [fg, bg, min, where] of pairs) {
  const r = ratio(tokens[fg], tokens[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${r.toFixed(2)}:1 (needs ${min})  --${fg} on --${bg}  ${where}`);
}
if (failed) { console.error(`\n${failed} pair(s) below WCAG AA.`); process.exit(1); }
console.log("\nAll pairs meet WCAG 2.1 AA.");
