import { useState, useRef } from 'react'
import type { NamedTimetable, WeekPeriod } from '../types'
import { createEmptyTimetable } from '../types'
import './TimetableManager.css'

interface TimetableManagerProps {
  timetables: Record<string, NamedTimetable>
  onTimetablesChange: (t: Record<string, NamedTimetable>) => void
  activeTimetableId: string
  onActiveTimetableChange: (id: string) => void
  weekPlan: WeekPeriod[]
  onWeekPlanChange: (plan: WeekPeriod[]) => void
}

export default function TimetableManager({
  timetables,
  onTimetablesChange,
  activeTimetableId,
  onActiveTimetableChange,
  weekPlan,
  onWeekPlanChange,
}: TimetableManagerProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const list = Object.values(timetables)

  function handleAdd() {
    const id = crypto.randomUUID()
    const name = 'New Timetable'
    onTimetablesChange({
      ...timetables,
      [id]: { id, name, timetable: createEmptyTimetable() },
    })
    onActiveTimetableChange(id)
  }

  function handleStartRename(id: string, currentName: string) {
    setRenamingId(id)
    setRenameValue(currentName)
  }

  function handleCommitRename(id: string) {
    const trimmed = renameValue.trim()
    if (trimmed) {
      onTimetablesChange({
        ...timetables,
        [id]: { ...timetables[id], name: trimmed },
      })
    }
    setRenamingId(null)
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  function handleExport(nt: NamedTimetable) {
    const payload = JSON.stringify(nt, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nt.name.replace(/[^a-z0-9]/gi, '_')}_timetable.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  const importInputRef = useRef<HTMLInputElement>(null)

  function handleImportClick() {
    importInputRef.current?.click()
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as NamedTimetable
        // Basic validation
        if (
          typeof parsed.name !== 'string' ||
          typeof parsed.timetable !== 'object' ||
          typeof parsed.timetable.days !== 'object'
        ) {
          alert('Invalid timetable file.')
          return
        }
        // Assign a fresh ID to avoid collisions
        const newId = crypto.randomUUID()
        const imported: NamedTimetable = {
          id: newId,
          name: parsed.name,
          timetable: parsed.timetable,
        }
        onTimetablesChange({ ...timetables, [newId]: imported })
        onActiveTimetableChange(newId)
      } catch {
        alert('Could not read file — make sure it is a valid timetable export.')
      }
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-imported
    e.target.value = ''
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function handleDelete(id: string) {
    const usedByPeriods = weekPlan.filter(p => p.timetableId === id)
    if (usedByPeriods.length > 0) {
      const ok = window.confirm(
        `"${timetables[id]?.name}" is used in ${usedByPeriods.length} week plan period${usedByPeriods.length > 1 ? 's' : ''}. Deleting it will remove those periods. Continue?`,
      )
      if (!ok) return
      onWeekPlanChange(weekPlan.filter(p => p.timetableId !== id))
    }

    const next = { ...timetables }
    delete next[id]
    onTimetablesChange(next)

    // If we deleted the active one, switch to first remaining
    if (activeTimetableId === id) {
      const firstRemaining = Object.keys(next)[0]
      if (firstRemaining) onActiveTimetableChange(firstRemaining)
    }
  }

  return (
    <div className="ttm">
      <div className="ttm__chips">
        {list.map(nt => (
          <div
            key={nt.id}
            className={`ttm__chip${nt.id === activeTimetableId ? ' ttm__chip--active' : ''}`}
            onClick={() => {
              if (renamingId !== nt.id) onActiveTimetableChange(nt.id)
            }}
          >
            {renamingId === nt.id ? (
              <input
                className="ttm__rename-input"
                value={renameValue}
                autoFocus
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => handleCommitRename(nt.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCommitRename(nt.id)
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="ttm__chip-name">{nt.name}</span>
            )}

            <button
              className="ttm__icon-btn"
              title="Rename"
              onClick={e => { e.stopPropagation(); handleStartRename(nt.id, nt.name) }}
              aria-label={`Rename ${nt.name}`}
            >
              ✏
            </button>
            <button
              className="ttm__icon-btn"
              title="Export"
              onClick={e => { e.stopPropagation(); handleExport(nt) }}
              aria-label={`Export ${nt.name}`}
            >
              ↓
            </button>
            {list.length > 1 && (
              <button
                className="ttm__icon-btn ttm__icon-btn--delete"
                title="Delete"
                onClick={e => { e.stopPropagation(); handleDelete(nt.id) }}
                aria-label={`Delete ${nt.name}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button className="ttm__add-btn" onClick={handleAdd} title="Add timetable">
          ＋ Add
        </button>

        <button className="ttm__import-btn" onClick={handleImportClick} title="Import timetable from file">
          ↑ Import
        </button>
        {/* Hidden file input */}
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>
    </div>
  )
}
