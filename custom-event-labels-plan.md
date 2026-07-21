# Custom Event Labels — Plan

## Overview

Allow users to double-click any timetable slot to enter a custom text label (e.g. "Tennis lesson"). The label block can then be stretched across multiple 15-min slots by dragging a resize handle at its bottom edge, exactly like a calendar event. All spanned slots share the same activity colour and display the label text.

---

## Architecture Decision

The grid today is a flat CSS Grid — every slot is an independent `<div>` rendered row-by-row. To support a visually spanning label block we keep the underlying grid cells (they still handle painting, drag, lock etc.) but add a **separate positioned overlay layer** that renders `EventBlock` components absolutely on top of the grid. This avoids reworking the entire grid layout.

---

## Sub-Task 1 — Extend the data model

**Intent:** Add `label` and `spanStart` fields to `Slot` so labelled events can be stored and identified without a separate data structure.

**Expected Outcomes:**
- `Slot` has optional `label?: string` field
- `Slot` has optional `spanStart?: true` field — set only on the first slot of a labelled span; continuation slots have the same `activity` and `label` but `spanStart` is absent/false
- `isSpanStart(slot)` type-guard helper exported from `types/index.ts`
- Existing code compiles unchanged (both fields are optional)

**Todo List:**
1. In `src/types/index.ts`, add `label?: string` and `spanStart?: true` to the `Slot` interface
2. Export a helper `isSpanStart(slot: Slot): boolean`

**Relevant Context:**
- `src/types/index.ts` — `Slot` interface, lines 34–38
- Both fields must be optional so existing saved data loads without migration

**Status:** [ ] pending

---

## Sub-Task 2 — Inline label editor (double-click to enter/edit text)

**Intent:** Double-clicking a slot opens an inline `<input>` directly in that cell. Pressing Enter or blurring confirms the label and writes it to the slot. Escape cancels. If the slot has no activity, the label is stored with `activity: null` and a default grey colour. If it already has an activity, the label is added to the existing slot.

**Expected Outcomes:**
- Double-clicking a slot shows a text input in place of the cell content
- Typing and pressing Enter commits `label` + sets `spanStart: true` on that slot
- Pressing Escape cancels with no change
- Blurring the input also commits (same as Enter)
- Single-click/drag paint is **not** suppressed — only a genuine double-click triggers the editor
- Existing locked slots cannot be labelled

**Todo List:**
1. Add state `labelEditor: { day: DayName; slot: number } | null` to `TimetableGrid`
2. Add `onDoubleClick` handler on each `.tg-cell` — sets `labelEditor` and prevents paint from firing (use `e.detail === 2` in `handleMouseDown` to skip painting on the second click of a double-click)
3. Render a controlled `<input>` inside the cell when `labelEditor` matches that cell's coordinates
4. On Enter/blur: call `commitChange` writing `{ ...existingSlot, label: text, spanStart: true }` — if text is empty, clear the label instead
5. On Escape: clear `labelEditor` state without committing

**Relevant Context:**
- `TimetableGrid.tsx` — `handleMouseDown`, cell render loop (lines 370–391)
- `paintSlot` helper — the existing slot object must be spread, not replaced, so `locked` is preserved
- `e.detail` on a MouseEvent equals the click count; `detail === 2` means double-click

**Status:** [ ] pending

---

## Sub-Task 3 — Overlay layer: render labelled event blocks

**Intent:** Add a `position: relative` wrapper around the CSS grid and an absolute overlay `<div>` on top. For each labelled span, render a single `EventBlock` positioned to cover all its slots. The block shows the label text, uses the slot's activity colour (or a default grey), and has a drag handle at the bottom.

**Expected Outcomes:**
- A labelled single slot shows a coloured pill/card overlaid on the cell, showing the label text
- A labelled span (multiple slots) shows one tall block covering all slots
- The overlay does not interfere with mouse events on the underlying cells (uses `pointer-events: none` on the overlay container; the `EventBlock` itself re-enables `pointer-events`)
- The block renders in the correct column (day) and row range (slot indices)
- Continuation slots have their borders hidden so they look merged

**Todo List:**
1. Refactor the grid wrapper: wrap `.timetable-grid` and the overlay in a `position: relative` container
2. Measure grid geometry: expose the cell height (20 px, already fixed) and column positions via a `ref` on the grid, or compute from known constants (`CELL_HEIGHT = 20`, column index from `DAY_NAMES.indexOf(day)`)
3. Scan the timetable to collect all `spanStart` slots and their span length (count consecutive slots with the same `label` in the same day)
4. Render one `EventBlock` per span — positioned using `top = (slotIndex - 0) * CELL_HEIGHT + headerHeight` and `left/width` computed from column index
5. `EventBlock` shows: coloured background, label text (truncated), a small ✕ button to clear the label, and a resize handle strip at the bottom
6. Add `EventBlock.tsx` and `EventBlock.css` as new files

**Relevant Context:**
- `TimetableGrid.css` — `.tg-cell { height: 20px }`, `.tg-header-cell` (sticky, needs offset)
- `.timetable-grid` uses `grid-template-columns: 52px repeat(7, 1fr)` — column widths are proportional, not fixed pixels; use `getBoundingClientRect` or CSS `grid` column measurement for accurate positioning, OR use `grid-column` / `grid-row` on the overlay element directly (avoids pixel maths entirely)
- Best approach: render `EventBlock` **inside** the CSS grid as `grid-column: dayIndex+2 / span 1` and `grid-row: slotIndex+2 / span N` with `position: relative; z-index: 3` — no pixel maths needed

**Status:** [ ] pending

---

## Sub-Task 4 — Drag-to-resize span

**Intent:** A small drag handle at the bottom of each `EventBlock` lets the user drag downward to extend the span (add more slots) or upward to shrink it. Dragging updates the timetable in real time and commits on mouseup.

**Expected Outcomes:**
- Hovering the bottom 4 px of an `EventBlock` shows a `resize` cursor
- Dragging downward adds continuation slots (same `activity` + `label`, no `spanStart`)
- Dragging upward removes slots from the end of the span (minimum 1 slot)
- The resize commits to undo history on mouseup
- Dragging does not trigger normal slot painting

**Todo List:**
1. In `EventBlock`, attach `onMouseDown` to the resize handle strip; set a `isResizing` ref and store the initial slot/day
2. On `mousemove` (document-level while resizing): compute new span end from mouse Y position relative to grid top + `CELL_HEIGHT`; update a `resizePreview` state in `TimetableGrid` to show the stretch live
3. On `mouseup`: commit the final span — write all slots from `startSlot` to new `endSlot` with `{ activity, label }` and clear any slots beyond the new end that were previously part of the span
4. Guard: the resize handle's `onMouseDown` must call `e.stopPropagation()` so it doesn't trigger the cell's paint handler

**Relevant Context:**
- `TimetableGrid.tsx` — `stopPainting` / `isPainting` refs pattern; same pattern for `isResizing`
- The grid container needs a stable `ref` so mouse Y can be converted to slot index: `slotIndex = Math.floor((mouseY - gridTop - headerHeight) / CELL_HEIGHT)`

**Status:** [ ] pending

---

## Sub-Task 5 — Wire up label clearing and undo

**Intent:** The ✕ button on an `EventBlock` clears the label from all slots in the span (sets `label: undefined`, `spanStart: undefined`) without removing the activity. Clearing goes through `commitChange` so it is undoable. Painting over a labelled slot with a different activity also clears the label.

**Expected Outcomes:**
- Clicking ✕ on an event block removes the label from all spanned slots and the block disappears; undo restores it
- Drag-painting a new activity over a labelled slot overwrites it cleanly (no orphaned label)
- `Clear All` wipes labels as it creates an empty timetable

**Todo List:**
1. `EventBlock` receives an `onClear` prop; TimetableGrid's handler writes all spanned slots back without `label`/`spanStart`
2. In `paintSlot`, when writing a new activity to a slot, always omit `label` and `spanStart` from the new slot object
3. No change needed for `Clear All` — it already calls `createEmptyTimetable()` which starts fresh

**Relevant Context:**
- `paintSlot` in `TimetableGrid.tsx` lines 47–62 — needs a one-line change to not carry `label` forward
- `commitChange` is already in scope for the clear handler

**Status:** [ ] pending

---

## Files Touched

| File | Change |
|---|---|
| `src/types/index.ts` | Add `label?`, `spanStart?` to `Slot` |
| `src/components/TimetableGrid.tsx` | Double-click handler, overlay render, resize logic |
| `src/components/TimetableGrid.css` | Overlay container, cell label styles |
| `src/components/EventBlock.tsx` | NEW — labelled event block component |
| `src/components/EventBlock.css` | NEW — event block styles |
