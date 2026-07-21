# Timetable Optimiser — Plan

## Top-Level Overview

Add an **"Optimise Timetable"** feature to the existing app. The feature has three parts working together:

1. **Target grade input** — Each subject gets a new `targetGrade` field (alongside the existing `currentGrade`). The user sets this in the Subjects & Grades tab.
2. **Gap analysis panel** — In the Prediction tab, for each subject show how many more study hours per week are needed to hit the target, and flag whether the current timetable is on track, under-studied, or over-studied.
3. **Auto-optimise** — A button on the Timetable tab that rewrites the active timetable (school or holiday). It calculates the required study hours per subject (weighted by how far each is from its target), then fills those hours by converting existing slots in priority order: **free → rest → fun** (never touching school or work). Slots are converted in **contiguous chunks first** (e.g. a 4-slot free block becomes a single subject block) before picking isolated slots. Subjects furthest from their target get the most hours.

**Scope:** Only the currently active timetable mode (school or holiday) is modified by the optimiser. The other timetable is untouched.

---

## Sub-Tasks

---

### Sub-Task 1 — Add `targetGrade` to the Subject type and UI

**Intent:** Extend the data model so each subject has both a current grade and a target grade. Wire the new field into the SubjectManager UI and persist it.

**Expected Outcomes:**
- `Subject` interface in `src/types/index.ts` has a new optional field `targetGrade: UKGrade`.
- The SubjectManager renders a second grade `<select>` labelled "Target" next to the existing "Current" grade selector.
- Existing saved subjects (no `targetGrade` in localStorage) default to the current grade on load (no data migration needed — optional field with fallback).
- The new field is persisted automatically via the existing `useLocalStorage` hook (no extra wiring needed — it serialises the whole `subjects` array).

**Todo List:**
1. In `src/types/index.ts`, add `targetGrade?: UKGrade` to the `Subject` interface.
2. In `src/components/SubjectManager.tsx`, add a "Target Grade" `<select>` (same `UKGrade` options) next to the existing "Current Grade" select for each subject row.
3. Wire the onChange to update `subject.targetGrade` via `onSubjectsChange`.
4. When reading `subject.targetGrade` elsewhere, fall back to `subject.currentGrade` if undefined.

**Relevant Context:**
- `Subject` interface: `src/types/index.ts` lines 62–67.
- `SubjectManager.tsx`: grade select is around line 78; `UKGrade` values are `A* A B C D E U`.
- No migration logic needed — `targetGrade` is optional and callers will use `?? subject.currentGrade`.

**Status:** `[ ] pending`

---

### Sub-Task 2 — Gap Analysis in the Prediction tab

**Intent:** Extend the GradePredictor component to show, per subject, how many hours/week more (or fewer) are needed relative to what the timetable currently provides, based on the target grade.

**Expected Outcomes:**
- The prediction table gets two new columns: **Target Grade** and **Hours Gap**.
- "Hours Gap" is positive (need more study) or negative (already over-studying for target), displayed with a ▲/✓/▼ indicator.
- A subject shows **"on track ✓"** (green) when the *current* predicted grade (based on whatever is already in the timetable) is ≥ the target grade — no optimisation needed first.
- The gap column is colour-coded: red = under, green = on-track or over.

**Algorithm:**
```
For each subject:
  predictedGrade = existing predictGrade() result
  targetPoints   = GRADE_POINTS[subject.targetGrade ?? subject.currentGrade]
  predictedPoints = GRADE_POINTS[predictedGrade]
  onTrack = predictedPoints >= targetPoints
  // Estimate required effective hours to reach target:
  // Invert the gain formula: effectiveHoursNeeded = (e^(normGain × ln(1 + MAX_REF/SENS)) - 1) × SENS
  // where normGain = (targetPoints - currentPoints) / MAX_GRADE_GAIN
  // Then rawStudyHoursNeeded = effectiveHoursNeeded / efficiency
  // hoursGap = rawStudyHoursNeeded - subjectHours  (per the full plan duration)
  // hoursPerWeekGap = hoursGap / totalWeeks
```

**Todo List:**
1. Add a pure helper `computeRequiredHours(currentGrade, targetGrade, efficiency, totalWeeks): number` to `src/utils/gradePredictor.ts` — returns the raw study hours needed over the whole plan to reach `targetGrade` from `currentGrade` given an efficiency, clamped to `[0, Infinity]`.
2. In `src/components/GradePredictor.tsx`, add **Target Grade** and **Hours/Week Gap** columns to the prediction table.
3. Compute `hoursGap` per subject using the new helper; display as `+X.X h/wk` (red) or `on track ✓` (green).
4. Pass `subjects` (with `targetGrade`) through — no new props needed, `subjects` is already a prop.

**Relevant Context:**
- `GradePredictor.tsx`: prediction table rows built around line 50–58; table columns at lines 132–138.
- `gradePredictor.ts`: `GRADE_POINTS`, `POINTS_TO_GRADE`, `LOG_SENSITIVITY`, `MAX_REFERENCE_HOURS`, `MAX_GRADE_GAIN` constants all live there.
- Inverting the log gain: `effectiveHoursNeeded = (exp(normGain × ln(1 + MAX_REF/SENS)) - 1) × SENS`.

**Status:** `[ ] pending`

---

### Sub-Task 3 — Optimiser engine (pure utility)

**Intent:** Write the core optimisation logic as a pure function in `src/utils/optimiserUtils.ts`. It takes the current timetable, subjects with target grades, week plan totals, and returns a new timetable with study slots filled in.

**Rules (must be encoded exactly):**
- Only the timetable passed in is modified (school or holiday — caller decides which).
- Slots are converted in this priority order: **free first, then rest, then fun**. School and work slots are never touched. Empty (`null`) slots are never filled.
- When converting, prefer **contiguous runs** of the same replaceable activity before picking isolated slots. A "run" is consecutive slot indices (within the same day) of the same activity.
- **Partial run splitting is allowed**: if a run has more slots than a subject still needs, take only what is needed from the start of the run (the remainder stays as the original activity).
- Subjects that need the most improvement (largest gap between current points and target points) get allocated the most hours. Allocation is proportional to the grade-point gap: `gap_i / sum(all gaps)`.
- Minimum allocation: if a subject is already at or above target, it receives 0 additional hours (skip it entirely).
- **Weekday preference**: slots are distributed across days weighted by a user-supplied `weekdayBias` multiplier (default `2`, range `1–10`). Each weekday (Mon–Fri) has weight `weekdayBias`; each weekend day (Sat–Sun) has weight `1`. When choosing which day to place the next slot, the algorithm picks the eligible day with the **lowest current study-slot density** (existing study slots / total slots), using the bias as a tie-breaker. Concretely: compute `density × (isWeekend ? weekdayBias : 1)` for each day and pick the minimum — this naturally avoids weekdays already `weekdayBias`× more full than the weekends.
- Return the new `Timetable` — do not mutate the input.

**Function signature:**
```typescript
export function optimiseTimetable(
  timetable: Timetable,
  subjects: Subject[],          // includes targetGrade
  totalWeeks: number,
  efficiency: number,
  weekdayBias: number,          // default 2; range 1–10
): Timetable
```

**Todo List:**
1. Create `src/utils/optimiserUtils.ts`.
2. Implement `collectReplaceable(timetable)` — iterates all days, groups consecutive slots of `free`, `rest`, `fun` into sorted runs. Returns a list of `{day, startSlot, length, activity}` sorted: `free` runs first, then `rest`, then `fun`; within each group, longest runs first.
3. Implement `computeAllocations(subjects, totalWeeks, efficiency)` — for each subject compute the gap (target points − current points, clamped to ≥ 0), proportional share of total available replaceable slots. Returns `Map<subjectId, slotsNeeded>`.
4. Implement `fillTimetable(timetable, runs, allocations, subjects, weekdayBias)` — iterates runs in priority order, splits runs as needed, assigns slots to the subject with the most remaining allocation. When choosing which run to take next, prefer the day with the lowest bias-adjusted study density (see weekday preference rule above).
5. Export `optimiseTimetable()` combining the above steps, accepting `weekdayBias` and passing it through.

**Relevant Context:**
- `Timetable` type: `{ days: Record<DayName, DaySchedule> }` where `DaySchedule = Record<number, Slot>`.
- `DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']` from `src/types/index.ts`.
- Weekdays = Mon, Tue, Wed, Thu, Fri. Weekend = Sat, Sun.
- Slot activity is `ActivityType | null`; `null` means empty (do not replace empty slots — only replace `free`/`rest`/`fun`).
- `Subject.targetGrade` is optional — fall back to `currentGrade`.

**Status:** `[ ] pending`

---

### Sub-Task 4 — Optimise button + weekday bias slider on the Timetable tab

**Intent:** Add an "✨ Optimise" button and a weekday-bias slider to the timetable view. When the button is clicked, it runs the optimiser engine on the active timetable using the current slider value.

**Expected Outcomes:**
- An "✨ Optimise" button appears in the timetable toolbar (near the existing Clear All button).
- A **Weekday Bias** slider sits next to the button, labelled e.g. `Weekday bias: 2×`. Range: 1–10, step 1, default 2. The slider value is stored in component state (not persisted — it resets on page load).
- Clicking the Optimise button shows a brief confirmation: "This will replace free/rest/fun slots to fit your target grades. Continue?" with OK / Cancel.
- On OK, the optimised timetable is written back via the existing `onSchoolTimetableChange` / `onHolidayTimetableChange` callbacks.
- If no subjects have a target grade that is higher than their current grade (nothing to optimise), show an alert: "No subjects need improvement — set higher target grades in the Subjects & Grades tab."
- If there are no replaceable slots (no free/rest/fun in the timetable), show an alert: "No free, rest, or fun slots available to replace."

**Todo List:**
1. In `src/components/TimetableGrid.tsx`, import and call `optimiseTimetable` from `src/utils/optimiserUtils.ts`.
2. Add `subjects`, `totalWeeks`, and `efficiency` as new props to `TimetableGridProps`.
3. Add a `weekdayBias` state variable (default `2`) inside `TimetableGrid`.
4. Add the "✨ Optimise" button and the bias slider to the toolbar JSX.
5. Implement the click handler: validate → confirm → call `optimiseTimetable(activeTimetable, subjects, totalWeeks, efficiency, weekdayBias)` → write result back.
6. In `src/App.tsx`, pass `subjects`, `totalWeeks` (already in state), and `efficiency` (derived via `computeBalanceStats(hourTotals).efficiency`) down to `<TimetableGrid>`.

**Relevant Context:**
- `TimetableGrid.tsx`: existing toolbar contains the School/Holiday toggle and a Clear All button — add the new controls there.
- `App.tsx` lines 44–46: `hourTotals` and `totalWeeks` are transient state; `computeBalanceStats` from `gradePredictor.ts` gives `efficiency`.
- `computeBalanceStats` is already exported from `src/utils/gradePredictor.ts`.
- Do NOT add `weekPlan` as a prop — `totalWeeks` and `efficiency` (already derived) are sufficient for the optimiser.

**Status:** `[ ] pending`

---

## Data Flow (new additions)

```
Subject.targetGrade  ──┐
Subject.currentGrade ──┼──► computeAllocations() ──► slotsNeeded per subject
efficiency              │
totalWeeks             ─┘

Timetable (active) ──► collectReplaceable() ──► sorted runs (free→rest→fun, long→short)

runs + allocations ──► fillTimetable() ──► optimised Timetable
```

## Architecture Changes Summary

| File | Change |
|---|---|
| `src/types/index.ts` | Add `targetGrade?: UKGrade` to `Subject` |
| `src/components/SubjectManager.tsx` | Add Target Grade select per subject row |
| `src/utils/gradePredictor.ts` | Add `computeRequiredHours()` helper |
| `src/components/GradePredictor.tsx` | Add Target Grade + Hours/Week Gap columns |
| `src/utils/optimiserUtils.ts` | New file — entire optimiser engine |
| `src/components/TimetableGrid.tsx` | Add Optimise button + new props |
| `src/App.tsx` | Pass `subjects`, `weekPlan`, `efficiency` to TimetableGrid |
