import type { WeekPeriod, Timetable } from '../types'
import { DAY_NAMES } from '../types'

/**
 * A map from activity ID (or any string key) to total hours.
 * Keys are ActivityType strings, e.g. "school", "study-abc123", etc.
 */
export interface HourTotals {
  [activityId: string]: number
}

/**
 * Compute total hours per activity across a week plan.
 *
 * For each period:
 *   - Choose the relevant timetable (school vs holiday).
 *   - Count how many slots each activity occupies across all 7 days.
 *   - Multiply by 0.25 h/slot × period.weeks.
 *
 * Returns the aggregated totals and the sum of all weeks.
 */
export function computeTotals(
  weekPlan: WeekPeriod[],
  schoolTimetable: Timetable,
  holidayTimetable: Timetable,
): { totals: HourTotals; totalWeeks: number } {
  const totals: HourTotals = {}
  let totalWeeks = 0

  for (const period of weekPlan) {
    const timetable = period.type === 'school' ? schoolTimetable : holidayTimetable
    totalWeeks += period.weeks

    for (const day of DAY_NAMES) {
      const daySchedule = timetable.days[day]
      for (const slot of Object.values(daySchedule)) {
        if (slot.activity !== null) {
          const key = slot.activity
          totals[key] = (totals[key] ?? 0) + 0.25 * period.weeks
        }
      }
    }
  }

  return { totals, totalWeeks }
}
