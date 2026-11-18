# Move

A training plan that fits in 30 minutes a day, runs in your browser, and installs to your phone like an app. Open it and today's session is ready: warm-up, lifts with suggested weights, and a rest timer. Each rule the app follows is tied to published research, which you can read in the app's Why tab.

> I built this for myself. It's MIT licensed, so fork it, change the sessions, or reuse the exercise library. No warranty and no support promises.

## What it does

- Plans the week: Monday Push, Tuesday Cardio + core, Wednesday Pull, Thursday Mobility, Friday Hinge, Saturday Mobility, Sunday Surprise. The day names only say which lifts come first. The week is built to hit the weekly totals (strength on 2 or more days, 150 aerobic minutes, flexibility on 2 or more days).
- Varies the format on a schedule. Lifting days rotate through Heavy (5 reps, long rests), Volume (8 reps, supersets), and Density (10 reps, circuit finish). Main lifts stay put for six weeks so you can progress them, and accessories change every three weeks.
- Tuesday's cardio rotates weekly through intervals, steady, and tempo on the rower (a brisk walk if you have no rower), followed by a short core circuit. Mobility days start with brisk cardio, then static stretches or a guided class.
- Logs your sets and suggests the next weight from what you did last time and how it felt.
- Counts walks, rows, swims, hikes, and yoga toward the World Health Organization's weekly targets and your streak, and shows how many aerobic minutes the plan itself schedules each week so you can see what your logged walks need to cover.
- Adapts to your equipment. Tell it what you own and it substitutes anything you can't do.
- Lets you pick a length for any single day on the Today tab: Short (10 to 20 minutes), 30, or 45. A 45-minute day adds sets to the lifts and minutes to the cardio, and any gap of 10 minutes or more is filled with easy cardio.
- Sends a weekly recap through your phone's share sheet, for accountability with a friend.
- Never includes jumping.

## Setting it up

The first time you open the app it asks a few things: minutes per day (30 or 45), which equipment you have, your bar weight, your outdoor options (whether to suggest hikes, off by default, and summer swims, on by default; walks are always in the plan), and whether you want the foot-care add-on (calf raises, an ankle drill, and foot stretches in every session). You can change these later under Week, then Settings.

To install it on a phone, open the app's web address in Safari (iPhone) or Chrome (Android), then choose "Add to Home Screen" from the share or browser menu. It works offline after the first visit.

## Your data

Everything is stored in your browser on your device. There is no account and no server, and nothing is tracked. The Log tab has Back up and Restore buttons that save your history as a file you can keep anywhere. Back up now and then: clearing your browser data clears your history.

### CSV export

Export CSV on the Log tab produces two files, shared together through your phone's share sheet where that is allowed and otherwise downloaded. Cells are quoted only when they contain a comma, a quote, or a line break; rows end in CRLF. Blank means the field does not apply to that row.

**Sessions** (`move-sessions-YYYY-MM-DD.csv`): one row per logged session or quick-logged activity.

| Column | Meaning |
| --- | --- |
| `session_id` | The entry's id. Sets rows point back to it. |
| `date` | Local calendar day, `YYYY-MM-DD`. |
| `day` | The session's name as shown in the app, for example `Push`, `Cardio + core`, `Surprise: Long walk`, or `Walk` for a quick log. |
| `kind` | `lift`, `core`, `mobility`, `surprise`, or `activity` (a quick log). |
| `format` | The format of the day: Heavy, Volume, or Density on lifting days, the cardio and core format on Tuesday, the stretch flow on mobility days, the surprise name on Sunday. |
| `length` | `short`, `30`, or `45`: the length the day was built at. Blank for entries from before this column existed. |
| `duration_min` | Minutes the entry took. Lifting sessions time themselves; everything else uses the planned length. |
| `activity` | The walk, row, swim, hike, yoga, or other movement logged with the entry, if any. |
| `activity_min` | Minutes of that activity. |
| `hard` | `yes` if the activity was marked a hard effort (it counts double toward the aerobic target), `no` otherwise. |
| `exercises` | How many exercises the session held. |
| `sets_done` | How many sets were ticked done. |

**Sets** (`move-sets-YYYY-MM-DD.csv`): one row per set ticked done.

| Column | Meaning |
| --- | --- |
| `session_id` | The Sessions row this set belongs to. |
| `date` | The session's local calendar day. |
| `exercise` | Exercise name. |
| `category` | Movement pattern: `squat`, `hinge`, `press`, `pull`, or `core`. |
| `role` | `main`, `second`, `accessory`, `finisher`, or `core`. |
| `group` | `Superset`, `Circuit`, or `On the minute` when the exercise was part of a group, otherwise blank. |
| `set` | Set number within the exercise, from 1. |
| `weight_lb` | Weight entered, in pounds. Blank for bodyweight moves. |
| `reps` | Reps, seconds, or distance entered, as typed. |
| `feel` | `easy`, `good`, or `hard`: how the whole exercise felt, repeated on each of its sets. |

## The research

`src/engine/evidence.js` holds every rule, the studies behind it, the limits of those studies, and DOI links. The Why tab displays the same content. Citations were checked against PubMed in November 2026. The app is general fitness guidance and does not replace advice from a clinician who knows you.

Exercise form guides link out to the [ACE exercise library](https://www.acefitness.org/resources/everyone/exercise-library/). ACE's text and photos are copyrighted, so nothing from their pages is copied here.

## Running your own copy

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # program, progression, and stats tests
npm run check:contrast   # color pairs against WCAG 2.1 AA
npm run build      # static files in dist/
```

The built `dist/` folder runs on any static host. To deploy with [Vercel](https://vercel.com), fork this repository, import the fork in Vercel, and accept the defaults. Every push to `main` then publishes a new version.

## Changing the plan

| To change | Edit |
| --- | --- |
| The weekly split, formats, sets, reps, rests, rotations | `src/engine/program.js` |
| Exercises and their notes | `src/exercises.js` |
| How weights are suggested | `src/engine/progression.js` |
| Rules and citations shown in the Why tab | `src/engine/evidence.js` |
| Colors and type | `src/styles.css` (tokens at the top) |

Run `npm test` after editing. The tests check that sessions fit the time budget, that every pattern gets enough weekly sets, and that the plan only uses equipment the person selected.

## Known limits

- Weights are in pounds only.
- Swim suggestions assume a northern-hemisphere summer (June through August), and can be switched off under Outdoor options.
- Planned cardio minutes are counted at face value; the app cannot measure how brisk a walk was.
- A web app cannot read Apple Health or other watch data. The app shows which watch workout type to start, and the watch keeps its own record.
- History from version 1 still loads, and its lifts feed the weight suggestions.

## Tech

React 18, Vite 5, and `vite-plugin-pwa` for the manifest, service worker, and offline cache. No backend.

## License

MIT. See `LICENSE`.
