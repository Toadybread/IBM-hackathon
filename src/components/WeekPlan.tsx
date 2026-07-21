import { useMemo, useEffect } from 'react'
import type { WeekPeriod, NamedTimetable } from '../types'
import { computeTotals } from '../utils/timetableUtils'
import type { HourTotals } from '../utils/timetableUtils'
import './WeekPlan.css'

export type { HourTotals }

interface WeekPlanProps {
  weekPlan: WeekPeriod[]
  onWeekPlanChange: (plan: WeekPeriod[]) => void
  onTotalsChange: (totals: HourTotals, totalWeeks: number) => void
  timetables: Record<string, NamedTimetable>
}

export default function WeekPlan({
  weekPlan,
  onWeekPlanChange,
  onTotalsChange,
  timetables,
}: WeekPlanProps) {
  // ── Derived totals ──────────────────────────────────────────────────────────
  const { totals, totalWeeks } = useMemo(
    () => computeTotals(weekPlan, timetables),
    [weekPlan, timetables],
  )

  // ── Propagate totals upward whenever they change ────────────────────────────
  useEffect(() => {
    onTotalsChange(totals, totalWeeks)
  }, [totals, totalWeeks, onTotalsChange])

  // ── Study hours summary ─────────────────────────────────────────────────────
  const studyHours = Object.entries(totals)
    .filter(([key]) => key.startsWith('study-'))
    .reduce((sum, [, h]) => sum + h, 0)

  const timetableList = Object.values(timetables)

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleTimetableChange(id: string, timetableId: string) {
    onWeekPlanChange(weekPlan.map(p => (p.id === id ? { ...p, timetableId } : p)))
  }

  function handleWeeksChange(id: string, weeks: number) {
    const clamped = Math.max(1, Math.min(52, weeks))
    onWeekPlanChange(weekPlan.map(p => (p.id === id ? { ...p, weeks: clamped } : p)))
  }

  function handleDelete(id: string) {
    onWeekPlanChange(weekPlan.filter(p => p.id !== id))
  }

  function handleAddPeriod() {
    const firstId = timetableList[0]?.id ?? 'school'
    const newPeriod: WeekPeriod = {
      id: crypto.randomUUID(),
      timetableId: firstId,
      weeks: 1,
    }
    onWeekPlanChange([...weekPlan, newPeriod])
  }

  return (
    <section className="week-plan">
      <h2 className="week-plan__title">Study Plan</h2>

      {weekPlan.length === 0 ? (
        <p className="week-plan__empty">
          No periods yet. Click "＋ Add Period" to get started.
        </p>
      ) : (
        <ul className="week-plan__list">
          {weekPlan.map((period, index) => (
            <li key={period.id} className="week-plan__row">
              <span className="week-plan__index">{index + 1}.</span>

              <select
                className="week-plan__type-select"
                value={period.timetableId}
                onChange={e => handleTimetableChange(period.id, e.target.value)}
                aria-label="Timetable type"
              >
                {timetableList.map(nt => (
                  <option key={nt.id} value={nt.id}>{nt.name}</option>
                ))}
                {/* Fallback: if the referenced timetable was deleted, show it as unknown */}
                {!timetables[period.timetableId] && (
                  <option value={period.timetableId}>(deleted timetable)</option>
                )}
              </select>

              <input
                type="number"
                className="week-plan__weeks-input"
                value={period.weeks}
                min={1}
                max={52}
                onChange={e => handleWeeksChange(period.id, Number(e.target.value))}
                aria-label="Number of weeks"
              />

              <span className="week-plan__weeks-label">
                {period.weeks === 1 ? 'week' : 'weeks'}
              </span>

              <button
                className="week-plan__delete-btn"
                onClick={() => handleDelete(period.id)}
                aria-label="Delete period"
                title="Delete period"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="week-plan__add-btn" onClick={handleAddPeriod}>
        ＋ Add Period
      </button>

      {totalWeeks > 0 && (
        <p className="week-plan__summary">
          Total:{' '}
          <strong>
            {totalWeeks} {totalWeeks === 1 ? 'week' : 'weeks'}
          </strong>{' '}
          ·{' '}
          <strong>{studyHours.toFixed(1)} hours</strong> study
        </p>
      )}
    </section>
  )
}
