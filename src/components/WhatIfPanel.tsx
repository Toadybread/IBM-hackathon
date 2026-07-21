import { useState } from 'react'
import type { Subject } from '../types'
import { predictGrade, computeBalanceStats } from '../utils/gradePredictor'
import type { HourTotals } from '../utils/timetableUtils'
import './WhatIfPanel.css'

interface WhatIfPanelProps {
  subjects: Subject[]
  totals: HourTotals
  totalWeeks: number
}

export default function WhatIfPanel({ subjects, totals, totalWeeks }: WhatIfPanelProps) {
  const [open, setOpen] = useState(false)
  const [offsets, setOffsets] = useState<Record<string, number>>({})

  const notReady = subjects.length === 0 || totalWeeks === 0
  const { efficiency } = computeBalanceStats(totals)

  function getOffset(id: string) {
    return offsets[id] ?? 0
  }

  function handleReset() {
    setOffsets({})
  }

  return (
    <section className="wip">
      <button
        className="wip__toggle"
        onClick={() => !notReady && setOpen(o => !o)}
        aria-expanded={open}
        style={notReady ? { cursor: 'default', opacity: 0.6 } : undefined}
        title={notReady ? 'Add subjects and a study plan to use the simulator' : undefined}
      >
        <span className="wip__toggle-icon">{open && !notReady ? '▾' : '▸'}</span>
        What-if Simulator
        <span className="wip__toggle-hint">
          {notReady ? 'Add subjects + a study plan to enable' : 'Explore how more study changes your grades'}
        </span>
      </button>

      {open && !notReady && (
        <div className="wip__body">
          <table className="wip__table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Extra hrs / wk</th>
                <th>Actual Predicted</th>
                <th>What-if Predicted</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(subject => {
                const diff = subject.difficulty ?? 'medium'
                const actualHours = totals[`study-${subject.id}`] ?? 0
                const offset = getOffset(subject.id)
                const whatIfHoursPerWeek = Math.max(0, (actualHours / Math.max(totalWeeks, 1)) + offset)
                const whatIfTotal = whatIfHoursPerWeek * totalWeeks

                const actualPredicted = predictGrade(subject.currentGrade, actualHours, efficiency, totalWeeks, diff)
                const whatIfPredicted = predictGrade(subject.currentGrade, whatIfTotal, efficiency, totalWeeks, diff)

                const actualUp = actualPredicted !== subject.currentGrade
                const changed = whatIfPredicted !== actualPredicted

                return (
                  <tr key={subject.id}>
                    <td>
                      <span className="wip__swatch" style={{ background: subject.colour }} />
                      {subject.name}
                    </td>
                    <td className="wip__slider-cell">
                      <input
                        type="range"
                        className="wip__slider"
                        min={-5}
                        max={10}
                        step={0.5}
                        value={offset}
                        onChange={e => setOffsets(prev => ({ ...prev, [subject.id]: Number(e.target.value) }))}
                      />
                      <span className="wip__offset-label">
                        {offset >= 0 ? `+${offset}` : offset} h/wk
                      </span>
                    </td>
                    <td>
                      <span className={`wip__grade wip__grade--${actualUp ? 'up' : 'same'}`}>
                        {actualPredicted}
                      </span>
                    </td>
                    <td>
                      <span className={`wip__grade wip__grade--${changed ? (whatIfPredicted > actualPredicted ? 'up' : 'down') : 'same'}`}>
                        {whatIfPredicted}
                        {changed && whatIfPredicted > actualPredicted ? ' ▲' : changed ? ' ▼' : ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <button className="wip__reset" onClick={handleReset}>
            Reset all sliders
          </button>
        </div>
      )}
    </section>
  )
}
