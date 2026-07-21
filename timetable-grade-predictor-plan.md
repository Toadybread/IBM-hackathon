# Timetable & Grade Predictor — Plan

## Top-Level Overview

A **single-page web application** (React + TypeScript + Vite) that gives students a visual weekly timetable and an intelligent grade predictor.

**Core pillars:**
1. **Timetable editor** — 7-day grid split into 15-minute slots, between user-defined start/end times. Slots are filled by click-dragging with a selected activity colour. Two timetable modes: **School** and **Holiday**.
2. **Activity system** — Fixed activities (School, Work, Rest, Free, Fun) plus unlimited user-defined **subject study** activities each with their own colour.
3. **Grade predictor** — User registers subjects with a current UK letter grade. Study time is counted per subject (from timetable slots). Combined with work/life balance efficiency, a predicted grade is output per subject.
4. **Persistence** — All state saved to `localStorage` automatically.

**Tech stack chosen:** React + TypeScript + Vite (component-driven UI, good type safety for the prediction model, Vite for zero-config fast dev, no backend needed).

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffolding

**Intent:** Bootstrap the Vite + React + TypeScript project with a clean folder structure, install dependencies, and set up a base layout shell.

**Expected Outcomes:**
- `npm run dev` serves a blank app with no errors.
- Folder structure (`src/components`, `src/hooks`, `src/store`, `src/types`, `src/utils`) exists.
- A `localStorage` persistence hook (`useLocalStorage`) is in place for later use.

**Todo List:**
1. Scaffold project with `npm create vite@latest . -- --template react-ts`.
2. Install dependencies: `react`, `react-dom` (already included), no extra UI library needed.
3. Create folder structure: `src/components/`, `src/hooks/`, `src/store/`, `src/types/`, `src/utils/`.
4. Create `src/hooks/useLocalStorage.ts` — generic hook that reads/writes a key to `localStorage` and keeps React state in sync.
5. Create `src/types/index.ts` — define all shared TypeScript types (see Relevant Context below).
6. Create a top-level `App.tsx` with a tab bar: **Timetable**, **Subjects & Grades**, **Prediction**. Render placeholder content for each tab.
7. Add minimal global CSS (reset, font, colour variables for the 5 fixed activities).

**Relevant Context:**
- Key types needed:
  - `ActivityType` — union of `"school" | "work" | "rest" | "free" | "fun" | "study-{id}"` where `{id}` is a subject ID.
  - `Slot` — `{ activity: ActivityType | null }`.
  - `DaySchedule` — `Record<slotIndex, Slot>` (56 slots max for a 14-hour day at 15min each).
  - `Timetable` — `{ mode: "school" | "holiday"; days: Record<DayName, DaySchedule>; startHour: number; endHour: number }`.
  - `Subject` — `{ id: string; name: string; colour: string; currentGrade: UKGrade }`.
  - `UKGrade` — `"A*" | "A" | "B" | "C" | "D" | "E" | "U"`.
  - `AppState` — top-level state holding both timetables, subjects list, and week plan.

**Status:** `[ ] pending`

---

### Sub-Task 2 — First-Launch Setup Modal

**Intent:** On first run (no `localStorage` data), show a modal that collects the global timetable start/end time before anything else is shown.

**Expected Outcomes:**
- On first visit, a modal blocks the app and asks the user to pick a start time and end time (hour granularity, e.g. 06:00 – 23:00).
- Values are validated (end must be after start, minimum 1 hour range).
- On submit, values are saved to `localStorage` and the main app renders.
- On subsequent visits, the modal is skipped.
- A settings cog in the header lets the user reopen and change these times later.

**Todo List:**
1. Create `src/components/SetupModal.tsx` — two `<select>` dropdowns for start hour and end hour (00–23).
2. Add validation: disable submit if end ≤ start.
3. On confirm, write `{ startHour, endHour }` into app state via the `useLocalStorage` hook.
4. In `App.tsx`, if `startHour`/`endHour` are null, render `<SetupModal>` instead of the main UI.
5. Add a settings icon button in the app header that re-opens the modal (allowing time range changes).
6. When times change, recompute slot count and clear any slots that fall outside the new range.

**Relevant Context:**
- Uses `useLocalStorage` from Sub-Task 1.
- Slot count = `(endHour - startHour) * 4` (4 slots per hour).

**Status:** `[ ] pending`

---

### Sub-Task 3 — Activity Palette & Subject Manager

**Intent:** Build the activity/colour palette panel that the user selects before painting the timetable, and the subject manager where subjects are created/edited/deleted.

**Expected Outcomes:**
- A sidebar/panel shows the 5 fixed activities (School, Work, Rest, Free, Fun) each with a fixed default colour and a colour picker to override it.
- Below the fixed activities, a list of user-created subjects is shown, each with: name, colour swatch (colour picker), current UK grade selector, and a delete button.
- An "Add Subject" button opens an inline form to name the subject, pick a colour, and set a starting grade.
- The currently selected activity/subject is highlighted; clicking it "arms" it for painting.
- An eraser tool is also available to clear slots.
- All subject data persists via `useLocalStorage`.

**Todo List:**
1. Create `src/components/ActivityPalette.tsx` — renders fixed activity buttons and subject list.
2. For each fixed activity: coloured circle + label + colour picker (`<input type="color">`).
3. For each subject: coloured circle + editable name + grade `<select>` (A*, A, B, C, D, E, U) + colour picker + delete button.
4. "Add Subject" button appends a new subject with a generated unique ID (`crypto.randomUUID()`), default name "New Subject", random colour.
5. Expose a `selectedActivity: ActivityType | null` and `onSelect` callback so the timetable knows what to paint.
6. Wire subject CRUD into the shared `AppState` (via context or prop-drilling from `App.tsx`).

**Relevant Context:**
- Fixed activity colours (overridable defaults): School = `#4A90D9`, Work = `#E8A838`, Rest = `#7ED321`, Free = `#9B59B6`, Fun = `#E74C3C`.
- Subject activity type string: `"study-${subject.id}"`.

**Status:** `[ ] pending`

---

### Sub-Task 4 — Timetable Grid with Click-Drag Painting

**Intent:** Build the core 7-day × N-slot timetable grid. Slots are coloured by dragging with a selected activity. Support both School and Holiday timetables.

**Expected Outcomes:**
- A grid renders with rows = time slots (15-min intervals between start/end hour), columns = Mon–Sun.
- Time labels appear on the left axis (e.g. "08:00", "08:15", …).
- Clicking a single slot paints it with the selected activity colour.
- Clicking and dragging across multiple slots paints all of them in one gesture (no need to click each individually).
- A School/Holiday toggle at the top switches between the two independent timetables (both persist separately).
- Painted slots show their activity colour; empty slots are white/light grey.
- Right-clicking (or using the eraser tool) clears a slot.

**Todo List:**
1. Create `src/components/TimetableGrid.tsx`.
2. Compute `slots` array from `startHour`/`endHour`: one label per 15 minutes.
3. Render a CSS Grid: 8 columns (time label + 7 days), rows = slot count + 1 header row.
4. Each cell is a `<div>` with `onMouseDown`, `onMouseEnter`, `onMouseUp` handlers.
5. Implement drag-paint logic: `onMouseDown` sets `isPainting = true` and paints the cell; `onMouseEnter` paints if `isPainting`; `onMouseUp` (on `document`) sets `isPainting = false`.
6. Use `useRef` for `isPainting` to avoid stale closure issues in event handlers.
7. Add a School / Holiday tab/toggle above the grid; switching changes which timetable object is read/written.
8. Slot colour is resolved by looking up the activity in the subject list or fixed activity colour map.
9. Persist timetable state changes via `useLocalStorage`.
10. Add a "Clear All" button for the active timetable.

**Relevant Context:**
- Drag painting must work across column boundaries (dragging horizontally as well as vertically).
- The `document` mouseup listener should be added in `useEffect` and cleaned up on unmount.
- Grid cell size suggestion: 18px height × full column width.

**Status:** `[ ] pending`

---

### Sub-Task 5 — Week Plan Configuration

**Intent:** Let the user specify how many weeks each timetable type runs for, so that total study hours can be computed accurately.

**Expected Outcomes:**
- A "Week Plan" section (in the Prediction tab or a dedicated panel) lets the user add rows, each row being a "period" with: type (School or Holiday), number of weeks.
- Multiple periods can be added (e.g. 6 weeks school, 2 weeks holiday, 6 weeks school).
- Total weeks and total hours per activity are derived from the week plan and timetable slot data.
- Values persist in `localStorage`.

**Todo List:**
1. Create `src/components/WeekPlan.tsx`.
2. Render a list of period rows: `<select>` for School/Holiday + number input for weeks + delete button.
3. "Add Period" button appends a new row (defaults: School, 1 week).
4. Compute derived stats on the fly:
   - For each period, count slots per activity in the relevant timetable × 0.25 hours × 7 days × weeks.
   - Aggregate totals across all periods into a `Record<ActivityType, number>` (hours map).
5. Export the computed totals for use by the Grade Predictor (Sub-Task 6).

**Relevant Context:**
- Study hours per subject = `slotCount(study-{id}) × 0.25 × 7 × weeks` summed across all periods using the matching timetable type.
- Work/life balance ratio (see Sub-Task 6) is also derived from these totals.

**Status:** `[ ] pending`

---

### Sub-Task 6 — Grade Prediction Engine

**Intent:** Implement the grade prediction algorithm and render its results per subject.

**Expected Outcomes:**
- For each subject, the app shows: current grade, predicted grade, total study hours, and a work/life balance indicator.
- The prediction is recalculated live whenever timetable slots, week plan, or grades change.
- The work/life balance ratio visibly affects the predicted grade (too low or too high study ratio reduces efficiency).

**Algorithm Design:**
```
totalTime        = sum of ALL activity hours (from week plan computation)
recreationalTime = sum of hours for Free + Fun + Rest activities
balanceRatio     = recreationalTime / totalTime   (range 0–1)

// Optimal balance is around 0.35 (35% recreational). Efficiency peaks there.
// Below 0.15 (overworked) or above 0.60 (underworked) degrades efficiency.
efficiency = bell-curve function peaking at balanceRatio ≈ 0.35
           = clamp(1 - 2.5 × (balanceRatio - 0.35)², 0.3, 1.0)

studyHours(subject) = from week plan totals for that subject's activity type
gradePoints(grade)  = { U:0, E:1, D:2, C:3, B:4, A:5, "A*":6 }

// --- GRADE IMPROVEMENT (sufficient study) ---
// Logarithmic curve: early hours give the biggest boost, diminishing returns over time.
effectiveHours      = studyHours × efficiency
rawGain             = log(1 + effectiveHours / LOG_SENSITIVITY)          // LOG_SENSITIVITY = 40 (tunable)
normalisedGain      = rawGain / log(1 + MAX_REFERENCE_HOURS / LOG_SENSITIVITY)  // MAX_REFERENCE_HOURS = 500
pointsGain          = normalisedGain × MAX_GRADE_GAIN                    // MAX_GRADE_GAIN = 4 (tunable)

// --- GRADE DROP (insufficient study) ---
// A minimum threshold of effective hours per week is required to maintain a grade.
// Below this threshold, the grade decays proportionally to the shortfall × duration.
//
// MAINTENANCE_HOURS_PER_WEEK = 1.5  (tunable — hours/week needed to hold current grade)
// maintenanceHours = MAINTENANCE_HOURS_PER_WEEK × totalWeeks
//
// If effectiveHours < maintenanceHours:
//   shortfallRatio  = (maintenanceHours - effectiveHours) / maintenanceHours  (0–1)
//   pointsDrop      = shortfallRatio × MAX_GRADE_DROP                         // MAX_GRADE_DROP = 3 (tunable)
//   net delta       = -pointsDrop   (grade goes down)
// Else:
//   net delta       = +pointsGain   (grade goes up or holds)
//
// Final:
netDelta        = (effectiveHours >= maintenanceHours) ? +pointsGain : -pointsDrop
predictedPoints = clamp(gradePoints(current) + netDelta, 0, 6)
predictedGrade  = grade at round(predictedPoints)
```

**Todo List:**
1. Create `src/utils/gradePredictor.ts` — pure functions implementing the algorithm above.
2. Export `computeEfficiency(balanceRatio: number): number`.
3. Export `predictGrade(currentGrade: UKGrade, studyHours: number, efficiency: number, totalWeeks: number): UKGrade`.
4. Create `src/components/GradePredictor.tsx` — reads week plan totals and subject list, calls the predictor, renders a table.
5. Table columns: Subject | Current Grade | Study Hours | Efficiency % | Predicted Grade — with the Predicted Grade cell coloured green (improvement), grey (no change), or red (drop).
6. Add a work/life balance summary card showing: total hours breakdown (pie or bar), balance ratio, and efficiency percentage.
7. Add a small explanatory note: e.g. "Grade improvements follow a logarithmic curve — the first study hours have the most impact. Insufficient study relative to the plan duration will cause grade drops."
8. Display total weeks (sum of all week plan periods) alongside the prediction results so the user can see the duration driving the output.

**Relevant Context:**
- Tunable constants (named in code): `LOG_SENSITIVITY = 40`, `MAX_REFERENCE_HOURS = 500`, `MAX_GRADE_GAIN = 4`, `MAX_GRADE_DROP = 3`, `MAINTENANCE_HOURS_PER_WEEK = 1.5`.
- Grade point scale: U=0, E=1, D=2, C=3, B=4, A=5, A*=6 (7 levels).
- The maintenance threshold scales with total weeks — a 2-week plan needs only 3 hrs to maintain; a 6-month plan needs ~36 hrs. This means skipping study over a long plan is punished more than a short one.
- Efficiency must never drop below 0.3 (30%) to avoid wiping out all gain.
- The predicted grade cell should visually indicate direction: ▲ green for improvement, — grey for no change, ▼ red for drop.

**Status:** `[ ] pending`

---

### Sub-Task 7 — Polish, Layout & Persistence Wiring

**Intent:** Tie all components together into a cohesive, usable UI. Ensure all state flows correctly, localStorage is always up to date, and the app looks presentable.

**Expected Outcomes:**
- Three-tab layout (Timetable | Subjects & Grades | Prediction) works cleanly.
- Activity palette is always visible alongside the timetable (sidebar layout on desktop).
- All state changes (timetable paint, subject add/edit/delete, week plan edits, grade changes) immediately reflect in the Prediction tab.
- App loads without errors on a fresh browser (no data) and on a returning browser (with stored data).
- Basic responsive behaviour: usable on a laptop screen (1280px+).

**Todo List:**
1. Wire global `AppState` using React Context (or lift state fully to `App.tsx` and prop-drill — keep it simple).
2. Ensure `useLocalStorage` is called for: `appSettings` (startHour/endHour), `schoolTimetable`, `holidayTimetable`, `subjects`, `weekPlan`.
3. Timetable tab: left sidebar = `<ActivityPalette>`, right main area = `<TimetableGrid>`.
4. Subjects & Grades tab: renders the subject manager portion of `<ActivityPalette>` in full-page form.
5. Prediction tab: `<WeekPlan>` at top, `<GradePredictor>` below.
6. Add a legend on the timetable showing which colour = which activity.
7. Apply consistent typography, spacing, and colour scheme throughout (CSS variables from Sub-Task 1).
8. Test round-trip: set up timetable → assign subjects → set week plan → view predictions → refresh page → verify everything restored.

**Relevant Context:**
- Keep state management simple: React Context with `useReducer` or just `useState` lifted to `App.tsx`.
- Avoid over-engineering — no Redux, no Zustand needed for this scope.

**Status:** `[ ] pending`

---

## Architecture Diagram (reference)

```
App.tsx  (global state + tab routing)
├── SetupModal.tsx          (first-launch time picker)
├── [Tab: Timetable]
│   ├── ActivityPalette.tsx (colour picker + subject list + eraser)
│   └── TimetableGrid.tsx   (7-day grid, drag-paint)
├── [Tab: Subjects & Grades]
│   └── SubjectManager.tsx  (subject CRUD, grade assignment)
└── [Tab: Prediction]
    ├── WeekPlan.tsx         (period rows → computed hours)
    └── GradePredictor.tsx   (per-subject prediction table)
         └── gradePredictor.ts  (pure prediction logic)
```

## Data Flow

```
Timetable slots  ──┐
Week plan        ──┼──► hoursTotals(ActivityType → hours)
                   │
                   ├──► balanceRatio ──► efficiency
                   │
Subjects + grades ─┴──► predictGrade() ──► predicted grade per subject
```
