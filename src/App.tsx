import { useState } from 'react'
import './App.css'
import useLocalStorage from './hooks/useLocalStorage'
import type { AppSettings, Subject, FixedActivity, Timetable, WeekPeriod } from './types'
import { createEmptyTimetable } from './types'
import SetupModal from './components/SetupModal'
import ActivityPalette, { DEFAULT_FIXED_COLOURS, FIXED_ACTIVITIES } from './components/ActivityPalette'
import SubjectManager from './components/SubjectManager'
import TimetableGrid from './components/TimetableGrid'
import WeekPlan from './components/WeekPlan'
import type { HourTotals } from './components/WeekPlan'
import GradePredictor from './components/GradePredictor'

type Tab = 'timetable' | 'subjects' | 'prediction'

const TABS: { id: Tab; label: string }[] = [
  { id: 'timetable', label: 'Timetable' },
  { id: 'subjects', label: 'Subjects & Grades' },
  { id: 'prediction', label: 'Prediction' },
]

function App() {
  const [settings, setSettings] = useLocalStorage<AppSettings | null>('appSettings', null)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('timetable')

  // ── Persisted state ──────────────────────────────────────────────────────
  const [subjects, setSubjects] = useLocalStorage<Subject[]>('subjects', [])
  const [fixedColours, setFixedColours] = useLocalStorage<Record<FixedActivity, string>>(
    'fixedColours',
    DEFAULT_FIXED_COLOURS,
  )
  const [schoolTimetable, setSchoolTimetable] = useLocalStorage<Timetable>(
    'schoolTimetable',
    createEmptyTimetable(),
  )
  const [holidayTimetable, setHolidayTimetable] = useLocalStorage<Timetable>(
    'holidayTimetable',
    createEmptyTimetable(),
  )
  const [weekPlan, setWeekPlan] = useLocalStorage<WeekPeriod[]>('weekPlan', [])

  // ── Transient state (not persisted) ─────────────────────────────────────
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const [hourTotals, setHourTotals] = useState<HourTotals>({})
  const [totalWeeks, setTotalWeeks] = useState<number>(0)

  /** Called by SetupModal on first launch or after re-opening from the cog. */
  function handleSettingsConfirm(startHour: number, endHour: number) {
    const prev = settings
    const next: AppSettings = { startHour, endHour }
    setSettings(next)
    setShowSetupModal(false)

    // When hours change, warn the user and reset both timetables
    if (prev && (prev.startHour !== startHour || prev.endHour !== endHour)) {
      const ok = window.confirm(
        'Changing the time range will clear all painted timetable slots. Continue?',
      )
      if (ok) {
        setSchoolTimetable(createEmptyTimetable())
        setHolidayTimetable(createEmptyTimetable())
      }
    }
  }

  // ── Activity colour map ───────────────────────────────────────────────────
  const activityColours: Record<string, string> = {
    ...fixedColours,
    ...Object.fromEntries(subjects.map(s => [`study-${s.id}`, s.colour])),
  }

  // ── Legend items for the timetable ────────────────────────────────────────
  const legendItems = [
    ...FIXED_ACTIVITIES.map(({ id, label }) => ({
      id,
      label,
      colour: fixedColours[id] ?? DEFAULT_FIXED_COLOURS[id],
    })),
    ...subjects.map(s => ({ id: `study-${s.id}`, label: s.name, colour: s.colour })),
  ]

  // ── First-launch: no settings stored yet ────────────────────────────────
  if (settings === null) {
    return <SetupModal onConfirm={handleSettingsConfirm} />
  }

  // ── Re-open via cog button ───────────────────────────────────────────────
  if (showSetupModal) {
    return (
      <SetupModal
        onConfirm={handleSettingsConfirm}
        initialStart={settings.startHour}
        initialEnd={settings.endHour}
      />
    )
  }

  // ── Main app UI ──────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Timetable &amp; Grade Predictor</h1>
        <button
          className="cog-btn"
          aria-label="Open settings"
          title="Settings"
          onClick={() => setShowSetupModal(true)}
        >
          ⚙
        </button>
      </header>

      <nav className="tab-bar" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-btn${activeTab === tab.id ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {activeTab === 'timetable' && (
          <div className="timetable-layout">
            <ActivityPalette
              selectedActivity={selectedActivity}
              onSelectActivity={setSelectedActivity}
              subjects={subjects}
              onSubjectsChange={setSubjects}
              fixedColours={fixedColours}
              onFixedColoursChange={setFixedColours}
            />
            <div className="timetable-area">
              <TimetableGrid
                schoolTimetable={schoolTimetable}
                holidayTimetable={holidayTimetable}
                onSchoolTimetableChange={setSchoolTimetable}
                onHolidayTimetableChange={setHolidayTimetable}
                startHour={settings.startHour}
                endHour={settings.endHour}
                selectedActivity={selectedActivity}
                activityColours={activityColours}
                legendItems={legendItems}
              />
            </div>
          </div>
        )}
        {activeTab === 'subjects' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
            <SubjectManager subjects={subjects} onSubjectsChange={setSubjects} />
          </div>
        )}
        {activeTab === 'prediction' && (
          <div className="prediction-layout">
            <WeekPlan
              weekPlan={weekPlan}
              onWeekPlanChange={setWeekPlan}
              onTotalsChange={(totals, weeks) => {
                setHourTotals(totals)
                setTotalWeeks(weeks)
              }}
              schoolTimetable={schoolTimetable}
              holidayTimetable={holidayTimetable}
            />
            <GradePredictor
              subjects={subjects}
              totals={hourTotals}
              totalWeeks={totalWeeks}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
