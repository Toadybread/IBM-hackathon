import React, { useState, useRef, useEffect, useCallback } from 'react'
import './TimetableGrid.css'
import type { Timetable, DayName, Subject, NamedTimetable, WeekPeriod } from '../types'
import { DAY_NAMES, createEmptyTimetable } from '../types'
import type { HourTotals } from '../utils/timetableUtils'
import OptimiserModal from './OptimiserModal'

// ── Props ──────────────────────────────────────────────────────────────────────

export interface TimetableGridProps {
  timetable: Timetable
  onTimetableChange: (t: Timetable) => void
  /** Stable ID of the active timetable — used to clear undo stack on switch */
  timetableId: string
  timetableName: string
  startHour: number
  endHour: number
  selectedActivity: string | null // null = eraser
  activityColours: Record<string, string>
  legendItems: { id: string; label: string; colour: string }[]
  subjects: Subject[]
  totalWeeks: number
  hourTotals: HourTotals
  /** Full timetable map — forwarded to OptimiserModal for "apply all" feature */
  timetables: Record<string, NamedTimetable>
  onTimetablesChange: (updated: Record<string, NamedTimetable>) => void
  weekPlan: WeekPeriod[]
}

const UNDO_LIMIT = 30

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function slotTimeLabel(slotIndex: number, startHour: number): string | null {
  if (slotIndex % 4 === 0) {
    const hour = startHour + slotIndex / 4
    return `${pad(hour)}:00`
  }
  return null
}

/** Paint a single slot immutably, skipping locked slots. */
function paintSlot(
  timetable: Timetable,
  day: DayName,
  slotIndex: number,
  activity: string | null,
): Timetable {
  const existing = timetable.days[day]?.[slotIndex]
  if (existing?.locked) return timetable // locked — skip
  const daySchedule = { ...timetable.days[day] }
  if (activity === null) {
    delete daySchedule[slotIndex]
  } else {
    daySchedule[slotIndex] = { activity: activity as import('../types').ActivityType }
  }
  return { ...timetable, days: { ...timetable.days, [day]: daySchedule } }
}

/** Toggle the locked state of a slot immutably. */
function toggleLock(timetable: Timetable, day: DayName, slotIndex: number): Timetable {
  const daySchedule = { ...timetable.days[day] }
  const existing = daySchedule[slotIndex]
  if (existing) {
    daySchedule[slotIndex] = { ...existing, locked: !existing.locked }
  } else {
    // Lock an empty slot (it will resist painting)
    daySchedule[slotIndex] = { activity: null as unknown as import('../types').ActivityType, locked: true }
  }
  return { ...timetable, days: { ...timetable.days, [day]: daySchedule } }
}

/** Range-fill rectangular region, skipping locked slots. */
function rangeFill(
  timetable: Timetable,
  dayA: DayName,
  slotA: number,
  dayB: DayName,
  slotB: number,
  activity: string | null,
  overwrite: boolean,
): Timetable {
  const dayStart = Math.min(DAY_NAMES.indexOf(dayA), DAY_NAMES.indexOf(dayB))
  const dayEnd   = Math.max(DAY_NAMES.indexOf(dayA), DAY_NAMES.indexOf(dayB))
  const slotMin  = Math.min(slotA, slotB)
  const slotMax  = Math.max(slotA, slotB)

  let result = timetable
  for (let di = dayStart; di <= dayEnd; di++) {
    const day = DAY_NAMES[di]
    const daySchedule = { ...result.days[day] }
    for (let si = slotMin; si <= slotMax; si++) {
      if (daySchedule[si]?.locked) continue // never overwrite locked
      const existing = daySchedule[si]?.activity ?? null
      if (!overwrite && existing !== null) continue
      if (activity === null) {
        delete daySchedule[si]
      } else {
        daySchedule[si] = { activity: activity as import('../types').ActivityType }
      }
    }
    result = { ...result, days: { ...result.days, [day]: daySchedule } }
  }
  return result
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TimetableGrid({
  timetable,
  onTimetableChange,
  timetableId,
  timetableName,
  startHour,
  endHour,
  selectedActivity,
  activityColours,
  legendItems,
  subjects,
  totalWeeks,
  hourTotals,
  timetables,
  onTimetablesChange,
  weekPlan,
}: TimetableGridProps) {
  const [showOptimiserModal, setShowOptimiserModal] = useState(false)

  // ── Range-fill state ──────────────────────────────────────────────────────────
  const [rangeAnchor, setRangeAnchor] = useState<{ day: DayName; slot: number } | null>(null)

  // ── Copy-day state ────────────────────────────────────────────────────────────
  const [copiedDay, setCopiedDay] = useState<DayName | null>(null)

  // ── Undo / redo stacks (refs to avoid extra renders) ─────────────────────────
  const undoStack = useRef<Timetable[]>([])
  const redoStack = useRef<Timetable[]>([])
  const prevTimetableId = useRef(timetableId)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Clear undo/redo when switching to a different timetable
  useEffect(() => {
    if (prevTimetableId.current !== timetableId) {
      undoStack.current = []
      redoStack.current = []
      setCanUndo(false)
      setCanRedo(false)
      prevTimetableId.current = timetableId
    }
  }, [timetableId])

  /** Wrapper: push current state onto undo stack then call onTimetableChange */
  const commitChange = useCallback((current: Timetable, next: Timetable) => {
    undoStack.current = [...undoStack.current.slice(-UNDO_LIMIT + 1), current]
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
    onTimetableChange(next)
  }, [onTimetableChange])

  // Drag-paint refs
  const isPainting = useRef(false)
  const paintActivity = useRef<string | null>(null)
  const timetableRef = useRef(timetable)
  const setTimetableRef = useRef(onTimetableChange)
  useEffect(() => { timetableRef.current = timetable }, [timetable])
  useEffect(() => { setTimetableRef.current = onTimetableChange }, [onTimetableChange])

  const slotCount = (endHour - startHour) * 4

  // ── Stop painting on document mouseup ────────────────────────────────────────

  const stopPainting = useCallback(() => { isPainting.current = false }, [])
  useEffect(() => {
    document.addEventListener('mouseup', stopPainting)
    return () => document.removeEventListener('mouseup', stopPainting)
  }, [stopPainting])

  // ── Cell interaction ──────────────────────────────────────────────────────────

  function handleMouseDown(e: React.MouseEvent, day: DayName, slotIndex: number) {
    if (e.button === 1) {
      handleMiddleDown(e, day, slotIndex)
      return
    }
    if (e.button !== 0) return
    isPainting.current = true
    paintActivity.current = selectedActivity
    const before = timetableRef.current
    const next = paintSlot(before, day, slotIndex, paintActivity.current)
    if (next !== before) {
      undoStack.current = [...undoStack.current.slice(-UNDO_LIMIT + 1), before]
      redoStack.current = []
      setCanUndo(true)
      setCanRedo(false)
    }
    timetableRef.current = next
    setTimetableRef.current(next)
  }

  function handleMouseEnter(day: DayName, slotIndex: number) {
    if (!isPainting.current) return
    const before = timetableRef.current
    const next = paintSlot(before, day, slotIndex, paintActivity.current)
    timetableRef.current = next
    setTimetableRef.current(next)
  }

  // ── Middle-mouse lock toggle ──────────────────────────────────────────────────
  // Must intercept onMouseDown (not onAuxClick) to prevent the browser's
  // auto-scroll behaviour which fires before the click event completes.

  function handleMiddleDown(e: React.MouseEvent, day: DayName, slotIndex: number) {
    if (e.button !== 1) return
    e.preventDefault()
    e.stopPropagation()
    commitChange(timetable, toggleLock(timetable, day, slotIndex))
  }

  // ── Right-click: range-fill on cells, copy-day on headers ────────────────────

  function handleContextMenu(e: React.MouseEvent, day: DayName, slotIndex: number) {
    e.preventDefault()
    if (rangeAnchor === null) {
      setRangeAnchor({ day, slot: slotIndex })
    } else {
      const next = rangeFill(timetable, rangeAnchor.day, rangeAnchor.slot, day, slotIndex, selectedActivity, e.shiftKey)
      commitChange(timetable, next)
      setRangeAnchor(null)
    }
  }

  function handleHeaderContextMenu(e: React.MouseEvent, day: DayName) {
    e.preventDefault()
    if (copiedDay === null) {
      setCopiedDay(day)
    } else {
      // Paste: overwrite target day with copied day's schedule
      // copiedDay stays set so user can paste to multiple days — Escape to clear
      const next: Timetable = {
        ...timetable,
        days: { ...timetable.days, [day]: { ...timetable.days[copiedDay] } },
      }
      commitChange(timetable, next)
      // intentionally NOT clearing copiedDay — paste again with Escape to cancel
    }
  }

  // ── Undo / redo ───────────────────────────────────────────────────────────────

  function handleUndo() {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current[undoStack.current.length - 1]
    undoStack.current = undoStack.current.slice(0, -1)
    redoStack.current = [...redoStack.current, timetable]
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
    onTimetableChange(prev)
  }

  function handleRedo() {
    if (redoStack.current.length === 0) return
    const next = redoStack.current[redoStack.current.length - 1]
    redoStack.current = redoStack.current.slice(0, -1)
    undoStack.current = [...undoStack.current, timetable]
    setCanRedo(redoStack.current.length > 0)
    setCanUndo(true)
    onTimetableChange(next)
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setRangeAnchor(null)
        setCopiedDay(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable, canUndo, canRedo])

  // ── Clear all ─────────────────────────────────────────────────────────────────

  function handleClearAll() {
    commitChange(timetable, createEmptyTimetable())
  }

  // ── Optimise ──────────────────────────────────────────────────────────────────

  function handleOptimise() {
    setShowOptimiserModal(true)
  }

  function handleOptimiserApply(optimised: Timetable) {
    commitChange(timetable, optimised)
  }

  function handleOptimiserApplyAll(updated: Record<string, NamedTimetable>) {
    undoStack.current = [...undoStack.current.slice(-UNDO_LIMIT + 1), timetable]
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
    onTimetablesChange(updated)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Controls */}
      <div className="tg-controls">
        <button className="tg-undo-btn" onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
        <button className="tg-undo-btn" onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪ Redo</button>
        <button className="tg-clear-btn" onClick={handleClearAll}>Clear All</button>

        <div className="tg-optimise-group">
          <button className="tg-optimise-btn" onClick={handleOptimise}>✨ Optimise…</button>
        </div>
      </div>

      {/* Status hints */}
      {(rangeAnchor || copiedDay) && (
        <div className="tg-hint">
          {rangeAnchor && `Range anchor set on ${rangeAnchor.day} — right-click a second cell to fill. Shift+right-click to overwrite. Esc to cancel.`}
          {copiedDay && `${copiedDay} copied — right-click another day header to paste. Esc to cancel.`}
        </div>
      )}

      {/* Scrollable grid */}
      <div className="tg-scroll">
        <div className="timetable-grid">

          {/* Header row */}
          <div className="tg-header-cell" />
          {DAY_NAMES.map(day => (
            <div
              key={day}
              className={`tg-header-cell${copiedDay === day ? ' tg-header-cell--copied' : ''}`}
              onContextMenu={e => handleHeaderContextMenu(e, day)}
              title="Right-click to copy this day"
            >
              {day}
            </div>
          ))}

          {/* Slot rows */}
          {Array.from({ length: slotCount }, (_, slotIndex) => {
            const label = slotTimeLabel(slotIndex, startHour)
            const isHourStart = slotIndex % 4 === 0

            return (
              <React.Fragment key={slotIndex}>
                <div className="tg-time-label">{label ?? ''}</div>

                {DAY_NAMES.map(day => {
                  const slot = timetable.days[day]?.[slotIndex]
                  const colour = slot?.activity ? (activityColours[slot.activity] ?? '#ccc') : undefined
                  const isAnchor = rangeAnchor !== null && rangeAnchor.day === day && rangeAnchor.slot === slotIndex
                  const isLocked = slot?.locked === true

                  return (
                    <div
                      key={`${day}-${slotIndex}`}
                      className={[
                        'tg-cell',
                        isHourStart ? 'tg-cell--hour-start' : '',
                        isAnchor ? 'tg-cell--anchor' : '',
                        isLocked ? 'tg-cell--locked' : '',
                      ].filter(Boolean).join(' ')}
                      style={colour ? { backgroundColor: colour } : undefined}
                      onMouseDown={e => handleMouseDown(e, day, slotIndex)}
                      onMouseEnter={() => handleMouseEnter(day, slotIndex)}
                      onContextMenu={e => handleContextMenu(e, day, slotIndex)}
                    />
                  )
                })}
              </React.Fragment>
            )
          })}

        </div>

        {legendItems.length > 0 && (
          <div className="tg-legend">
            {legendItems.map(item => (
              <div key={item.id} className="tg-legend-item">
                <div className="tg-legend-dot" style={{ backgroundColor: item.colour }} />
                {item.label}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Optimiser modal */}
      {showOptimiserModal && (
        <OptimiserModal
          timetable={timetable}
          timetableName={timetableName}
          subjects={subjects}
          totalWeeks={totalWeeks}
          hourTotals={hourTotals}
          timetables={timetables}
          weekPlan={weekPlan}
          onApply={handleOptimiserApply}
          onApplyAll={handleOptimiserApplyAll}
          onClose={() => setShowOptimiserModal(false)}
        />
      )}
    </div>
  )
}
