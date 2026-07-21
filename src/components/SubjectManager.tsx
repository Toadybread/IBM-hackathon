import './SubjectManager.css'
import type { Subject, UKGrade } from '../types'

const UK_GRADES: UKGrade[] = ['A*', 'A', 'B', 'C', 'D', 'E', 'U']

const PRESET_COLOURS = [
  '#16A085', '#8E44AD', '#2980B9', '#D35400', '#27AE60',
  '#C0392B', '#1ABC9C', '#F39C12', '#2C3E50', '#7F8C8D',
]

function randomPresetColour(): string {
  return PRESET_COLOURS[Math.floor(Math.random() * PRESET_COLOURS.length)]
}

export interface SubjectManagerProps {
  subjects: Subject[]
  onSubjectsChange: (subjects: Subject[]) => void
}

export default function SubjectManager({ subjects, onSubjectsChange }: SubjectManagerProps) {

  function handleNameChange(id: string, name: string) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, name } : s))
  }

  function handleGradeChange(id: string, grade: UKGrade) {
    onSubjectsChange(subjects.map(s => s.id === id ? { ...s, currentGrade: grade } : s))
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
        Add your subjects, set your current grade, and assign a colour for the timetable.
      </p>

      {subjects.length === 0 && (
        <p className="subject-manager__empty">No subjects yet. Add one below.</p>
      )}

      <div className="subject-manager__list">
        {subjects.map(subject => (
          <div key={subject.id} className="sm-row">
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
              <span className="sm-grade-label__text">Grade</span>
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
          </div>
        ))}
      </div>

      <button className="sm-add-btn" onClick={handleAdd}>
        ＋ Add Subject
      </button>
    </div>
  )
}
