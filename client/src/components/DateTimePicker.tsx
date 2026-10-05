import { useEffect, useMemo, useState } from 'react'
import { api, type Slot } from '../lib/api'
import { capitalize, formatDateKey, todayKey } from '../lib/format'

interface Props {
  serviceId?: string
  bookingWindowDays: number
  selectedStart: string | null
  onSelect: (slot: Slot | null) => void
  /** Se incrementa para volver a pedir la disponibilidad (por ejemplo, después de un error 409). */
  refreshKey?: number
}

const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']
const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

const pad = (n: number) => String(n).padStart(2, '0')
const monthKey = (y: number, m: number) => `${y}-${pad(m)}`

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1)
}

function addDays(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function DateTimePicker({ serviceId, bookingWindowDays, selectedStart, onSelect, refreshKey = 0 }: Props) {
  const today = todayKey()
  const lastDay = addDays(today, bookingWindowDays)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [day, setDay] = useState(today)
  const [days, setDays] = useState<Record<string, boolean>>({})
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .month(month, serviceId)
      .then((r) => {
        if (cancelled) return
        setDays(r.days)
        setError('')
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [month, serviceId, refreshKey])

  useEffect(() => {
    if (!serviceId) return
    let cancelled = false
    api
      .day(day, serviceId)
      .then((r) => {
        if (cancelled) return
        setSlots(r.slots)
        setError('')
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [day, serviceId, refreshKey])

  // Si cambian los horarios y el elegido ya no está libre, se deselecciona.
  useEffect(() => {
    if (selectedStart && slots && !slots.some((s) => s.start === selectedStart && s.available)) onSelect(null)
  }, [slots, selectedStart, onSelect])

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = new Date(Date.UTC(y, m - 1, 1))
    const offset = (first.getUTCDay() + 6) % 7 // lunes = 0
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`),
    ]
  }, [month])

  const [y, m] = month.split('-').map(Number)
  const canPrev = month > today.slice(0, 7)
  const canNext = shiftMonth(month, 1) <= lastDay.slice(0, 7)
  const free = slots?.filter((s) => s.available).length ?? 0

  return (
    <div className="picker">
      <div className="calendar card">
        <div className="calendar-head">
          <span className="calendar-title">{capitalize(monthName.format(new Date(Date.UTC(y, m - 1, 1))).replace(' de ', ' '))}</span>
          <div className="calendar-nav">
            <button type="button" className="icon-btn" aria-label="Mes anterior" disabled={!canPrev} onClick={() => setMonth(shiftMonth(month, -1))}>
              ‹
            </button>
            <button type="button" className="icon-btn" aria-label="Mes siguiente" disabled={!canNext} onClick={() => setMonth(shiftMonth(month, 1))}>
              ›
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="weekday">
              {w}
            </span>
          ))}
          {cells.map((key, i) => {
            if (!key) return <span key={`e${i}`} />
            const outOfRange = key < today || key > lastDay
            const hasSlots = !outOfRange && days[key]
            const label = `${formatDateKey(key)}${hasSlots ? '' : ', sin horarios'}`
            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={key === day}
                className={`day${key === day ? ' selected' : ''}${hasSlots ? ' has-slots' : ''}`}
                disabled={outOfRange}
                onClick={() => {
                  setDay(key)
                  onSelect(null)
                }}
              >
                {Number(key.slice(8))}
              </button>
            )
          })}
        </div>
        <p className="hint">
          <span className="dot" /> Los días con punto tienen horarios libres
        </p>
      </div>

      <div className="slots">
        <h3 className="slots-title">{capitalize(formatDateKey(day))}</h3>
        {error && <p className="error">{error}</p>}
        {!serviceId ? (
          <p className="muted">Elegí un servicio para ver los horarios de ese día.</p>
        ) : slots === null ? (
          <p className="muted">Cargando horarios…</p>
        ) : slots.length === 0 ? (
          <p className="muted">Ese día no atendemos. Probá con otro.</p>
        ) : (
          <>
            <div className="slot-grid">
              {slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  className={`slot${s.start === selectedStart ? ' selected' : ''}`}
                  disabled={!s.available}
                  aria-label={s.available ? s.time : `${s.time}, ocupado`}
                  aria-pressed={s.start === selectedStart}
                  onClick={() => onSelect(s)}
                >
                  {s.time}
                </button>
              ))}
            </div>
            <p className="hint">
              {free === 0 ? 'No quedan horarios libres este día.' : `${free} horarios libres`} · los tachados ya están ocupados
            </p>
          </>
        )}
      </div>
    </div>
  )
}
