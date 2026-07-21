import type { UKGrade, SubjectDifficulty } from '../types'
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

/**
 * Exponential-saturation half-life constant (effective hours).
 * Calibrated so that ~108 effective hours (3 h/wk × 36 wks) produces
 * exactly 1 grade-point of improvement for a medium subject.
 * Formula: pointsGain = MAX_GRADE_GAIN × (1 − exp(−H / GAIN_HALF_LIFE))
 */
export const GAIN_HALF_LIFE = 592

/** Maximum grade-point span across the full U→A* scale */
export const MAX_GRADE_GAIN = 6

/** Maximum grade-point drop when study falls below maintenance */
export const MAX_GRADE_DROP = 3

/**
 * Hours of effective study per week needed to maintain current grade.
 * 4 h/wk for medium difficulty; scaled by DIFFICULTY_FACTORS.maintenance.
 */
export const MAINTENANCE_HOURS_PER_WEEK = 4

/** Difficulty scaling factors for maintenance hours and grade gain rate */
export const DIFFICULTY_FACTORS: Record<SubjectDifficulty, { maintenance: number; gain: number }> = {
  easy:   { maintenance: 0.75, gain: 1.0 },  // 3 h/wk to maintain
  medium: { maintenance: 1.0,  gain: 1.0 },  // 4 h/wk to maintain
  hard:   { maintenance: 1.25, gain: 1.0 },  // 5 h/wk to maintain
}

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
 * Gain model: exponential saturation curve
 *   effectiveHours = studyHours × efficiency
 *   pointsGain     = MAX_GRADE_GAIN × (1 − exp(−effectiveHours / GAIN_HALF_LIFE))
 *
 * This naturally gives ~1 pt per 108 effective hours at the low end and
 * diminishing returns toward A* (matching your harder-to-improve upper grades).
 *
 * If study < maintenance threshold, grade drops proportionally instead.
 */
export function predictGrade(
  currentGrade: UKGrade,
  studyHours: number,
  efficiency: number,
  totalWeeks: number,
  difficulty: SubjectDifficulty = 'medium',
): UKGrade {
  const factors = DIFFICULTY_FACTORS[difficulty]
  const currentPoints = GRADE_POINTS[currentGrade]
  const effectiveHours = studyHours * efficiency
  const maintenanceHours = MAINTENANCE_HOURS_PER_WEEK * factors.maintenance * totalWeeks

  let predictedPoints: number

  if (effectiveHours >= maintenanceHours) {
    const pointsGain = MAX_GRADE_GAIN * (1 - Math.exp(-effectiveHours / GAIN_HALF_LIFE))
    predictedPoints = clamp(currentPoints + pointsGain, 0, 6)
  } else {
    const shortfallRatio = (maintenanceHours - effectiveHours) / maintenanceHours
    const pointsDrop = shortfallRatio * MAX_GRADE_DROP
    predictedPoints = clamp(currentPoints - pointsDrop, 0, 6)
  }

  return POINTS_TO_GRADE[Math.round(predictedPoints)]
}

/**
 * Raw study hours per week needed to maintain the current grade.
 * The optimiser uses this for subjects already at their target grade.
 */
export function computeMaintenanceHoursPerWeek(
  difficulty: SubjectDifficulty = 'medium',
): number {
  return MAINTENANCE_HOURS_PER_WEEK * DIFFICULTY_FACTORS[difficulty].maintenance
}

/**
 * Compute the raw study hours needed over a full plan to reach `targetGrade`
 * from `currentGrade` at a given efficiency level.
 *
 * Inverts the exponential saturation curve:
 *   effectiveHoursNeeded = −GAIN_HALF_LIFE × ln(1 − pointsGain / MAX_GRADE_GAIN)
 *   rawHoursNeeded       = effectiveHoursNeeded / efficiency
 *
 * Returns 0 if already at or above target. Returns Infinity if efficiency is 0
 * or if the gain would require the full MAX_GRADE_GAIN (asymptote).
 */
export function computeRequiredHours(
  currentGrade: UKGrade,
  targetGrade: UKGrade,
  efficiency: number,
  _totalWeeks: number,
  _difficulty: SubjectDifficulty = 'medium',
): number {
  const currentPoints = GRADE_POINTS[currentGrade]
  const targetPoints = GRADE_POINTS[targetGrade]
  const pointsGain = clamp(targetPoints - currentPoints, 0, MAX_GRADE_GAIN - 0.001)

  if (pointsGain <= 0) return 0
  if (efficiency <= 0) return Infinity

  const effectiveHoursNeeded = -GAIN_HALF_LIFE * Math.log(1 - pointsGain / MAX_GRADE_GAIN)
  return effectiveHoursNeeded / efficiency
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
