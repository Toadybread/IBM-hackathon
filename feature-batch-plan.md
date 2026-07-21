# Feature Batch Plan — Difficulty, What-If, Grade History, Copy Day, Locked Slots, Undo, Dark Mode, Full Export

## Top-Level Overview

Eight features added in independent sub-tasks. Each is self-contained and can be reviewed before the next starts.

| # | Feature | Where it lives |
|---|---|---|
| 1 | Subject difficulty weighting | `types`, `SubjectManager`, `gradePredictor`, `GradePredictor` |
| 2 | What-if simulator panel | New `WhatIfPanel` component in Prediction tab |
| 3 | Grade history / progress log | `types`, `SubjectManager`, new `GradeHistory` component |
| 4 | Copy day (right-click day header) | `TimetableGrid` only |
| 5 | Locked slots (middle-mouse) | `types` (Slot), `TimetableGrid`, `optimiserUtils` |
| 6 | Undo / redo | `TimetableGrid` (local undo stack) |
| 7 | Dark mode | `index.css`, `App.tsx` (toggle in header) |
| 8 | Full data export / import | `App.tsx` header buttons |

---

## Sub-Task 1 — Subject difficulty weighting

**Intent:** Let users rate each subject as Easy / Medium / Hard. The difficulty scales the `MAINTENANCE_HOURS_PER_WEEK` and `MAX_GRADE_GAIN` constants per subject so harder subjects need more study to maintain and gain less per hour.

**Expected Outcomes:**
- `Subject` has a new optional field `difficulty: 'easy' | 'medium' | 'hard'` (default `'medium'`).
- `SubjectManager` shows a 3-option segmented control (Easy / Medium / Hard) per row.
- `predictGrade` and `computeRequiredHours` gain an optional `difficulty` parameter, scaling:
  - `MAINTENANCE_HOURS_PER_WEEK`: Easy × 0.7, Medium × 1.0, Hard × 1.5
  - `MAX_GRADE_GAIN`: Easy × 1.2, Medium × 1.0, Hard × 0.8
- `GradePredictor` passes `subject.difficulty` into the prediction calls.
- `optimiserUtils.computeAllocations` passes difficulty through when computing required hours.

**Todo List:**
1. `src/types/index.ts` — add `difficulty?: 'easy' | 'medium' | 'hard'` to `Subject`.
2. `src/utils/gradePredictor.ts` — export `DIFFICULTY_FACTORS` constant map; add `difficulty` param (default `'medium'`) to `predictGrade` and `computeRequiredHours`, scaling `maintenanceHours` and `MAX_GRADE_GAIN` accordingly.
3. `src/components/SubjectManager.tsx` — add a 3-button segmented control (Easy/Medium/Hard) per subject row; wire `handleDifficultyChange`.
4. `src/components/SubjectManager.css` — style the segmented control.
5. `src/components/GradePredictor.tsx` — pass `subject.difficulty` to `predictGrade` and `computeRequiredHours` calls.
6. `src/utils/optimiserUtils.ts` — pass `subject.difficulty` to `computeRequiredHours` in `computeAllocations`.

**Relevant Context:**
- `predictGrade` signature currently: `(currentGrade, studyHours, efficiency, totalWeeks)` — add `difficulty?` as last param.
- `computeRequiredHours` signature currently: `(currentGrade, targetGrade, efficiency, _totalWeeks)` — same addition.
- Difficulty scaling constants: `{ easy: { maintenance: 0.7, gain: 1.2 }, medium: { maintenance: 1.0, gain: 1.0 }, hard: { maintenance: 1.5, gain: 0.8 } }`.

**Status:** `[ ] pending`

---

## Sub-Task 2 — What-if simulator panel

**Intent:** Add a "What-if" panel in the Prediction tab where users can temporarily adjust study hours per subject via sliders to see live grade predictions, without touching the real timetable.

**Expected Outcomes:**
- A collapsible "What-if Simulator" card appears in the Prediction tab below GradePredictor.
- Shows each subject with a slider: "Extra study hours per week: +0" ranging from -5 to +10, step 0.5.
- Predicted grade recalculates live based on `(actual hours from timetable) + slider offset`.
- The panel shows a side-by-side table: Subject | Actual Predicted | What-if Predicted.
- Changes are purely local state — refreshing resets all sliders to 0.
- A "Reset all" button zeroes every slider.

**Todo List:**
1. Create `src/components/WhatIfPanel.tsx`.
2. Props: `subjects`, `totals: HourTotals`, `totalWeeks`, `efficiency`.
3. Local state: `offsets: Record<subjectId, number>` initialised to 0.
4. Render collapsible section header (click to expand/collapse).
5. Per subject: label + slider + live what-if predicted grade badge.
6. Comparison column: actual predicted (from existing `predictGrade`) vs what-if predicted.
7. "Reset all" button.
8. Create `src/components/WhatIfPanel.css`.
9. In `App.tsx`, add `<WhatIfPanel>` below `<GradePredictor>` in prediction tab, passing `hourTotals`, `totalWeeks`, and derive `efficiency` via `computeBalanceStats(hourTotals).efficiency`.

**Relevant Context:**
- `predictGrade` is already exported from `gradePredictor.ts`.
- `efficiency` must be computed from `hourTotals` using `computeBalanceStats` — already done in `GradePredictor.tsx`, same pattern here.
- No new types needed — purely UI + local state.

**Status:** `[ ] pending`

---

## Sub-Task 3 — Grade history / progress log

**Intent:** Let users log grade snapshots (e.g. after mock exams) with a date and note. Show a mini history list per subject in the SubjectManager.

**Expected Outcomes:**
- `Subject` gains a `gradeHistory?: GradeSnapshot[]` field.
- `GradeSnapshot`: `{ date: string (ISO), grade: UKGrade, note?: string }`.
- In `SubjectManager`, each subject row has an expandable "History" section below it.
- In the expanded view: a list of past snapshots (date, grade badge, note) + a small inline form to add a new one (date picker defaulting to today, grade select, optional note).
- Snapshots are sorted newest first.
- Deleting a snapshot is supported (× button per row).
- No chart needed — plain list is sufficient.

**Todo List:**
1. `src/types/index.ts` — add `GradeSnapshot` interface and `gradeHistory?: GradeSnapshot[]` to `Subject`.
2. `src/components/SubjectManager.tsx` — add per-subject expand/collapse toggle for history section; render snapshot list and add-snapshot form.
3. Add handlers: `handleAddSnapshot(subjectId, snapshot)`, `handleDeleteSnapshot(subjectId, snapshotId)` — snapshots get a `id: crypto.randomUUID()`.
4. `src/components/SubjectManager.css` — style the history section (compact rows, grade badge).

**Relevant Context:**
- `SubjectManager` already has the `onSubjectsChange` callback — history updates flow through it.
- `GradeSnapshot` needs its own `id` for deletion keying.
- Keep the form minimal: `<input type="date">`, grade `<select>`, `<input type="text" placeholder="Note (optional)">`, Add button.

**Status:** `[ ] pending`

---

## Sub-Task 4 — Copy day (right-click day header)

**Intent:** Right-clicking a day header column copies all that day's slots. Right-clicking another day header pastes them, overwriting that day's slots.

**Expected Outcomes:**
- Right-clicking a day header label (Mon–Sun) shows a small context-style state: "Mon copied — right-click another day to paste. Esc to cancel."
- A second right-click on any day header pastes the copied slots into that day (full overwrite).
- The copied day indicator is shown as a subtle highlight on the source header.
- Escape cancels the copy state.
- No overlap with the existing cell right-click range-fill — header clicks are distinct from cell clicks.

**Todo List:**
1. In `TimetableGrid.tsx`, add `copiedDay: DayName | null` state.
2. Add `onContextMenu` handler on each day header cell — first right-click sets `copiedDay`; second right-click on a different header copies slots from source day onto target day (deep-copy the `DaySchedule` object) and clears `copiedDay`.
3. Add `tg-header-cell--copied` CSS class for visual indicator.
4. Escape key handler already exists for range-fill — extend it to also clear `copiedDay`.
5. `TimetableGrid.css` — add `.tg-header-cell--copied` style (dashed accent border or background tint).

**Relevant Context:**
- Day headers are currently `<div className="tg-header-cell">{day}</div>` with no interactivity.
- The Escape `useEffect` for clearing `rangeAnchor` is already in place — just add `setCopiedDay(null)` to it.
- Pasting replaces the target day's entire schedule: `updatedTimetable.days[targetDay] = { ...timetable.days[copiedDay] }`.

**Status:** `[ ] pending`

---

## Sub-Task 5 — Locked slots (middle-mouse)

**Intent:** Middle-mouse-clicking a slot toggles its locked state. Locked slots cannot be overwritten by left-click painting, range-fill, or the optimiser. They render with a small lock indicator.

**Expected Outcomes:**
- `Slot` gains an optional `locked?: boolean` field.
- Middle-clicking a slot toggles `slot.locked`. The slot's existing activity (if any) is preserved.
- Locked slots show a subtle lock overlay (small `🔒` icon or CSS pattern) on top of their colour.
- Left-click painting (`handleMouseDown` / `handleMouseEnter`) skips locked slots.
- Range-fill skips locked slots regardless of the overwrite flag.
- The optimiser (`optimiserUtils.collectReplaceable`) skips locked slots.
- Locked slots can be unlocked by middle-clicking again, or by using Clear All (which unlocks everything).

**Todo List:**
1. `src/types/index.ts` — add `locked?: boolean` to `Slot`.
2. `TimetableGrid.tsx`:
   a. Add `onAuxClick` handler (button 1 = middle mouse) on each cell that toggles `slot.locked` immutably.
   b. `paintSlot` — skip if `timetable.days[day][slotIndex]?.locked`.
   c. `rangeFill` — add locked check: skip slot if `daySchedule[si]?.locked`.
   d. Cell render — add `tg-cell--locked` CSS class when `slot.locked`.
3. `TimetableGrid.css` — `.tg-cell--locked` uses a subtle repeating diagonal stripe pattern (CSS `background: repeating-linear-gradient(...)`) on top of the activity colour.
4. `src/utils/optimiserUtils.ts` — in `collectReplaceable`, skip slots where `slot.locked === true`.

**Relevant Context:**
- `onAuxClick` fires for all aux buttons — check `e.button === 1` for middle mouse.
- Must call `e.preventDefault()` to suppress the browser's auto-scroll on middle-click.
- `paintSlot` currently just sets the slot unconditionally — add a guard at the top.
- `collectReplaceable` iterates `Object.values(daySchedule)` — filter out locked ones.

**Status:** `[ ] pending`

---

## Sub-Task 6 — Undo / redo

**Intent:** Ctrl+Z undoes the last timetable change; Ctrl+Y / Ctrl+Shift+Z redoes. Stack limited to 30 states. Undo/redo buttons also shown in the toolbar.

**Expected Outcomes:**
- The toolbar shows `↩ Undo` and `↪ Redo` buttons (greyed when unavailable).
- Ctrl+Z / Ctrl+Y work when the timetable tab is visible.
- Every paint action (drag, range-fill, optimise, clear-all, lock toggle) pushes onto the stack.
- Switching to a different named timetable clears the stack (the stack is per-timetable-session).
- Stack depth: 30 entries max (oldest dropped when exceeded).

**Todo List:**
1. `TimetableGrid.tsx` — add `undoStack: Timetable[]` and `redoStack: Timetable[]` as `useRef` arrays (not state — avoids re-renders).
2. Wrap `onTimetableChange` calls: before each change, push the current timetable onto `undoStack` and clear `redoStack`. Cap stack at 30.
3. `handleUndo`: pop from `undoStack`, push current to `redoStack`, call `onTimetableChange` with the popped state. Use `useRef` for "is undoing" to avoid re-pushing during undo.
4. `handleRedo`: pop from `redoStack`, push current to `undoStack`, call `onTimetableChange`.
5. Add `useEffect` for Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z keyboard shortcuts.
6. Clear stacks when `timetable` prop reference changes to a different timetable identity — detect via a `useEffect` on a "previous timetable id" ref.
7. Add `↩` / `↪` toolbar buttons with disabled state.
8. `TimetableGrid.css` — style the undo/redo buttons.

**Relevant Context:**
- Stacks as `useRef` not `useState` to avoid extra renders on every paint.
- The "is this a new timetable" detection: store `prevTimetableIdRef` as the `safeActiveTimetableId` passed from App — but `TimetableGrid` doesn't receive the ID. Simplest approach: pass an `timetableId` prop for stack-clearing purposes.
- All calls to `onTimetableChange` inside the component are: drag-paint, range-fill, clear-all, optimise, lock-toggle — all must go through a wrapper that pushes to undo stack.

**Status:** `[ ] pending`

---

## Sub-Task 7 — Dark mode

**Intent:** A moon/sun toggle in the app header switches between light and dark themes using a `data-theme` attribute on `<html>`. The toggle preference is persisted.

**Expected Outcomes:**
- A 🌙/☀️ button in the header next to the cog.
- All components switch cleanly — no hardcoded colours remain (all already use CSS variables in most places; a few `#fff` / `#ddd` literals in component CSS files need fixing).
- Preference saved to `localStorage` key `'theme'` and applied on load (no flash).
- The dark theme redefines `--bg`, `--surface`, `--border`, `--text`, `--text-muted` and the fixed activity colours remain vibrant.

**Todo List:**
1. `src/index.css` — add `[data-theme="dark"]` block redefining the CSS variables: `--bg: #0d1117`, `--surface: #161b22`, `--border: #30363d`, `--text: #e6edf3`, `--text-muted: #8b949e`. Keep accent and activity colours the same.
2. Apply `data-theme` on `document.documentElement` on initial load (read `localStorage.getItem('theme')`) — do this in a `<script>` in `index.html` before React mounts to prevent flash.
3. `src/App.tsx` — add `[theme, setTheme]` using `useLocalStorage<'light'|'dark'>('theme', 'light')`. On mount and on change, set `document.documentElement.dataset.theme = theme`. Add a toggle button in the header.
4. Audit component CSS files for hardcoded `#fff`, `#ddd`, `#f0f0f0`, `#e5e7eb` etc. — replace with CSS variables where they appear in grid cells, headers, and backgrounds.

**Relevant Context:**
- Component CSS files that have hardcoded colours: `TimetableGrid.css` (cell borders `#f0f0f0`, header `#fff`, time label `#fff`), `GradePredictor.css`, `TimetableManager.css`.
- `index.html` already exists in the project root — add a small inline script to set `data-theme` before body.
- The toggle in the header sits next to the existing `⚙` cog button.

**Status:** `[ ] pending`

---

## Sub-Task 8 — Full data export / import

**Intent:** A single "Export all" button downloads the complete app state as one JSON file. An "Import" button restores it, replacing all current data after confirmation.

**Expected Outcomes:**
- Two buttons in the app header (or a dropdown): "⬇ Export" and "⬆ Import".
- Export downloads `timetable_app_export_YYYY-MM-DD.json` containing: `{ version: 1, settings, timetables, subjects, weekPlan, fixedColours }`.
- Import shows a file picker, validates the JSON structure, then asks "This will replace all your current data. Continue?" before applying.
- On successful import all state is replaced and persisted immediately.
- Invalid files show a clear error message.

**Todo List:**
1. `src/App.tsx` — add `handleExportAll()`: build the export object from current state, JSON-stringify, download as blob.
2. Add `handleImportAll(file)`: read file, parse JSON, validate top-level keys, confirm, then call each setter (`setSettings`, `setTimetables`, `setSubjects`, `setWeekPlan`, `setFixedColours`) with the imported values.
3. Add a hidden `<input type="file">` ref for the import picker.
4. Add "⬇" and "⬆" icon buttons to the app header alongside the cog and dark mode toggle.
5. `src/App.css` — style the new header buttons consistently with the existing `cog-btn`.

**Relevant Context:**
- All state setters (`setSettings`, `setTimetables`, `setSubjects`, `setWeekPlan`, `setFixedColours`) are already in `App.tsx` — no new props needed.
- Export version field (`version: 1`) allows future migration logic.
- Validation: check `typeof parsed.timetables === 'object'` and `Array.isArray(parsed.subjects)` and `Array.isArray(parsed.weekPlan)`.

**Status:** `[ ] pending`

---

## Dependency Order

Sub-tasks are independent except:
- Sub-Task 5 (locked slots) must come before Sub-Task 6 (undo) since Sub-Task 6 wraps all `onTimetableChange` calls including the lock-toggle.
- Sub-Task 1 (difficulty) must come before Sub-Task 2 (what-if) since what-if calls `predictGrade` which will have the new signature.
- All others can be done in any order.

Recommended implementation order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**
