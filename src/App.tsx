import React, { useState, useMemo, useEffect, useRef } from 'react'
import './App.css'
import useLocalStorage from './hooks/useLocalStorage'
import type { AppSettings, Subject, FixedActivity, NamedTimetable, WeekPeriod } from './types'
import { createEmptyTimetable, createDefaultTimetables } from './types'
import SetupModal from './components/SetupModal'
import ActivityPalette, { DEFAULT_FIXED_COLOURS, FIXED_ACTIVITIES } from './components/ActivityPalette'
import SubjectManager from './components/SubjectManager'
import TimetableManager from './components/TimetableManager'
import TimetableGrid from './components/TimetableGrid'
import WeekPlan from './components/WeekPlan'
import type { HourTotals } from './utils/timetableUtils'
import GradePredictor from './components/GradePredictor'
import WhatIfPanel from './components/WhatIfPanel'
import TimelineViewer from './components/TimelineViewer'

type Tab = 'timetable' | 'subjects' | 'prediction'

const TABS: { id: Tab; label: string }[] = [
  { id: 'timetable', label: 'Timetable' },
  { id: 'subjects', label: 'Subjects & Grades' },
  { id: 'prediction', label: 'Prediction' },
]

// ── One-time migration from old schoolTimetable/holidayTimetable keys ──────────
function migrateLocalStorage(): Record<string, NamedTimetable> | null {
  try {
    if (localStorage.getItem('timetables')) return null // already migrated
    const rawSchool = localStorage.getItem('schoolTimetable')
    const rawHoliday = localStorage.getItem('holidayTimetable')
    if (!rawSchool && !rawHoliday) return null
    const defaults = createDefaultTimetables()
    if (rawSchool) defaults['school'].timetable = JSON.parse(rawSchool)
    if (rawHoliday) defaults['holiday'].timetable = JSON.parse(rawHoliday)
    return defaults
  } catch {
    return null
  }
}

/** Migrate old WeekPeriod entries that still use `type` instead of `timetableId` */
function migrateWeekPlan(plan: WeekPeriod[]): WeekPeriod[] {
  return plan.map(p => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = p as any
    if (!p.timetableId && legacy.type) {
      return { ...p, timetableId: legacy.type as string }
    }
    return p
  })
}

function App() {
  const fullImportRef = useRef<HTMLInputElement>(null)

  const [settings, setSettings] = useLocalStorage<AppSettings | null>('appSettings', null)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('timetable')

  // ── Persisted state ──────────────────────────────────────────────────────
  // ── Dark mode ──────────────────────────────────────────────────────────────
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const [subjects, setSubjects] = useLocalStorage<Subject[]>('subjects', [])
  const [fixedColours, setFixedColours] = useLocalStorage<Record<FixedActivity, string>>(
    'fixedColours',
    DEFAULT_FIXED_COLOURS,
  )

  // Migrate old school/holiday keys on first render, then use the new map
  const migrated = useMemo(() => migrateLocalStorage(), [])
  const [timetables, setTimetables] = useLocalStorage<Record<string, NamedTimetable>>(
    'timetables',
    migrated ?? createDefaultTimetables(),
  )

  // Load weekPlan and migrate old periods (type → timetableId) on the fly
  const [weekPlanRaw, setWeekPlan] = useLocalStorage<WeekPeriod[]>('weekPlan', [])
  const weekPlan = migrateWeekPlan(weekPlanRaw)

  // ── Active timetable selection ────────────────────────────────────────────
  const [activeTimetableId, setActiveTimetableId] = useState<string>(() => {
    // Pick first available id, preferring 'school'
    return 'school'
  })

  // If the active timetable was deleted, fall back to first available
  const safeActiveTimetableId = timetables[activeTimetableId]
    ? activeTimetableId
    : Object.keys(timetables)[0] ?? 'school'

  // ── Transient state (not persisted) ─────────────────────────────────────
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const [hourTotals, setHourTotals] = useState<HourTotals>({})
  const [totalWeeks, setTotalWeeks] = useState<number>(0)

  // ── Full data export ──────────────────────────────────────────────────────
  function handleExportAll() {
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      timetables,
      subjects,
      weekPlan,
      fixedColours,
    }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timetable_export_${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Full data import ──────────────────────────────────────────────────────
  function handleImportAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (
          typeof parsed !== 'object' ||
          typeof parsed.timetables !== 'object' ||
          !Array.isArray(parsed.subjects) ||
          !Array.isArray(parsed.weekPlan)
        ) {
          alert('Invalid export file — missing required fields.')
          return
        }
        const ok = window.confirm(
          'This will replace ALL your current data (timetables, subjects, week plan, settings). Continue?'
        )
        if (!ok) return
        if (parsed.settings)      setSettings(parsed.settings)
        if (parsed.timetables)    setTimetables(parsed.timetables)
        if (parsed.subjects)      setSubjects(parsed.subjects)
        if (parsed.weekPlan)      setWeekPlan(parsed.weekPlan)
        if (parsed.fixedColours)  setFixedColours(parsed.fixedColours)
      } catch {
        alert('Could not read file — make sure it is a valid export.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  /** Called by SetupModal on first launch or after re-opening from the cog. */
  function handleSettingsConfirm(startHour: number, endHour: number) {
    const prev = settings
    const next: AppSettings = { startHour, endHour }
    setSettings(next)
    setShowSetupModal(false)

    // When hours change, warn the user and reset all timetables
    if (prev && (prev.startHour !== startHour || prev.endHour !== endHour)) {
      const ok = window.confirm(
        'Changing the time range will clear all painted timetable slots. Continue?',
      )
      if (ok) {
        setTimetables(
          Object.fromEntries(
            Object.entries(timetables).map(([id, nt]) => [
              id,
              { ...nt, timetable: createEmptyTimetable() },
            ]),
          ),
        )
      }
    }
  }

  // ── Timetable write-back handler ─────────────────────────────────────────
  function handleTimetableChange(updated: import('./types').Timetable) {
    setTimetables({
      ...timetables,
      [safeActiveTimetableId]: {
        ...timetables[safeActiveTimetableId],
        timetable: updated,
      },
    })
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

  const activeTimetable = timetables[safeActiveTimetableId]?.timetable ?? createEmptyTimetable()

  // ── Main app UI ──────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Timetable &amp; Grade Predictor</h1>
        <button
          className="cog-btn"
          aria-label="Export all data"
          title="Export all data"
          onClick={handleExportAll}
        >
          ⬇
        </button>
        <button
          className="cog-btn"
          aria-label="Import all data"
          title="Import all data"
          onClick={() => fullImportRef.current?.click()}
        >
          ⬆
        </button>
        <input
          ref={fullImportRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImportAll}
        />
        <button
          className="cog-btn"
          aria-label="Toggle dark mode"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
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
          <div className="timetable-tab-layout">
            <TimetableManager
              timetables={timetables}
              onTimetablesChange={setTimetables}
              activeTimetableId={safeActiveTimetableId}
              onActiveTimetableChange={setActiveTimetableId}
              weekPlan={weekPlan}
              onWeekPlanChange={setWeekPlan}
            />
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
                    timetable={activeTimetable}
                    onTimetableChange={handleTimetableChange}
                    timetableId={safeActiveTimetableId}
                    timetableName={timetables[safeActiveTimetableId]?.name ?? 'Timetable'}
                    startHour={settings.startHour}
                    endHour={settings.endHour}
                    selectedActivity={selectedActivity}
                    activityColours={activityColours}
                    legendItems={legendItems}
                    subjects={subjects}
                    totalWeeks={totalWeeks}
                    hourTotals={hourTotals}
                    timetables={timetables}
                    onTimetablesChange={setTimetables}
                    weekPlan={weekPlan}
                  />
              </div>
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
              timetables={timetables}
            />
            <GradePredictor
              subjects={subjects}
              totals={hourTotals}
              totalWeeks={totalWeeks}
            />
            <WhatIfPanel
              subjects={subjects}
              totals={hourTotals}
              totalWeeks={totalWeeks}
            />
            <TimelineViewer
              weekPlan={weekPlan}
              timetables={timetables}
              startHour={settings.startHour}
              endHour={settings.endHour}
              activityColours={activityColours}
              legendItems={legendItems}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
