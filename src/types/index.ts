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
  /** When true, this slot cannot be overwritten by painting or the optimiser */
  locked?: boolean
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

/** A named timetable entry in the timetable pool */
export interface NamedTimetable {
  id: string
  name: string
  timetable: Timetable
}

/** Create the default two timetables (School + Holiday) with stable IDs */
export function createDefaultTimetables(): Record<string, NamedTimetable> {
  return {
    school: { id: 'school', name: 'School', timetable: createEmptyTimetable() },
    holiday: { id: 'holiday', name: 'Holiday', timetable: createEmptyTimetable() },
  }
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export type SubjectDifficulty = 'easy' | 'medium' | 'hard'

/** Optimiser priority — higher = gets study slots allocated first */
export type SubjectPriority = 1 | 2 | 3

export interface GradeSnapshot {
  id: string
  /** ISO date string e.g. "2024-11-15" */
  date: string
  grade: UKGrade
  note?: string
}

export interface Subject {
  id: string
  name: string
  colour: string
  currentGrade: UKGrade
  /** The grade the student is aiming for. Falls back to currentGrade if not set. */
  targetGrade?: UKGrade
  /** How difficult the subject is — affects maintenance hours and grade gain rate. */
  difficulty?: SubjectDifficulty
  /** Log of grade snapshots, e.g. mock exam results. */
  gradeHistory?: GradeSnapshot[]
  /** Optimiser priority: 1 = low, 2 = normal (default), 3 = high */
  priority?: SubjectPriority
}

// ─── Week Plan ────────────────────────────────────────────────────────────────

export interface WeekPeriod {
  id: string
  /** ID of the NamedTimetable this period uses */
  timetableId: string
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
  timetables: Record<string, NamedTimetable>
  subjects: Subject[]
  weekPlan: WeekPeriod[]
}
