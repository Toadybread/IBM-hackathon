import { useState } from 'react'
import './SetupModal.css'

interface SetupModalProps {
  onConfirm: (startHour: number, endHour: number) => void
  /** Pre-populated values when re-opening from settings (optional) */
  initialStart?: number
  initialEnd?: number
}

/** Build the array [0, 1, …, 23] for the hour dropdowns */
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export default function SetupModal({
  onConfirm,
  initialStart = 8,
  initialEnd = 22,
}: SetupModalProps) {
  const [startHour, setStartHour] = useState<number>(initialStart)
  const [endHour, setEndHour] = useState<number>(initialEnd)

  const isInvalid = endHour <= startHour

  function handleConfirm() {
    if (isInvalid) return
    onConfirm(startHour, endHour)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" className="modal-title">
          Welcome! Let&rsquo;s set up your timetable
        </h2>
        <p className="modal-subtitle">
          Choose the hours your daily timetable should cover.
        </p>

        <div className="modal-fields">
          <label className="modal-label" htmlFor="start-hour">
            Start Time
          </label>
          <select
            id="start-hour"
            className="modal-select"
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>

          <label className="modal-label" htmlFor="end-hour">
            End Time
          </label>
          <select
            id="end-hour"
            className="modal-select"
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>

        {isInvalid && (
          <p className="modal-error" role="alert">
            End time must be after start time.
          </p>
        )}

        <button
          className="modal-confirm-btn"
          onClick={handleConfirm}
          disabled={isInvalid}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
