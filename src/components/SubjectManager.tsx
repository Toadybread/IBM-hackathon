import { useState } from 'react'
import './SubjectManager.css'
import type { Subject, UKGrade, SubjectDifficulty, SubjectPriority, GradeSnapshot } from '../types'

const UK_GRADES: UKGrade[] = ['A*', 'A', 'B', 'C', 'D', 'E', 'U']

const PRESET_COLOURS = [
  '#16A085', '#8E44AD', '#2980B9', '#D35400', '#27AE60',
  '#C0392B', '#1ABC9C', '#F39C12', '#2C3E50', '#7F8C8D',
]

function randomPresetColour(): string {
  return PRESET_COLOURS[Math.floor(Math.random() * PRESET_COLOURS.length)]
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export interface SubjectManagerProps {
  subjects: Subject[]
  onSubjectsChange: (subjects: Subject[]) => void
}

export default function SubjectManager({ subjects, onSubjectsChange }: SubjectManagerProps) {
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  // Per-subject add-snapshot form state
  const [snapshotForms, setSnapshotForms] = useState<Record<string, { date: string; grade: UKGrade; note: string }>>({})

  function handleNameChange(id: string, name: string) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, name } : s))
  }

  function handleGradeChange(id: string, grade: UKGrade) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, currentGrade: grade } : s))
  }

  function handleTargetGradeChange(id: string, grade: UKGrade) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, targetGrade: grade } : s))
  }

  function toggleHistory(id: string) {
    setExpandedHistory(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getSnapshotForm(id: string) {
    return snapshotForms[id] ?? { date: todayISO(), grade: 'C' as UKGrade, note: '' }
  }

  function setSnapshotForm(id: string, patch: Partial<{ date: string; grade: UKGrade; note: string }>) {
    setSnapshotForms(prev => ({ ...prev, [id]: { ...getSnapshotForm(id), ...patch } }))
  }

  function handleAddSnapshot(subjectId: string) {
    const form = getSnapshotForm(subjectId)
    if (!form.date || !form.grade) return
    const snapshot: GradeSnapshot = {
      id: crypto.randomUUID(),
      date: form.date,
      grade: form.grade,
      note: form.note || undefined,
    }
    onSubjectsChange(subjects.map(s =>
      s.id === subjectId
        ? { ...s, gradeHistory: [snapshot, ...(s.gradeHistory ?? [])] }
        : s
    ))
    // Reset form date but keep grade for convenience
    setSnapshotForm(subjectId, { date: todayISO(), note: '' })
  }

  function handleDeleteSnapshot(subjectId: string, snapshotId: string) {
    onSubjectsChange(subjects.map(s =>
      s.id === subjectId
        ? { ...s, gradeHistory: (s.gradeHistory ?? []).filter(sn => sn.id !== snapshotId) }
        : s
    ))
  }

  function handleDifficultyChange(id: string, difficulty: SubjectDifficulty) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, difficulty } : s))
  }

  function handlePriorityChange(id: string, priority: SubjectPriority) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, priority } : s))
  }

  function handleColourChange(id: string, colour: string) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, colour } : s))
  }

  function handleDelete(id: string) {
    onSubjectsChange(subjects.filter(s => s.id !== id))
  }

  function handleAdd() {
    const newSubject: Subject = {
      id: crypto.randomUUID(),
      name: 'New Subject',
      colour: randomPresetColour(),
      currentGrade: 'C',
    }
    onSubjectsChange([...subjects, newSubject])
  }

  return (
    <div className="subject-manager">
      <h2 className="subject-manager__title">Subjects &amp; Grades</h2>
      <p className="subject-manager__hint">
        Add your subjects, set your current and target grades, and assign a colour for the timetable.
      </p>

      {subjects.length === 0 && (
        <p className="subject-manager__empty">No subjects yet. Add one below.</p>
      )}

      <div className="subject-manager__list">
        {subjects.map(subject => (
          <div key={subject.id} className="sm-card">
          <div className="sm-row">
            {/* Top line: swatch + name + grade selects */}
            <div className="sm-row__top">
              <span
                className="sm-swatch"
                style={{ background: subject.colour }}
              />
              <input
                type="text"
                className="sm-name-input"
                value={subject.name}
                placeholder="Subject name"
                onChange={e => handleNameChange(subject.id, e.target.value)}
              />
              <label className="sm-grade-label">
                <span className="sm-grade-label__text">Current</span>
                <select
                  className="sm-grade-select"
                  value={subject.currentGrade}
                  onChange={e => handleGradeChange(subject.id, e.target.value as UKGrade)}
                >
                  {UK_GRADES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
              <label className="sm-grade-label">
                <span className="sm-grade-label__text">Target</span>
                <select
                  className="sm-grade-select sm-grade-select--target"
                  value={subject.targetGrade ?? subject.currentGrade}
                  onChange={e => handleTargetGradeChange(subject.id, e.target.value as UKGrade)}
                >
                  {UK_GRADES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Bottom line: difficulty, priority, colour, delete, history */}
            <div className="sm-row__bottom">
              <div className="sm-difficulty" role="group" aria-label="Difficulty">
                {(['easy', 'medium', 'hard'] as SubjectDifficulty[]).map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`sm-difficulty__btn sm-difficulty__btn--${d}${(subject.difficulty ?? 'medium') === d ? ' sm-difficulty__btn--active' : ''}`}
                    onClick={() => handleDifficultyChange(subject.id, d)}
                    title={`Difficulty: ${d}`}
                  >
                    {d[0].toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
              <div className="sm-priority" role="group" aria-label="Optimiser priority">
                {([1, 2, 3] as SubjectPriority[]).map(p => {
                  const label = p === 1 ? 'Low' : p === 2 ? 'Normal' : 'High'
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`sm-priority__btn sm-priority__btn--${p}${(subject.priority ?? 2) === p ? ' sm-priority__btn--active' : ''}`}
                      onClick={() => handlePriorityChange(subject.id, p)}
                      title={`Optimiser priority: ${label}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <label className="sm-colour-label" title="Change colour">
                <span className="sm-colour-label__text">Colour</span>
                <input
                  type="color"
                  className="sm-colour-input"
                  value={subject.colour}
                  onChange={e => handleColourChange(subject.id, e.target.value)}
                />
              </label>
              <button
                className="sm-delete-btn"
                title="Delete subject"
                onClick={() => handleDelete(subject.id)}
              >
                🗑 Delete
              </button>
              <button
                className="sm-history-toggle"
                onClick={() => toggleHistory(subject.id)}
                title="Grade history"
              >
                {expandedHistory.has(subject.id) ? '▾ History' : '▸ History'}
                {(subject.gradeHistory?.length ?? 0) > 0 && (
                  <span className="sm-history-count">{subject.gradeHistory!.length}</span>
                )}
              </button>
            </div>
          </div>

          {/* ── History section ──────────────────────────────────────────── */}
          {expandedHistory.has(subject.id) && (
            <div className="sm-history">
              {(subject.gradeHistory ?? []).length === 0 && (
                <p className="sm-history__empty">No snapshots yet.</p>
              )}
              {[...(subject.gradeHistory ?? [])].sort((a, b) => b.date.localeCompare(a.date)).map(sn => (
                <div key={sn.id} className="sm-snapshot">
                  <span className="sm-snapshot__date">{sn.date}</span>
                  <span className={`sm-snapshot__grade sm-snapshot__grade--${sn.grade.replace('*','star')}`}>{sn.grade}</span>
                  {sn.note && <span className="sm-snapshot__note">{sn.note}</span>}
                  <button
                    className="sm-snapshot__delete"
                    onClick={() => handleDeleteSnapshot(subject.id, sn.id)}
                    title="Delete snapshot"
                  >✕</button>
                </div>
              ))}

              {/* Add form */}
              <div className="sm-history__add-form">
                <input
                  type="date"
                  className="sm-history__date-input"
                  value={getSnapshotForm(subject.id).date}
                  onChange={e => setSnapshotForm(subject.id, { date: e.target.value })}
                />
                <select
                  className="sm-grade-select"
                  value={getSnapshotForm(subject.id).grade}
                  onChange={e => setSnapshotForm(subject.id, { grade: e.target.value as UKGrade })}
                >
                  {UK_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input
                  type="text"
                  className="sm-history__note-input"
                  placeholder="Note (optional)"
                  value={getSnapshotForm(subject.id).note}
                  onChange={e => setSnapshotForm(subject.id, { note: e.target.value })}
                />
                <button className="sm-history__add-btn" onClick={() => handleAddSnapshot(subject.id)}>
                  + Add
                </button>
              </div>
            </div>
          )}
          </div>
        ))}
      </div>

      <button className="sm-add-btn" onClick={handleAdd}>
        ＋ Add Subject
      </button>
    </div>
  )
}
