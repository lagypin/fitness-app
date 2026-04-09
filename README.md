# Move

A personal fitness tracker built as an installable progressive web app (PWA). Pick a session, run through the workout, log your sets, and watch your streak grow.

## Sessions

Four strength templates plus mobility and conditioning:

| Session | Anchor lift |
| --- | --- |
| 🏋️ Squat | Back squat · front squat |
| ☠️ Hinge | Conventional · sumo deadlift |
| 💪 Press | Bench press · overhead press |
| 🧗 Pull | Barbell row · ring rows |
| 🌸 Yoga | Movement & recovery |
| 🚣 Row Sprints | 30s on / 2 min off × 8–10 |

## Features

- **Build & run sessions** from a curated exercise library, with one-tap swaps for any slot.
- **Set-by-set logging** for weight and reps, with completion ticks and a session timer.
- **Streak tracking** so consecutive workout days are visible at a glance.
- **History log** of every completed session with date, template, sets, and top weight.
- **Backup & restore** via the OS share sheet — export your history as JSON to Drive, Files, email, or AirDrop, and import it back on any device.
- **Installable PWA** — add to your home screen and it runs fullscreen, offline-capable, with no browser chrome.

## Tech

- React 18 + Vite 5
- `vite-plugin-pwa` for the manifest, service worker, and offline cache
- All workout history stored in the browser's `localStorage` (no backend, no account, no tracking)

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173. To test on your phone over the same Wi-Fi:

```bash
npm run dev -- --host
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

The repo is wired up to deploy on [Vercel](https://vercel.com) — every push to `main` triggers a fresh build. Any static host that serves a built Vite project will work.

## Data

Workout history lives in `localStorage` under `wapp_sessions` (completed sessions) and `wapp_active` (an in-progress session, if any). The Backup button on the Log tab exports both as a JSON file you can stash anywhere; Restore reads it back in.
