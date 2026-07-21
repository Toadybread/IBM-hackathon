// Shared TypeScript types for the Timetable & Grade Predictor app

// ─── Grades ──────────────────────────────────────────────────────────────────

export type UKGrade = 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U'

// ─── Activity Types ───────────────────────────────────────────────────────────

/** Fixed activity labels */
export type FixedActivity = 'school' | 'work' | 'rest' | 'free' | 'fun'

/**
 * Dynamic subject-study activity.
 * Format: "study-{subjectId}"
 */
export type StudyActivity = `study-${string}`

/** Full activity type — either a fixed activity or a per-subject study slot */
export type ActivityType = FixedActivity | StudyActivity

/** Type guard: checks whether an activity string is a study activity */
export function isStudyActivity(a: ActivityType): a is StudyActivity {
  return a.startsWith('study-')
}

/** Extract subject ID from a study activity string */
export function getStudySubjectId(a: StudyActivity): string {
  return a.slice('study-'.length)
}

// ─── Timetable ────────────────────────────────────────────────────────────────

/** A single 15-minute time slot in the grid */
export interface Slot {
  activity: ActivityType | null
}

/** All slots for one day, keyed by slot index (0-based) */
export type DaySchedule = Record<number, Slot>

/** Day name abbreviations */
export type DayName = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export const DAY_NAMES: DayName[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** A full weekly timetable */
export interface Timetable {
  days: Record<DayName, DaySchedule>
}

/** Create a blank timetable (all slots empty) */
export function createEmptyTimetable(): Timetable {
  const days = {} as Record<DayName, DaySchedule>
  for (const day of DAY_NAMES) {
    days[day] = {}
  }
  return { days }
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export interface Subject {
  id: string
  name: string
  colour: string
  currentGrade: UKGrade
}

// ─── Week Plan ────────────────────────────────────────────────────────────────

export interface WeekPeriod {
  id: string
  /** Whether this period uses the school timetable or the holiday timetable */
  type: 'school' | 'holiday'
  weeks: number
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  /** Hour of day that the timetable grid starts (0–23) */
  startHour: number
  /** Hour of day that the timetable grid ends (1–24, exclusive) */
  endHour: number
}

// ─── Top-level App State ──────────────────────────────────────────────────────

export interface AppState {
  /** null until the user completes the first-launch setup modal */
  settings: AppSettings | null
  schoolTimetable: Timetable
  holidayTimetable: Timetable
  subjects: Subject[]
  weekPlan: WeekPeriod[]
}
