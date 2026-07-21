import React, { useState, useEffect, useCallback } from 'react'
import type { WeekPeriod, NamedTimetable, DayName } from '../types'
import { DAY_NAMES } from '../types'
import './TimelineViewer.css'

interface WeekSlide {
  weekNumber: number
  timetableId: string
  timetableName: string
}

interface TimelineViewerProps {
  weekPlan: WeekPeriod[]
  timetables: Record<string, NamedTimetable>
  startHour: number
  endHour: number
  activityColours: Record<string, string>
  legendItems: { id: string; label: string; colour: string }[]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export default function TimelineViewer({
  weekPlan,
  timetables,
  startHour,
  endHour,
  activityColours,
  legendItems,
}: TimelineViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Build flat week sequence from week plan
  const weekSequence: WeekSlide[] = []
  let globalIndex = 0
  for (const period of weekPlan) {
    const name = timetables[period.timetableId]?.name ?? '(unknown)'
    for (let i = 0; i < period.weeks; i++) {
      weekSequence.push({
        weekNumber: globalIndex + 1,
        timetableId: period.timetableId,
        timetableName: name,
      })
      globalIndex++
    }
  }

  const totalSlides = weekSequence.length

  // Clamp current index if week plan shrinks
  const safeIndex = Math.min(currentIndex, Math.max(0, totalSlides - 1))

  const prev = useCallback(() => setCurrentIndex(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setCurrentIndex(i => Math.min(totalSlides - 1, i + 1)), [totalSlides])

  // Keyboard navigation when focused
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'ArrowRight') next()
  }, [prev, next])

  // Reset to 0 when week plan changes completely
  useEffect(() => {
    if (safeIndex !== currentIndex) setCurrentIndex(safeIndex)
  }, [safeIndex, currentIndex])

  if (totalSlides === 0) {
    return (
      <section className="tlv">
        <h2 className="tlv__title">Timeline</h2>
        <p className="tlv__empty">Add periods to the study plan above to see your timeline.</p>
      </section>
    )
  }

  const slide = weekSequence[safeIndex]
  const namedTimetable = timetables[slide.timetableId]
  const timetable = namedTimetable?.timetable
  const slotCount = (endHour - startHour) * 4

  return (
    <section className="tlv" onKeyDown={handleKeyDown} tabIndex={0} aria-label="Timeline viewer">
      <div className="tlv__header">
        <h2 className="tlv__title">Timeline</h2>
        <div className="tlv__nav">
          <button
            className="tlv__nav-btn"
            onClick={prev}
            disabled={safeIndex === 0}
            aria-label="Previous week"
          >
            ◀
          </button>
          <span className="tlv__week-label">
            Week {slide.weekNumber} of {totalSlides}
            <span className="tlv__timetable-name"> — {slide.timetableName}</span>
          </span>
          <button
            className="tlv__nav-btn"
            onClick={next}
            disabled={safeIndex === totalSlides - 1}
            aria-label="Next week"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Read-only timetable grid */}
      {timetable ? (
        <div className="tlv__grid-wrapper">
          <div className="tlv__grid">
            {/* Header row */}
            <div className="tlv__time-cell tlv__header-cell" />
            {DAY_NAMES.map(day => (
              <div key={day} className="tlv__header-cell">{day}</div>
            ))}

            {/* Slot rows */}
            {Array.from({ length: slotCount }, (_, slotIndex) => {
              const isHourStart = slotIndex % 4 === 0
              const label = isHourStart
                ? `${pad(startHour + slotIndex / 4)}:00`
                : ''

              return (
                <React.Fragment key={slotIndex}>
                  <div className="tlv__time-cell">{label}</div>
                  {DAY_NAMES.map((day: DayName) => {
                    const slot = timetable.days[day]?.[slotIndex]
                    const colour = slot?.activity
                      ? (activityColours[slot.activity] ?? '#ccc')
                      : undefined
                    return (
                      <div
                        key={`${day}-${slotIndex}`}
                        className={`tlv__cell${isHourStart ? ' tlv__cell--hour-start' : ''}`}
                        style={colour ? { backgroundColor: colour } : undefined}
                      />
                    )
                  })}
                </React.Fragment>
              )
            })}
          </div>

          {/* Legend */}
          {legendItems.length > 0 && (
            <div className="tlv__legend">
              {legendItems.map(item => (
                <div key={item.id} className="tlv__legend-item">
                  <div className="tlv__legend-dot" style={{ backgroundColor: item.colour }} />
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="tlv__empty">Timetable data not found.</p>
      )}
    </section>
  )
}
