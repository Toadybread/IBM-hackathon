import type { Timetable, DayName, Subject } from '../types'
import { DAY_NAMES } from '../types'
import { GRADE_POINTS, computeRequiredHours } from './gradePredictor'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReplaceableActivity = 'free' | 'rest' | 'fun'

/** A contiguous run of the same replaceable activity within a single day. */
export interface SlotRun {
  day: DayName
  startSlot: number
  length: number
  activity: ReplaceableActivity
}

// ─── Priority order for replaceable activities ────────────────────────────────

const PRIORITY_ORDER: ReplaceableActivity[] = ['free', 'rest', 'fun']

// ─── collectReplaceable ───────────────────────────────────────────────────────

/**
 * Scan the timetable and collect all contiguous runs of replaceable activities
 * (free, rest, fun). Returns them sorted:
 *   1. By activity priority: free first, then rest, then fun.
 *   2. Within each group, longest runs first.
 *
 * @param minProtectedSlots  Any run whose length is ≤ this value is left alone
 *                           (preserves short downtime blocks). Default 0 = off.
 */
export function collectReplaceable(
  timetable: Timetable,
  minProtectedSlots = 0,
): SlotRun[] {
  const runs: SlotRun[] = []

  for (const day of DAY_NAMES) {
    const schedule = timetable.days[day]
    const slotIndices = Object.keys(schedule).map(Number).sort((a, b) => a - b)

    let i = 0
    while (i < slotIndices.length) {
      const slotIdx = slotIndices[i]
      const activity = schedule[slotIdx]?.activity

      if ((activity === 'free' || activity === 'rest' || activity === 'fun') && !schedule[slotIdx]?.locked) {
        // Extend run as long as slots are consecutive and same activity
        let runLen = 1
        while (
          i + runLen < slotIndices.length &&
          slotIndices[i + runLen] === slotIdx + runLen &&
          schedule[slotIndices[i + runLen]]?.activity === activity &&
          !schedule[slotIndices[i + runLen]]?.locked
        ) {
          runLen++
        }

        // Skip short blocks to protect the user's downtime
        if (runLen > minProtectedSlots) {
          runs.push({ day, startSlot: slotIdx, length: runLen, activity })
        }
        i += runLen
      } else {
        i++
      }
    }
  }

  // Sort by priority then length descending
  runs.sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.activity)
    const pb = PRIORITY_ORDER.indexOf(b.activity)
    if (pa !== pb) return pa - pb
    return b.length - a.length
  })

  return runs
}

// ─── computeAllocations ──────────────────────────────────────────────────────

/**
 * For each subject, compute how many 15-min slots per week are needed to reach
 * the target grade over the given number of weeks.
 *
 * Returns a Map<subjectId, slotsPerWeek> and the total slots needed per week.
 *
 * @param maxSubjectFraction  Cap: no subject may claim more than this fraction
 *                            of total available replaceable slots. Default 1.0 (off).
 * @param totalReplaceableSlots  Pass the total available replaceable slots so the
 *                               cap can be applied. 0 = disable cap.
 */
export function computeAllocations(
  subjects: Subject[],
  totalWeeks: number,
  efficiency: number,
  maxSubjectFraction = 1.0,
  totalReplaceableSlots = 0,
): { allocations: Map<string, number>; totalSlotsNeeded: number } {
  const allocations = new Map<string, number>()

  // Guard: cannot compute without a valid plan
  if (totalWeeks <= 0 || efficiency <= 0) {
    return { allocations, totalSlotsNeeded: 0 }
  }

  const gaps = subjects.map(s => {
    const target = s.targetGrade ?? s.currentGrade
    const targetPts = GRADE_POINTS[target]
    const currentPts = GRADE_POINTS[s.currentGrade]
    return Math.max(0, targetPts - currentPts)
  })

  const totalGap = gaps.reduce((sum, g) => sum + g, 0)
  if (totalGap === 0) return { allocations, totalSlotsNeeded: 0 }

  // Compute raw slots/week for each subject
  let totalSlotsNeeded = 0
  subjects.forEach((s, idx) => {
    if (gaps[idx] === 0) {
      allocations.set(s.id, 0)
      return
    }
    const target = s.targetGrade ?? s.currentGrade
    const requiredHoursTotal = computeRequiredHours(
      s.currentGrade, target, efficiency, totalWeeks, s.difficulty ?? 'medium',
    )
    // Cap at a reasonable ceiling to avoid edge cases (e.g. U→A* with 1 week)
    const hoursPerWeek = Math.min(requiredHoursTotal / totalWeeks, 40)
    const slotsPerWeek = Math.ceil(hoursPerWeek / 0.25)
    allocations.set(s.id, slotsPerWeek)
    totalSlotsNeeded += slotsPerWeek
  })

  // Apply per-subject cap if requested
  if (maxSubjectFraction < 1.0 && totalReplaceableSlots > 0) {
    const cap = Math.max(1, Math.floor(totalReplaceableSlots * maxSubjectFraction))
    for (const [id, slots] of allocations) {
      if (slots > cap) {
        allocations.set(id, cap)
      }
    }
    // Recompute total after capping
    totalSlotsNeeded = [...allocations.values()].reduce((s, v) => s + v, 0)
  }

  return { allocations, totalSlotsNeeded }
}

// ─── fillTimetable ────────────────────────────────────────────────────────────

const WEEKDAYS = new Set<DayName>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

/**
 * Compute the bias-adjusted study density for a day.
 * Lower score = more eligible (prefer filling here).
 */
function adjustedDensity(timetable: Timetable, day: DayName, weekdayBias: number): number {
  const schedule = timetable.days[day]
  const allSlots = Object.values(schedule)
  const totalSlots = allSlots.length
  if (totalSlots === 0) return 0
  const studySlots = allSlots.filter(s => s.activity?.startsWith('study-')).length
  const density = studySlots / totalSlots
  return WEEKDAYS.has(day) ? density : density * weekdayBias
}

/**
 * Apply the sorted runs to the timetable, replacing slots with study activities
 * for subjects ordered by (priority DESC, slotsRemaining DESC).
 * Subjects without an explicit priority field default to priority 2 (normal).
 */
export function fillTimetable(
  timetable: Timetable,
  runs: SlotRun[],
  allocations: Map<string, number>,
  subjects: Subject[],
  weekdayBias: number,
): Timetable {
  // Work on a mutable deep copy of the days
  const days = Object.fromEntries(
    DAY_NAMES.map(d => [d, { ...timetable.days[d] }]),
  ) as Record<DayName, typeof timetable.days[DayName]>

  // Sort runs by day preference within the same priority group
  const sortedRuns = [...runs].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.activity)
    const pb = PRIORITY_ORDER.indexOf(b.activity)
    if (pa !== pb) return pa - pb
    const da = adjustedDensity({ days: days as Timetable['days'] }, a.day, weekdayBias)
    const db = adjustedDensity({ days: days as Timetable['days'] }, b.day, weekdayBias)
    if (da !== db) return da - db
    return b.length - a.length
  })

  for (const run of sortedRuns) {
    // Pick subject with highest priority, then most remaining slots
    const subjectsSorted = subjects
      .filter(s => (allocations.get(s.id) ?? 0) > 0)
      .sort((a, b) => {
        const pa = b.priority ?? 2
        const pb = a.priority ?? 2
        if (pa !== pb) return pa - pb
        return (allocations.get(b.id) ?? 0) - (allocations.get(a.id) ?? 0)
      })

    if (subjectsSorted.length === 0) break

    const subject = subjectsSorted[0]
    const remaining = allocations.get(subject.id) ?? 0
    const take = Math.min(run.length, remaining)

    for (let offset = 0; offset < take; offset++) {
      days[run.day][run.startSlot + offset] = {
        activity: `study-${subject.id}` as import('../types').ActivityType,
      }
    }

    allocations.set(subject.id, remaining - take)
  }

  return { days: days as Timetable['days'] }
}

// ─── countSlotsByActivity ─────────────────────────────────────────────────────

/** Count how many slots each activity occupies in a timetable. */
export function countSlotsByActivity(timetable: Timetable): Map<string, number> {
  const counts = new Map<string, number>()
  for (const day of DAY_NAMES) {
    for (const slot of Object.values(timetable.days[day])) {
      if (slot.activity) {
        counts.set(slot.activity, (counts.get(slot.activity) ?? 0) + 1)
      }
    }
  }
  return counts
}

// ─── optimiseTimetable (main export) ─────────────────────────────────────────

export interface OptimiseOptions {
  /** Weekday preference multiplier — weekend days fill last. Default 2. */
  weekdayBias?: number
  /**
   * Protect short downtime runs: any replaceable block with length ≤ this value
   * will not be touched. Value is in slots (1 slot = 15 min). Default 0 (off).
   */
  minProtectedSlots?: number
  /**
   * Cap on the fraction of available replaceable slots any single subject can
   * claim. Range 0–1. Default 1.0 (no cap).
   */
  maxSubjectFraction?: number
}

/**
 * Return an optimised copy of the timetable.
 * Replaces free → rest → fun slots with study slots for subjects that need
 * improvement to reach their target grades. Locked slots are never touched.
 */
export function optimiseTimetable(
  timetable: Timetable,
  subjects: Subject[],
  totalWeeks: number,
  efficiency: number,
  options: OptimiseOptions = {},
): Timetable {
  const {
    weekdayBias = 2,
    minProtectedSlots = 0,
    maxSubjectFraction = 1.0,
  } = options

  const runs = collectReplaceable(timetable, minProtectedSlots)
  if (runs.length === 0) return timetable

  const totalReplaceableSlots = runs.reduce((s, r) => s + r.length, 0)

  const { allocations } = computeAllocations(
    subjects, totalWeeks, efficiency, maxSubjectFraction, totalReplaceableSlots,
  )
  const hasAnything = [...allocations.values()].some(v => v > 0)
  if (!hasAnything) return timetable

  return fillTimetable(timetable, runs, allocations, subjects, weekdayBias)
}
