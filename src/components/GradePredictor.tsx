import type { Subject } from '../types'
import { GRADE_POINTS } from '../utils/gradePredictor'
import { computeBalanceStats, predictGrade, computeRequiredHours } from '../utils/gradePredictor'
import type { HourTotals } from '../utils/timetableUtils'
import './GradePredictor.css'

interface GradePredictorProps {
  subjects: Subject[]
  totals: HourTotals
  totalWeeks: number
}

export default function GradePredictor({ subjects, totals, totalWeeks }: GradePredictorProps) {
  // ── Empty states ─────────────────────────────────────────────────────────────
  if (subjects.length === 0) {
    return (
      <div className="grade-predictor__empty">
        Add subjects in the <strong>Subjects &amp; Grades</strong> tab to see predictions.
      </div>
    )
  }

  if (totalWeeks === 0) {
    return (
      <div className="grade-predictor__empty">
        Add study periods above to see predictions.
      </div>
    )
  }

  // ── Balance stats ─────────────────────────────────────────────────────────────
  const { totalHours, recreationalHours, balanceRatio, efficiency } =
    computeBalanceStats(totals)

  const studyHours = Object.entries(totals)
    .filter(([k]) => k.startsWith('study-'))
    .reduce((s, [, h]) => s + h, 0)

  const otherHours = Math.max(0, totalHours - studyHours - recreationalHours)

  // Bar percentages (guard divide-by-zero)
  const studyPct = totalHours > 0 ? (studyHours / totalHours) * 100 : 0
  const recPct = totalHours > 0 ? (recreationalHours / totalHours) * 100 : 0
  const otherPct = totalHours > 0 ? (otherHours / totalHours) * 100 : 0

  const recPercent = Math.round(balanceRatio * 100)
  const effPercent = Math.round(efficiency * 100)

  // ── Per-subject rows ──────────────────────────────────────────────────────────
  const rows = subjects.map(subject => {
    const subjectHours = totals[`study-${subject.id}`] ?? 0
    const effectiveHours = subjectHours * efficiency
    const diff = subject.difficulty ?? 'medium'
    const predicted = predictGrade(subject.currentGrade, subjectHours, efficiency, totalWeeks, diff)
    const currentPoints = GRADE_POINTS[subject.currentGrade]
    const predictedPoints = GRADE_POINTS[predicted]
    const delta = predictedPoints - currentPoints

    // ── Gap analysis ──────────────────────────────────────────────────────
    const target = subject.targetGrade ?? subject.currentGrade
    const targetPoints = GRADE_POINTS[target]
    const onTrack = predictedPoints >= targetPoints
    const requiredHours = computeRequiredHours(subject.currentGrade, target, efficiency, totalWeeks, diff)
    const hoursGap = onTrack ? 0 : requiredHours - subjectHours
    const hoursPerWeekGap = totalWeeks > 0 ? hoursGap / totalWeeks : 0

    return { subject, subjectHours, effectiveHours, predicted, delta, target, onTrack, hoursPerWeekGap }
  })

  return (
    <section className="grade-predictor">
      {/* ── Balance card ──────────────────────────────────────────────────── */}
      <div className="grade-predictor__balance-card">
        <h3 className="grade-predictor__card-title">Work / Life Balance</h3>

        <div className="grade-predictor__stats-row">
          <div className="grade-predictor__stat">
            <span className="grade-predictor__stat-label">Total Hours</span>
            <span className="grade-predictor__stat-value">{totalHours.toFixed(1)}</span>
          </div>
          <div className="grade-predictor__stat">
            <span className="grade-predictor__stat-label">Study Hours</span>
            <span className="grade-predictor__stat-value">{studyHours.toFixed(1)}</span>
          </div>
          <div className="grade-predictor__stat">
            <span className="grade-predictor__stat-label">Recreational Hours</span>
            <span className="grade-predictor__stat-value">{recreationalHours.toFixed(1)}</span>
          </div>
          <div className="grade-predictor__stat">
            <span className="grade-predictor__stat-label">Balance Ratio</span>
            <span className="grade-predictor__stat-value">{recPercent}%</span>
          </div>
          <div className="grade-predictor__stat">
            <span className="grade-predictor__stat-label">Efficiency</span>
            <span className="grade-predictor__stat-value">{effPercent}%</span>
          </div>
        </div>

        {/* Breakdown bar */}
        <div className="grade-predictor__bar" aria-label="Time breakdown bar">
          {studyPct > 0 && (
            <div
              className="grade-predictor__bar-segment grade-predictor__bar-segment--study"
              style={{ width: `${studyPct}%` }}
              title={`Study: ${studyHours.toFixed(1)}h`}
            />
          )}
          {recPct > 0 && (
            <div
              className="grade-predictor__bar-segment grade-predictor__bar-segment--rec"
              style={{ width: `${recPct}%` }}
              title={`Recreational: ${recreationalHours.toFixed(1)}h`}
            />
          )}
          {otherPct > 0 && (
            <div
              className="grade-predictor__bar-segment grade-predictor__bar-segment--other"
              style={{ width: `${otherPct}%` }}
              title={`Other: ${otherHours.toFixed(1)}h`}
            />
          )}
        </div>
        <div className="grade-predictor__bar-legend">
          <span className="grade-predictor__legend-dot grade-predictor__legend-dot--study" />
          Study
          <span className="grade-predictor__legend-dot grade-predictor__legend-dot--rec" />
          Recreational
          <span className="grade-predictor__legend-dot grade-predictor__legend-dot--other" />
          Other
        </div>

        <p className="grade-predictor__balance-text">
          Your schedule is <strong>{recPercent}% recreational</strong> — efficiency:{' '}
          <strong>{effPercent}%</strong>
        </p>
      </div>

      {/* ── Prediction table ───────────────────────────────────────────────── */}
      <div className="grade-predictor__table-wrapper">
        <table className="grade-predictor__table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Current</th>
              <th>Target</th>
              <th>Difficulty</th>
              <th>Study Hours</th>
              <th>Eff. Hours</th>
              <th>Predicted</th>
              <th>Gap / week</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ subject, subjectHours, effectiveHours, predicted, delta, target, onTrack, hoursPerWeekGap }) => (
              <tr key={subject.id}>
                <td>
                  <span
                    className="grade-predictor__colour-swatch"
                    style={{ background: subject.colour }}
                  />
                  {subject.name}
                </td>
                <td className="grade-predictor__grade-cell">{subject.currentGrade}</td>
                <td className="grade-predictor__grade-cell grade-predictor__grade-cell--target">{target}</td>
                <td>
                  <span className={`grade-predictor__difficulty grade-predictor__difficulty--${subject.difficulty ?? 'medium'}`}>
                    {(subject.difficulty ?? 'medium')[0].toUpperCase() + (subject.difficulty ?? 'medium').slice(1)}
                  </span>
                </td>
                <td>{subjectHours.toFixed(1)}</td>
                <td>{effectiveHours.toFixed(1)}</td>
                <td>
                  <span
                    className={`grade-predictor__predicted ${
                      delta > 0
                        ? 'grade-predictor__predicted--up'
                        : delta < 0
                          ? 'grade-predictor__predicted--down'
                          : 'grade-predictor__predicted--same'
                    }`}
                  >
                    {predicted}
                    {delta > 0 ? ' ▲' : delta < 0 ? ' ▼' : ' —'}
                  </span>
                </td>
                <td>
                  {onTrack ? (
                    <span className="grade-predictor__gap grade-predictor__gap--ok">on track ✓</span>
                  ) : (
                    <span className="grade-predictor__gap grade-predictor__gap--under">
                      +{hoursPerWeekGap.toFixed(1)} h/wk ▲
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="grade-predictor__weeks-note">
          Based on <strong>{totalWeeks}</strong> total{' '}
          {totalWeeks === 1 ? 'week' : 'weeks'} of study
        </p>
      </div>

      {/* ── Model note ─────────────────────────────────────────────────────── */}
      <p className="grade-predictor__model-note">
        Grade improvements follow a logarithmic curve — early study hours have the most
        impact. Below 1.5h/week per subject, grades may decline. Work/life balance
        affects efficiency (optimal: ~35% recreational time).
      </p>
    </section>
  )
}
