import type { UKGrade } from '../types'
import type { HourTotals } from './timetableUtils'

// ─── Grade point scale ────────────────────────────────────────────────────────

export const GRADE_POINTS: Record<UKGrade, number> = {
  U: 0,
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  'A*': 6,
}

/** Indexed by points (0–6) → grade */
export const POINTS_TO_GRADE: UKGrade[] = ['U', 'E', 'D', 'C', 'B', 'A', 'A*']

// ─── Tunable constants ────────────────────────────────────────────────────────

/** Controls the shape of the logarithmic gain curve (lower = steeper early gain) */
export const LOG_SENSITIVITY = 40

/** Reference point for normalising the logarithmic gain */
export const MAX_REFERENCE_HOURS = 500

/** Maximum grade-point improvement possible */
export const MAX_GRADE_GAIN = 4

/** Maximum grade-point drop when study is insufficient */
export const MAX_GRADE_DROP = 3

/** Hours of effective study per week needed just to maintain current grade */
export const MAINTENANCE_HOURS_PER_WEEK = 1.5

// ─── Helper ───────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Compute study efficiency from work/life balance ratio.
 *
 * balanceRatio = recreationalTime / totalTime  (0–1)
 * Bell curve peaking at 0.35. Clamped to [0.3, 1.0].
 */
export function computeEfficiency(balanceRatio: number): number {
  const raw = 1 - 2.5 * Math.pow(balanceRatio - 0.35, 2)
  return clamp(raw, 0.3, 1.0)
}

/**
 * Predict the final grade given study hours, efficiency, and total weeks.
 *
 * - If effectiveHours >= maintenanceHours: logarithmic gain applied.
 * - If effectiveHours <  maintenanceHours: proportional drop applied.
 */
export function predictGrade(
  currentGrade: UKGrade,
  studyHours: number,
  efficiency: number,
  totalWeeks: number,
): UKGrade {
  const currentPoints = GRADE_POINTS[currentGrade]
  const effectiveHours = studyHours * efficiency
  const maintenanceHours = MAINTENANCE_HOURS_PER_WEEK * totalWeeks

  let predictedPoints: number

  if (effectiveHours >= maintenanceHours) {
    const rawGain = Math.log(1 + effectiveHours / LOG_SENSITIVITY)
    const normalisation = Math.log(1 + MAX_REFERENCE_HOURS / LOG_SENSITIVITY)
    const normalisedGain = rawGain / normalisation
    const pointsGain = normalisedGain * MAX_GRADE_GAIN
    predictedPoints = clamp(currentPoints + pointsGain, 0, 6)
  } else {
    const shortfallRatio = (maintenanceHours - effectiveHours) / maintenanceHours
    const pointsDrop = shortfallRatio * MAX_GRADE_DROP
    predictedPoints = clamp(currentPoints - pointsDrop, 0, 6)
  }

  return POINTS_TO_GRADE[Math.round(predictedPoints)]
}

/**
 * Compute the balance ratio and efficiency from an HourTotals map.
 * Recreational activities are: "free", "fun", "rest".
 */
export function computeBalanceStats(totals: HourTotals): {
  totalHours: number
  recreationalHours: number
  balanceRatio: number
  efficiency: number
} {
  const totalHours = Object.values(totals).reduce((sum, h) => sum + h, 0)
  const recreationalHours =
    (totals['free'] ?? 0) + (totals['fun'] ?? 0) + (totals['rest'] ?? 0)

  const balanceRatio = totalHours > 0 ? recreationalHours / totalHours : 0
  const efficiency = computeEfficiency(balanceRatio)

  return { totalHours, recreationalHours, balanceRatio, efficiency }
}
