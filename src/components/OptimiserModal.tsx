import { useState, useMemo } from 'react'
import './OptimiserModal.css'
import type { Timetable, Subject, NamedTimetable, WeekPeriod } from '../types'
import { DAY_NAMES } from '../types'
import {
  optimiseTimetable,
  collectReplaceable,
  countSlotsByActivity,
} from '../utils/optimiserUtils'
import { computeBalanceStats, GRADE_POINTS } from '../utils/gradePredictor'
import type { HourTotals } from '../utils/timetableUtils'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OptimiserModalProps {
  /** The currently-active timetable (used in single-timetable mode) */
  timetable: Timetable
  timetableName: string
  subjects: Subject[]
  totalWeeks: number
  hourTotals: HourTotals
  /** Full map — needed for "optimise all" mode */
  timetables: Record<string, NamedTimetable>
  weekPlan: WeekPeriod[]
  onApply: (updated: Timetable) => void
  onApplyAll: (updated: Record<string, NamedTimetable>) => void
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slotsToTime(slots: number): string {
  const totalMins = slots * 15
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** Sum of period.weeks for a given timetableId */
function weeksForTimetable(weekPlan: WeekPeriod[], timetableId: string): number {
  return weekPlan.filter(p => p.timetableId === timetableId).reduce((s, p) => s + p.weeks, 0)
}

interface DiffRow {
  activity: string
  label: string
  before: number
  after: number
}

function buildDiff(before: Timetable, after: Timetable, subjects: Subject[]): DiffRow[] {
  const labelFor = (act: string): string => {
    if (act.startsWith('study-')) {
      const id = act.slice('study-'.length)
      return subjects.find(s => s.id === id)?.name ?? act
    }
    return act.charAt(0).toUpperCase() + act.slice(1)
  }

  const bCounts = countSlotsByActivity(before)
  const aCounts = countSlotsByActivity(after)

  // Union of all activity keys that appear in either
  const keys = new Set([...bCounts.keys(), ...aCounts.keys()])
  const rows: DiffRow[] = []
  for (const key of keys) {
    const b = bCounts.get(key) ?? 0
    const a = aCounts.get(key) ?? 0
    rows.push({ activity: key, label: labelFor(key), before: b, after: a })
  }

  // Sort: changed rows first (largest absolute diff), then unchanged
  rows.sort((a, b) => {
    const da = Math.abs(a.after - a.before)
    const db = Math.abs(b.after - b.before)
    if (da !== db) return db - da
    return a.label.localeCompare(b.label)
  })

  return rows
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OptimiserModal({
  timetable,
  timetableName,
  subjects,
  totalWeeks,
  hourTotals,
  timetables,
  weekPlan,
  onApply,
  onApplyAll,
  onClose,
}: OptimiserModalProps) {
  // ── Settings ────────────────────────────────────────────────────────────────
  const [weekdayBias, setWeekdayBias] = useState(2)
  // minProtectedSlots: 0 = off, 1–8 slots (15min–2h)
  const [minProtectedSlots, setMinProtectedSlots] = useState(0)
  // maxSubjectFraction: 0.1–1.0 (10%–100%), default disabled = 1.0
  const [capEnabled, setCapEnabled] = useState(false)
  const [maxSubjectFraction, setMaxSubjectFraction] = useState(0.4)
  const [applyAll, setApplyAll] = useState(false)

  const { efficiency } = computeBalanceStats(hourTotals)

  // ── Pre-checks ──────────────────────────────────────────────────────────────
  const hasGap = subjects.some(s => {
    const target = s.targetGrade ?? s.currentGrade
    return GRADE_POINTS[target] > GRADE_POINTS[s.currentGrade]
  })

  // ── Replaceable slot stats ───────────────────────────────────────────────────
  const replaceableStats = useMemo(() => {
    const runs = collectReplaceable(timetable, minProtectedSlots)
    const free = runs.filter(r => r.activity === 'free').reduce((s, r) => s + r.length, 0)
    const rest = runs.filter(r => r.activity === 'rest').reduce((s, r) => s + r.length, 0)
    const fun  = runs.filter(r => r.activity === 'fun').reduce((s, r) => s + r.length, 0)
    return { free, rest, fun, total: free + rest + fun }
  }, [timetable, minProtectedSlots])

  // ── Live preview: compute optimised timetable ────────────────────────────────
  const options = useMemo(() => ({
    weekdayBias,
    minProtectedSlots,
    maxSubjectFraction: capEnabled ? maxSubjectFraction : 1.0,
  }), [weekdayBias, minProtectedSlots, capEnabled, maxSubjectFraction])

  const previewTimetable = useMemo(() => {
    if (!hasGap || totalWeeks <= 0) return timetable
    return optimiseTimetable(timetable, subjects, totalWeeks, efficiency, options)
  }, [timetable, subjects, totalWeeks, efficiency, options, hasGap])

  const diffRows = useMemo(
    () => buildDiff(timetable, previewTimetable, subjects),
    [timetable, previewTimetable, subjects],
  )

  const totalChanges = diffRows.reduce((s, r) => s + Math.abs(r.after - r.before), 0)

  // ── All-timetables preview ────────────────────────────────────────────────────
  const allTimetableStats = useMemo(() => {
    if (!applyAll) return []
    return Object.values(timetables).map(nt => {
      const weeks = weeksForTimetable(weekPlan, nt.id)
      const runs = collectReplaceable(nt.timetable, minProtectedSlots)
      const replaceable = runs.reduce((s, r) => s + r.length, 0)
      return { id: nt.id, name: nt.name, weeks, replaceable }
    })
  }, [applyAll, timetables, weekPlan, minProtectedSlots])

  // ── Apply ────────────────────────────────────────────────────────────────────
  function handleApply() {
    if (applyAll) {
      const updated: Record<string, NamedTimetable> = {}
      for (const [id, nt] of Object.entries(timetables)) {
        const weeks = weeksForTimetable(weekPlan, id)
        if (weeks <= 0) {
          updated[id] = nt
          continue
        }
        const optimised = optimiseTimetable(nt.timetable, subjects, weeks, efficiency, options)
        updated[id] = { ...nt, timetable: optimised }
      }
      onApplyAll(updated)
    } else {
      onApply(previewTimetable)
    }
    onClose()
  }

  // ── Priority order preview (for user reference) ──────────────────────────────
  const priorityOrder = useMemo(() => {
    return [...subjects]
      .filter(s => {
        const target = s.targetGrade ?? s.currentGrade
        return GRADE_POINTS[target] > GRADE_POINTS[s.currentGrade]
      })
      .sort((a, b) => {
        const pa = b.priority ?? 2
        const pb = a.priority ?? 2
        if (pa !== pb) return pa - pb
        const gapA = GRADE_POINTS[a.targetGrade ?? a.currentGrade] - GRADE_POINTS[a.currentGrade]
        const gapB = GRADE_POINTS[b.targetGrade ?? b.currentGrade] - GRADE_POINTS[b.currentGrade]
        return gapB - gapA
      })
  }, [subjects])

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="om-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="om-modal" role="dialog" aria-modal="true" aria-label="Optimise Timetable">

        {/* Header */}
        <div className="om-header">
          <span className="om-header__icon">✨</span>
          <div>
            <h2 className="om-header__title">Optimise Timetable</h2>
            <p className="om-header__sub">
              Replaces free / rest / fun slots with study time to hit your target grades.
              Locked slots are never touched.
            </p>
          </div>
          <button className="om-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* No-gap warning */}
        {!hasGap && (
          <div className="om-warning">
            ⚠️ No subjects have a grade gap. Set higher target grades in the <strong>Subjects &amp; Grades</strong> tab first.
          </div>
        )}

        {/* No weeks warning */}
        {totalWeeks <= 0 && (
          <div className="om-warning">
            ⚠️ No study weeks are defined. Add a week plan in the <strong>Prediction</strong> tab first.
          </div>
        )}

        <div className="om-body">
          <div className="om-left">

            {/* ── Settings panel ─────────────────────────────────────────── */}
            <section className="om-section">
              <h3 className="om-section__title">Settings</h3>

              {/* Weekday bias */}
              <label className="om-field">
                <div className="om-field__header">
                  <span className="om-field__label">Weekday bias</span>
                  <span className="om-field__value">{weekdayBias}×</span>
                </div>
                <input
                  type="range" min={1} max={10} step={1}
                  value={weekdayBias}
                  onChange={e => setWeekdayBias(Number(e.target.value))}
                  className="om-slider"
                />
                <p className="om-field__hint">Weekdays get filled {weekdayBias}× more than weekends before weekends are touched.</p>
              </label>

              {/* Protect rest blocks */}
              <label className="om-field">
                <div className="om-field__header">
                  <span className="om-field__label">Protect short free blocks</span>
                  <span className="om-field__value">
                    {minProtectedSlots === 0 ? 'Off' : `≤ ${slotsToTime(minProtectedSlots)}`}
                  </span>
                </div>
                <input
                  type="range" min={0} max={8} step={1}
                  value={minProtectedSlots}
                  onChange={e => setMinProtectedSlots(Number(e.target.value))}
                  className="om-slider"
                />
                <p className="om-field__hint">
                  {minProtectedSlots === 0
                    ? 'All free / rest / fun blocks are eligible for replacement.'
                    : `Runs of ${slotsToTime(minProtectedSlots)} or less will not be replaced — preserving short breaks.`}
                </p>
              </label>

              {/* Per-subject cap */}
              <div className="om-field">
                <div className="om-field__header">
                  <label className="om-toggle">
                    <input
                      type="checkbox"
                      checked={capEnabled}
                      onChange={e => setCapEnabled(e.target.checked)}
                    />
                    <span className="om-field__label">Cap per-subject slots</span>
                  </label>
                  {capEnabled && (
                    <span className="om-field__value">{Math.round(maxSubjectFraction * 100)}%</span>
                  )}
                </div>
                {capEnabled && (
                  <>
                    <input
                      type="range" min={0.1} max={1.0} step={0.05}
                      value={maxSubjectFraction}
                      onChange={e => setMaxSubjectFraction(Number(e.target.value))}
                      className="om-slider"
                    />
                    <p className="om-field__hint">
                      No single subject can claim more than {Math.round(maxSubjectFraction * 100)}% of available slots,
                      preventing one large gap from dominating the timetable.
                    </p>
                  </>
                )}
              </div>

              {/* Optimise all */}
              <div className="om-field">
                <label className="om-toggle">
                  <input
                    type="checkbox"
                    checked={applyAll}
                    onChange={e => setApplyAll(e.target.checked)}
                  />
                  <span className="om-field__label">Apply to all timetables</span>
                </label>
                {applyAll && (
                  <div className="om-all-list">
                    {allTimetableStats.map(t => (
                      <div key={t.id} className="om-all-row">
                        <span className="om-all-name">{t.name}</span>
                        <span className="om-all-stat">{t.weeks} wk</span>
                        <span className="om-all-stat">{t.replaceable} replaceable slots</span>
                        {t.weeks === 0 && <span className="om-all-warn">no weeks — skipped</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ── Slot availability ───────────────────────────────────────── */}
            <section className="om-section">
              <h3 className="om-section__title">
                Available Slots
                {!applyAll && <span className="om-section__sub"> — {timetableName}</span>}
              </h3>
              <div className="om-chips">
                <div className="om-chip om-chip--free">
                  <span className="om-chip__label">Free</span>
                  <span className="om-chip__val">{replaceableStats.free} slots ({slotsToTime(replaceableStats.free)})</span>
                </div>
                <div className="om-chip om-chip--rest">
                  <span className="om-chip__label">Rest</span>
                  <span className="om-chip__val">{replaceableStats.rest} slots ({slotsToTime(replaceableStats.rest)})</span>
                </div>
                <div className="om-chip om-chip--fun">
                  <span className="om-chip__label">Fun</span>
                  <span className="om-chip__val">{replaceableStats.fun} slots ({slotsToTime(replaceableStats.fun)})</span>
                </div>
              </div>
              {replaceableStats.total === 0 && (
                <p className="om-field__hint" style={{ marginTop: '8px', color: 'var(--danger, #c0392b)' }}>
                  No replaceable slots found — paint some free / rest / fun slots in the timetable first.
                </p>
              )}
            </section>

            {/* ── Fill order ──────────────────────────────────────────────── */}
            {priorityOrder.length > 0 && (
              <section className="om-section">
                <h3 className="om-section__title">Fill Order</h3>
                <p className="om-field__hint" style={{ marginBottom: '8px' }}>
                  Subjects are filled in this order (priority → gap size):
                </p>
                <ol className="om-fill-order">
                  {priorityOrder.map((s, i) => {
                    const gap = GRADE_POINTS[s.targetGrade ?? s.currentGrade] - GRADE_POINTS[s.currentGrade]
                    const priorityLabel = s.priority === 3 ? '⭐ High' : s.priority === 1 ? 'Low' : 'Normal'
                    return (
                      <li key={s.id} className="om-fill-order__item">
                        <span className="om-fill-order__num">{i + 1}</span>
                        <span className="om-fill-order__swatch" style={{ background: s.colour }} />
                        <span className="om-fill-order__name">{s.name}</span>
                        <span className="om-fill-order__meta">{priorityLabel} · gap {gap} pt{gap !== 1 ? 's' : ''}</span>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}
          </div>

          {/* ── Right: diff preview ──────────────────────────────────────────── */}
          <div className="om-right">
            <section className="om-section om-section--full">
              <h3 className="om-section__title">
                Preview Changes
                {totalChanges > 0
                  ? <span className="om-badge">{totalChanges} slots</span>
                  : <span className="om-badge om-badge--none">no changes</span>}
              </h3>

              {(!hasGap || totalWeeks <= 0) ? (
                <p className="om-field__hint">Fix the warnings above to see a preview.</p>
              ) : diffRows.length === 0 ? (
                <p className="om-field__hint">Nothing to change — timetable is already optimised.</p>
              ) : (
                <table className="om-diff-table">
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th className="om-diff-table__num">Before</th>
                      <th className="om-diff-table__num">After</th>
                      <th className="om-diff-table__num">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffRows.map(row => {
                      const delta = row.after - row.before
                      const cls = delta > 0 ? 'om-diff--add' : delta < 0 ? 'om-diff--del' : ''
                      return (
                        <tr key={row.activity} className={cls}>
                          <td className="om-diff-table__label">
                            {row.activity.startsWith('study-') && (
                              <span
                                className="om-diff-table__swatch"
                                style={{
                                  background: subjects.find(s => `study-${s.id}` === row.activity)?.colour ?? '#ccc',
                                }}
                              />
                            )}
                            {row.label}
                          </td>
                          <td className="om-diff-table__num">{row.before}</td>
                          <td className="om-diff-table__num">{row.after}</td>
                          <td className="om-diff-table__num om-diff-table__delta">
                            {delta === 0 ? '—' : delta > 0 ? `+${delta}` : `${delta}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>

            {/* Day-by-day slot summary */}
            {hasGap && totalWeeks > 0 && totalChanges > 0 && (
              <section className="om-section om-section--full">
                <h3 className="om-section__title">Changes by Day</h3>
                <div className="om-day-grid">
                  {DAY_NAMES.map(day => {
                    const bBefore = countSlotsByActivity({ days: { ...timetable.days } } as Timetable)
                    const beforeDay = Object.values(timetable.days[day] ?? {}).filter(s => s.activity?.startsWith('study-')).length
                    const afterDay = Object.values(previewTimetable.days[day] ?? {}).filter(s => s.activity?.startsWith('study-')).length
                    const delta = afterDay - beforeDay
                    void bBefore // suppress unused warning
                    return (
                      <div key={day} className={`om-day-cell${delta > 0 ? ' om-day-cell--changed' : ''}`}>
                        <span className="om-day-cell__name">{day}</span>
                        <span className="om-day-cell__delta">
                          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '—'}
                        </span>
                        <span className="om-day-cell__hint">{afterDay > 0 ? `${slotsToTime(afterDay)} study` : 'no study'}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="om-footer">
          <button className="om-btn om-btn--secondary" onClick={onClose}>Cancel</button>
          <button
            className="om-btn om-btn--primary"
            onClick={handleApply}
            disabled={!hasGap || totalWeeks <= 0 || replaceableStats.total === 0}
          >
            {applyAll ? `Apply to all ${Object.keys(timetables).length} timetables` : 'Apply optimisation'}
          </button>
        </div>

      </div>
    </div>
  )
}
