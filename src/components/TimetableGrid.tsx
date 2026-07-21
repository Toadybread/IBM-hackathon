import React, { useState, useRef, useEffect, useCallback } from 'react'
import './TimetableGrid.css'
import type { Timetable, DayName } from '../types'
import { DAY_NAMES, createEmptyTimetable } from '../types'

// ── Props ──────────────────────────────────────────────────────────────────────

export interface TimetableGridProps {
  schoolTimetable: Timetable
  holidayTimetable: Timetable
  onSchoolTimetableChange: (t: Timetable) => void
  onHolidayTimetableChange: (t: Timetable) => void
  startHour: number
  endHour: number
  selectedActivity: string | null // null = eraser
  activityColours: Record<string, string>
  legendItems: { id: string; label: string; colour: string }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Pad a number to two digits. */
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format a time label for a slot index (null if not on the hour). */
function slotTimeLabel(slotIndex: number, startHour: number): string | null {
  if (slotIndex % 4 === 0) {
    const hour = startHour + slotIndex / 4
    return `${pad(hour)}:00`
  }
  return null
}

/** Paint a single slot into a timetable immutably. */
function paintSlot(
  timetable: Timetable,
  day: DayName,
  slotIndex: number,
  activity: string | null,
): Timetable {
  const daySchedule = { ...timetable.days[day] }
  if (activity === null) {
    delete daySchedule[slotIndex]
  } else {
    daySchedule[slotIndex] = { activity: activity as import('../types').ActivityType }
  }
  return {
    ...timetable,
    days: { ...timetable.days, [day]: daySchedule },
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TimetableGrid({
  schoolTimetable,
  holidayTimetable,
  onSchoolTimetableChange,
  onHolidayTimetableChange,
  startHour,
  endHour,
  selectedActivity,
  activityColours,
  legendItems,
}: TimetableGridProps) {
  const [mode, setMode] = useState<'school' | 'holiday'>('school')

  // Current timetable + setter derived from mode
  const timetable = mode === 'school' ? schoolTimetable : holidayTimetable
  const setTimetable = mode === 'school' ? onSchoolTimetableChange : onHolidayTimetableChange

  // Drag-paint refs — avoids stale closures in event handlers
  const isPainting = useRef(false)
  const paintActivity = useRef<string | null>(null)

  // Latest timetable ref so the mouseenter callback always sees current state
  const timetableRef = useRef(timetable)
  const setTimetableRef = useRef(setTimetable)
  useEffect(() => { timetableRef.current = timetable }, [timetable])
  useEffect(() => { setTimetableRef.current = setTimetable }, [setTimetable])

  // Total number of 15-min slots in the grid
  const slotCount = (endHour - startHour) * 4

  // ── Stop painting on document mouseup ────────────────────────────────────────

  const stopPainting = useCallback(() => {
    isPainting.current = false
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', stopPainting)
    return () => document.removeEventListener('mouseup', stopPainting)
  }, [stopPainting])

  // ── Cell interaction ──────────────────────────────────────────────────────────

  function handleMouseDown(day: DayName, slotIndex: number) {
    isPainting.current = true
    paintActivity.current = selectedActivity
    const next = paintSlot(timetableRef.current, day, slotIndex, paintActivity.current)
    timetableRef.current = next
    setTimetableRef.current(next)
  }

  function handleMouseEnter(day: DayName, slotIndex: number) {
    if (!isPainting.current) return
    const next = paintSlot(timetableRef.current, day, slotIndex, paintActivity.current)
    timetableRef.current = next
    setTimetableRef.current(next)
  }

  // ── Clear all ─────────────────────────────────────────────────────────────────

  function handleClearAll() {
    setTimetable(createEmptyTimetable())
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Controls */}
      <div className="tg-controls">
        <button
          className={`tg-mode-btn${mode === 'school' ? ' tg-mode-btn--active' : ''}`}
          onClick={() => setMode('school')}
        >
          School Week
        </button>
        <button
          className={`tg-mode-btn${mode === 'holiday' ? ' tg-mode-btn--active' : ''}`}
          onClick={() => setMode('holiday')}
        >
          Holiday Week
        </button>
        <button className="tg-clear-btn" onClick={handleClearAll}>
          Clear All
        </button>
      </div>

      {/* Scrollable grid */}
      <div className="tg-scroll">
        <div className="timetable-grid">

          {/* Header row */}
          <div className="tg-header-cell" /> {/* corner spacer */}
          {DAY_NAMES.map(day => (
            <div key={day} className="tg-header-cell">{day}</div>
          ))}

          {/* Slot rows */}
          {Array.from({ length: slotCount }, (_, slotIndex) => {
            const label = slotTimeLabel(slotIndex, startHour)
            const isHourStart = slotIndex % 4 === 0

            return (
              <React.Fragment key={slotIndex}>
                {/* Time label */}
                <div className="tg-time-label">
                  {label ?? ''}
                </div>

                {/* Day cells */}
                {DAY_NAMES.map(day => {
                  const slot = timetable.days[day]?.[slotIndex]
                  const colour = slot?.activity ? (activityColours[slot.activity] ?? '#ccc') : undefined

                  return (
                    <div
                      key={`${day}-${slotIndex}`}
                      className={`tg-cell${isHourStart ? ' tg-cell--hour-start' : ''}`}
                      style={colour ? { backgroundColor: colour } : undefined}
                      onMouseDown={() => handleMouseDown(day, slotIndex)}
                      onMouseEnter={() => handleMouseEnter(day, slotIndex)}
                    />
                  )
                })}
              </React.Fragment>
            )
          })}

        </div>

        {/* Colour legend */}
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
    </div>
  )
}
