import './ActivityPalette.css'
import type { FixedActivity, Subject, UKGrade } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const FIXED_ACTIVITIES: { id: FixedActivity; label: string }[] = [
  { id: 'school', label: 'School' },
  { id: 'work',   label: 'Work'   },
  { id: 'rest',   label: 'Rest'   },
  { id: 'free',   label: 'Free'   },
  { id: 'fun',    label: 'Fun'    },
]

export const DEFAULT_FIXED_COLOURS: Record<FixedActivity, string> = {
  school: '#4A90D9',
  work:   '#E8A838',
  rest:   '#7ED321',
  free:   '#9B59B6',
  fun:    '#E74C3C',
}

const UK_GRADES: UKGrade[] = ['A*', 'A', 'B', 'C', 'D', 'E', 'U']

/** Small preset palette for new-subject colours */
const PRESET_COLOURS = [
  '#16A085', '#8E44AD', '#2980B9', '#D35400', '#27AE60',
  '#C0392B', '#1ABC9C', '#F39C12', '#2C3E50', '#7F8C8D',
]

function randomPresetColour(): string {
  return PRESET_COLOURS[Math.floor(Math.random() * PRESET_COLOURS.length)]
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ActivityPaletteProps {
  /** The currently armed activity id ('school', 'work', … or 'study-{id}'), or null for eraser */
  selectedActivity: string | null
  onSelectActivity: (activity: string | null) => void

  subjects: Subject[]
  onSubjectsChange: (subjects: Subject[]) => void

  fixedColours: Record<FixedActivity, string>
  onFixedColoursChange: (colours: Record<FixedActivity, string>) => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ActivityPalette({
  selectedActivity,
  onSelectActivity,
  subjects,
  onSubjectsChange,
  fixedColours,
  onFixedColoursChange,
}: ActivityPaletteProps) {

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleFixedColourChange(id: FixedActivity, colour: string) {
    onFixedColoursChange({ ...fixedColours, [id]: colour })
  }

  function handleSubjectNameChange(id: string, name: string) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, name } : s))
  }

  function handleSubjectGradeChange(id: string, grade: UKGrade) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, currentGrade: grade } : s))
  }

  function handleSubjectColourChange(id: string, colour: string) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, colour } : s))
  }

  function handleSubjectDelete(id: string) {
    onSubjectsChange(subjects.filter(s => s.id !== id))
    // If the deleted subject was selected, deselect
    if (selectedActivity === `study-${id}`) {
      onSelectActivity(null)
    }
  }

  function handleAddSubject() {
    const newSubject: Subject = {
      id: crypto.randomUUID(),
      name: 'New Subject',
      colour: randomPresetColour(),
      currentGrade: 'C',
    }
    onSubjectsChange([...subjects, newSubject])
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="palette">

      {/* ── Eraser ────────────────────────────────────────────────────────── */}
      <div
        className={`palette-row${selectedActivity === null ? ' palette-row--selected' : ''}`}
        onClick={() => onSelectActivity(null)}
        title="Eraser — clears slots"
      >
        <span className="palette-label" style={{ fontStyle: 'italic' }}>✕ Eraser</span>
      </div>

      {/* ── Fixed activities ──────────────────────────────────────────────── */}
      <div className="palette__heading">Activities</div>

      {FIXED_ACTIVITIES.map(({ id, label }) => {
        const colour = fixedColours[id] ?? DEFAULT_FIXED_COLOURS[id]
        const isSelected = selectedActivity === id
        return (
          <div
            key={id}
            className={`palette-row${isSelected ? ' palette-row--selected' : ''}`}
            onClick={() => onSelectActivity(id)}
          >
            <span className="palette-swatch" style={{ background: colour }} />
            <span className="palette-label">{label}</span>
            <input
              type="color"
              className="palette-colour-input"
              value={colour}
              title={`Change ${label} colour`}
              onClick={e => e.stopPropagation()}
              onChange={e => handleFixedColourChange(id, e.target.value)}
            />
          </div>
        )
      })}

      {/* ── Subject study activities ───────────────────────────────────────── */}
      <div className="palette__heading">Subjects</div>

      {subjects.map(subject => {
        const activityId = `study-${subject.id}`
        const isSelected = selectedActivity === activityId
        return (
          <div
            key={subject.id}
            className={`palette-row${isSelected ? ' palette-row--selected' : ''}`}
            onClick={() => onSelectActivity(activityId)}
          >
            <span className="palette-swatch" style={{ background: subject.colour }} />
            <input
              type="text"
              className="palette-name-input"
              value={subject.name}
              title="Subject name"
              onClick={e => e.stopPropagation()}
              onChange={e => handleSubjectNameChange(subject.id, e.target.value)}
            />
            <select
              className="palette-grade-select"
              value={subject.currentGrade}
              title="Current grade"
              onClick={e => e.stopPropagation()}
              onChange={e => handleSubjectGradeChange(subject.id, e.target.value as UKGrade)}
            >
              {UK_GRADES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <input
              type="color"
              className="palette-colour-input"
              value={subject.colour}
              title="Change subject colour"
              onClick={e => e.stopPropagation()}
              onChange={e => handleSubjectColourChange(subject.id, e.target.value)}
            />
            <button
              className="palette-delete-btn"
              title="Delete subject"
              onClick={e => { e.stopPropagation(); handleSubjectDelete(subject.id) }}
            >
              🗑
            </button>
          </div>
        )
      })}

      <button className="palette-add-btn" onClick={handleAddSubject}>
        ＋ Add Subject
      </button>
    </div>
  )
}
