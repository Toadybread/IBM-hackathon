# Custom Timetable Types + Timeline Viewer — Plan

## Top-Level Overview

Extend the app so users can create any number of named timetables (e.g. "School", "Holiday", "France", "Work Experience") instead of the current hardcoded school/holiday pair. Each timetable in the week plan references one of these by ID. A new **Timeline Viewer** at the bottom of the Prediction tab shows all weeks in order — one timetable grid per week — navigable by arrow buttons or scroll.

**Scope of change:**
1. Data model — replace the two fixed timetables with a `Record<id, NamedTimetable>` map. `WeekPeriod.type` becomes `timetableId`.
2. Timetable manager — a new panel (new tab or within Timetable tab) where timetables can be created, renamed, and deleted. The editor toggle changes from "School / Holiday" to a dropdown of all timetable names.
3. Week plan — the type select in each period row becomes a dropdown listing all named timetables.
4. Compute layer — `computeTotals` and the optimiser are updated to work with the new map.
5. Timeline viewer — a new `TimelineViewer` component in the Prediction tab.

---

## Sub-Tasks

---

### Sub-Task 1 — Data model: replace fixed timetables with a named map

**Intent:** Change the core types so timetables are stored as a `Record<id, NamedTimetable>` and `WeekPeriod` references them by ID. Migrate existing localStorage data gracefully.

**Expected Outcomes:**
- `NamedTimetable` type exists: `{ id: string; name: string; timetable: Timetable }`.
- `WeekPeriod.type` is replaced by `WeekPeriod.timetableId: string`.
- `AppState` no longer has `schoolTimetable` / `holidayTimetable` — instead has `timetables: Record<string, NamedTimetable>`.
- A helper `createDefaultTimetables()` creates the initial two entries ("School" and "Holiday") with stable IDs (`'school'` and `'holiday'`) for backwards migration.
- `computeTotals` in `timetableUtils.ts` is updated to accept `timetables: Record<string, NamedTimetable>` instead of two separate timetable params.
- Existing localStorage data (old `schoolTimetable` / `holidayTimetable` / `weekPlan` keys) migrates automatically: on first load, if the old keys exist but the new `timetables` key does not, the app reads the old keys and writes them into the new structure.

**Todo List:**
1. In `src/types/index.ts`, add `NamedTimetable` interface: `{ id: string; name: string; timetable: Timetable }`.
2. Change `WeekPeriod`: remove `type: 'school' | 'holiday'`, add `timetableId: string`.
3. Update `AppState` to replace `schoolTimetable` / `holidayTimetable` with `timetables: Record<string, NamedTimetable>`.
4. Add `createDefaultTimetables(): Record<string, NamedTimetable>` helper that returns `{ school: { id: 'school', name: 'School', timetable: empty }, holiday: { id: 'holiday', name: 'Holiday', timetable: empty } }`.
5. In `src/utils/timetableUtils.ts`, update `computeTotals` signature to `(weekPlan, timetables)` — look up timetable by `period.timetableId`.
6. In `src/App.tsx`, replace the two `useLocalStorage` calls for the old timetables with a single `useLocalStorage<Record<string, NamedTimetable>>('timetables', createDefaultTimetables())`. Add a one-time migration: if `localStorage.getItem('schoolTimetable')` exists and `localStorage.getItem('timetables')` does not, read the old values and construct the new structure.
7. Update `WeekPlan` default period: `timetableId: 'school'` (points to the default School entry).

**Relevant Context:**
- `WeekPeriod` currently: `{ id, type: 'school'|'holiday', weeks }` — `type` becomes `timetableId`.
- `computeTotals` currently takes `(weekPlan, schoolTimetable, holidayTimetable)` — becomes `(weekPlan, timetables)`.
- The two stable IDs `'school'` and `'holiday'` allow existing week plans that still reference those IDs to keep working after migration.
- `src/utils/optimiserUtils.ts` calls `optimiseTimetable(timetable, ...)` with a single timetable — this stays the same; the caller just looks up the active timetable from the map.

**Status:** `[ ] pending`

---

### Sub-Task 2 — Timetable manager: create, rename, delete

**Intent:** Give the user a UI to manage the pool of named timetables. Accessible from the Timetable tab as a panel above or alongside the editor.

**Expected Outcomes:**
- A "Timetables" section appears at the top of the Timetable tab (above the activity palette + grid layout) or as a small toolbar.
- Lists all named timetables as tabs or chips: name shown, with a rename (pencil) button and a delete (trash) button per entry.
- An "＋ Add Timetable" button creates a new blank timetable with a generated name ("New Timetable").
- Rename is inline: clicking the pencil replaces the name with an `<input>` field, confirmed on blur or Enter.
- Deleting a timetable that is referenced by one or more `WeekPeriod` entries shows a confirmation: "This timetable is used in your week plan. Deleting it will remove those periods. Continue?"
- Deleting automatically removes any `WeekPeriod` entries that reference it.
- The currently active timetable in the editor is selected by clicking its chip/tab — this replaces the old School/Holiday toggle in `TimetableGrid`.
- The `TimetableGrid` no longer owns the mode toggle — it receives the active timetable directly and a setter; the tab selection happens in the parent.

**Todo List:**
1. Create `src/components/TimetableManager.tsx` — renders the timetable chip list, add/rename/delete controls.
2. Props: `timetables`, `onTimetablesChange`, `activeTimetableId`, `onActiveTimetableChange`.
3. Add button, rename inline, delete with confirmation if referenced in weekPlan.
4. In `App.tsx`, add `activeTimetableId` state (default `'school'`), render `<TimetableManager>` above the timetable layout, wire into `<TimetableGrid>`.
5. Simplify `TimetableGrid` props: remove `schoolTimetable`, `holidayTimetable`, `onSchoolTimetableChange`, `onHolidayTimetableChange`; add `timetable: Timetable` and `onTimetableChange: (t: Timetable) => void`. Remove the internal School/Holiday toggle state.
6. Update `App.tsx` to pass `timetable={timetables[activeTimetableId].timetable}` and a handler that writes back into the map.
7. Update the Optimise button handler in `TimetableGrid` to pass the active timetable to `optimiseTimetable` (unchanged in logic, just the prop name changes).

**Relevant Context:**
- `TimetableGrid` currently toggles between `schoolTimetable` / `holidayTimetable` internally. This internal toggle is removed; the active timetable is chosen externally by `TimetableManager`.
- `activeTimetableId` needs to stay in sync — if the active timetable is deleted, fall back to the first remaining timetable.
- When time range changes (settings modal), the confirm-and-clear logic in `App.tsx` now clears all timetables in the map, not just the two old ones.

**Status:** `[ ] pending`

---

### Sub-Task 3 — Week plan: timetable selector per period

**Intent:** Update the WeekPlan period rows to show a dropdown of all named timetables instead of the hardcoded "School Week / Holiday Week" select.

**Expected Outcomes:**
- Each period row's `<select>` lists all named timetables by name, keyed by ID.
- Adding a new period defaults `timetableId` to the first available timetable.
- If a timetable is deleted (Sub-Task 2 handles removal of periods), the WeekPlan re-renders cleanly with the remaining periods.
- `computeTotals` (updated in Sub-Task 1) correctly looks up timetables from the map.

**Todo List:**
1. In `src/components/WeekPlan.tsx`, add `timetables: Record<string, NamedTimetable>` prop.
2. Replace the hardcoded `<option value="school">` / `<option value="holiday">` with `Object.values(timetables).map(t => <option value={t.id}>{t.name}</option>)`.
3. Change `handleTypeChange` → `handleTimetableChange` updating `timetableId`.
4. Change `handleAddPeriod` to default to `timetableId: Object.keys(timetables)[0] ?? 'school'`.
5. Update `computeTotals` call: pass `timetables` map (Sub-Task 1 already changed the signature).
6. In `App.tsx`, pass `timetables` down to `<WeekPlan>`.

**Relevant Context:**
- `WeekPlan.tsx` currently imports and calls `computeTotals(weekPlan, schoolTimetable, holidayTimetable)` — this becomes `computeTotals(weekPlan, timetables)` after Sub-Task 1.
- `WeekPlan` currently takes `schoolTimetable` and `holidayTimetable` as props — both removed, replaced with `timetables`.

**Status:** `[ ] pending`

---

### Sub-Task 4 — Optimiser: update to use timetable map

**Intent:** Update the Optimise button wiring in `TimetableGrid` and `App.tsx` to work with the new model (single active timetable instead of two named props).

**Expected Outcomes:**
- The Optimise button still works exactly as before, now using the active timetable from the map.
- `optimiseTimetable()` itself is unchanged (it already takes a single `Timetable`).

**Todo List:**
1. In `TimetableGrid.tsx`, the `handleOptimise` function now uses the `timetable` prop (single timetable) directly — no change needed to the call itself, just the source of the active timetable is now `props.timetable` (from Sub-Task 2).
2. In `App.tsx`, the `onTimetableChange` handler passed to `TimetableGrid` writes the optimised result back into `timetables[activeTimetableId].timetable`.
3. Verify that the `hasReplaceable` check and `setTimetable(optimised)` still work with the simplified prop.

**Relevant Context:**
- After Sub-Task 2, `TimetableGrid` has a single `timetable` prop and `onTimetableChange`. `handleOptimise` uses `props.timetable` as the input — no structural change to optimiser logic.

**Status:** `[ ] pending`

---

### Sub-Task 5 — Timeline Viewer component

**Intent:** Build a new `TimelineViewer` component that renders all weeks in the plan in order, one per "slide", navigable with ◀ ▶ arrows. Each slide shows the timetable for that week (using the read-only grid) labelled with the week number and timetable name.

**Expected Outcomes:**
- Placed at the bottom of the Prediction tab, below `<GradePredictor>`.
- Shows "Week 1 of N — School" with the full timetable grid (read-only, no painting).
- ◀ and ▶ arrow buttons navigate week by week. Keyboard left/right arrow keys also work when the viewer is focused.
- The title shows which timetable type the current week uses (e.g. "Week 3 of 10 — France").
- Expanding the week plan expands the viewer (e.g. adding 3 more weeks appends to the end).
- The viewer is purely read-only — no drag-paint events.
- A compact read-only version of `TimetableGrid` (or the existing one with painting disabled) is reused.

**Algorithm — mapping week number to timetable:**
```
Build a flat array: weekSequence = []
For each period in weekPlan (in order):
  for i in 0..period.weeks-1:
    weekSequence.push({ weekNumber: globalIndex+1, timetableId: period.timetableId, timetableName: timetables[period.timetableId].name })
currentWeekIndex = useState(0)
displayed timetable = timetables[weekSequence[currentWeekIndex].timetableId].timetable
```

**Todo List:**
1. Create `src/components/TimelineViewer.tsx`.
2. Props: `weekPlan: WeekPeriod[]`, `timetables: Record<string, NamedTimetable>`, `startHour: number`, `endHour: number`, `activityColours: Record<string, string>`, `legendItems`.
3. Build `weekSequence` array from `weekPlan` using the algorithm above.
4. Render the ◀ / ▶ nav, week label, and a **read-only** timetable grid.
5. For the read-only grid, render the same CSS grid structure from `TimetableGrid` but without `onMouseDown`/`onMouseEnter` handlers and without the controls bar (no mode toggle, no Clear All, no Optimise).
6. Add a `TimelineViewer.css` for layout and nav button styling.
7. If `weekSequence` is empty (no week plan), show a placeholder: "Add periods to the study plan above to see your timeline."
8. In `App.tsx`, add `<TimelineViewer>` below `<GradePredictor>` in the prediction tab, passing the relevant props.
9. In `src/components/WeekPlan.css`, add a `prediction-layout` flex column direction if not already present (the three stacked items: WeekPlan, GradePredictor, TimelineViewer).

**Relevant Context:**
- The read-only grid can be extracted into a shared `TimetableGridDisplay` sub-component, or TimelineViewer can inline the grid markup — inlining is simpler given scope.
- `activityColours` and `legendItems` are already computed in `App.tsx` and passed down to other components — pass through to TimelineViewer the same way.
- Navigation: `currentWeekIndex` clamped to `[0, weekSequence.length - 1]`.

**Status:** `[ ] pending`

---

## Architecture Changes Summary

| File | Change |
|---|---|
| `src/types/index.ts` | Add `NamedTimetable`; change `WeekPeriod.type` → `timetableId`; update `AppState` |
| `src/utils/timetableUtils.ts` | `computeTotals` signature: `timetables` map replaces two timetable params |
| `src/App.tsx` | One `timetables` map replaces two timetable states; migration logic; pass new props down |
| `src/components/TimetableManager.tsx` | **New file** — create/rename/delete timetables |
| `src/components/TimetableGrid.tsx` | Simplified props: single `timetable` + `onTimetableChange`; internal toggle removed |
| `src/components/WeekPlan.tsx` | Period type select → dynamic timetable dropdown; `timetables` prop added |
| `src/components/TimelineViewer.tsx` | **New file** — week-by-week read-only viewer |
| `src/components/TimelineViewer.css` | **New file** |
| `src/utils/optimiserUtils.ts` | No change to logic; caller change only |

## Data Flow (updated)

```
timetables: Record<id, NamedTimetable>   ←── TimetableManager (create/rename/delete)
        │                                ←── TimetableGrid (edit active one)
        ├──► WeekPlan (period selector lists timetable names)
        ├──► computeTotals(weekPlan, timetables) ──► hourTotals ──► GradePredictor
        └──► TimelineViewer (weekSequence → slide per week)
```
