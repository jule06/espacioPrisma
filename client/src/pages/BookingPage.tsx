import { useState } from 'react'
import { DateTimePicker } from '../components/DateTimePicker'
import { api, ApiError, type BusinessInfo, type Slot } from '../lib/api'
import { formatRange, initials, money } from '../lib/format'

interface Props {
  business: BusinessInfo
  /** Servicio elegido desde la landing. */
  initialServiceId?: string
  onBooked: (code: string) => void
  onLookup: (code: string) => void
}

export function BookingPage({ business, initialServiceId, onBooked, onLookup }: Props) {
  const [serviceId, setServiceId] = useState<string | undefined>(() =>
    business.services.some((s) => s.id === initialServiceId) ? initialServiceId : undefined,
  )
  const [slot, setSlot] = useState<Slot | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showLookup, setShowLookup] = useState(false)
  const service = business.services.find((s) => s.id === serviceId)

  return (
    <>
      <header className="hero">
        <span className="script">Reservá tu turno</span>
        <h1>{business.name}</h1>
        <p className="muted">
          {[business.address, business.hoursLabel].filter(Boolean).join(' · ')}
        </p>
        {showLookup ? (
          <LookupForm onLookup={onLookup} onClose={() => setShowLookup(false)} />
        ) : (
          <button className="link-btn" onClick={() => setShowLookup(true)}>
            ¿Ya reservaste? Mirá tu turno con el código
          </button>
        )}
      </header>

      <div className="layout">
        <div className="column">
          <section>
            <h2>{business.professionals.length === 1 ? 'Quién te atiende' : 'Quiénes te atienden'}</h2>
            <div className="pros">
              {business.professionals.map((p) => (
                <div key={p.id} className="pro card">
                  <span className="avatar">{initials(p.name)}</span>
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted small">{p.role}</span>
                  </div>
                </div>
              ))}
            </div>
            {business.professionals.length > 1 && (
              <p className="hint">El sistema te asigna a quien esté libre en el horario que elijas.</p>
            )}
          </section>

          <section>
            <h2>Elegí el servicio</h2>
            <ul className="services" role="listbox" aria-label="Servicios">
              {business.services.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s.id === serviceId}
                    className={`service${s.id === serviceId ? ' selected' : ''}`}
                    onClick={() => {
                      setServiceId(s.id)
                      setSlot(null)
                    }}
                  >
                    <span>
                      <strong>{s.name}</strong>
                      {s.description && <span className="description small">{s.description}</span>}
                      <span className="muted small">
                        {s.durationMinutes} min · seña {money(s.deposit)}
                      </span>
                    </span>
                    <span className="price">{money(s.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="hint">
              El turno se reserva con una seña del {business.depositPercent}% por transferencia, que se descuenta del total. La
              seña no se reintegra, pero podés cambiar el día u horario sin costo hasta {business.changeLimitHours} horas antes.
            </p>
          </section>
        </div>

        <div className="column">
          <section>
            <h2>Elegí el día y la hora</h2>
            <DateTimePicker
              serviceId={serviceId}
              bookingWindowDays={business.bookingWindowDays}
              selectedStart={slot?.start ?? null}
              onSelect={setSlot}
              refreshKey={refreshKey}
            />
          </section>

          {service && slot && (
            <CustomerForm
              key={slot.start}
              serviceId={service.id}
              summary={`${formatRange(slot.start, new Date(new Date(slot.start).getTime() + service.durationMinutes * 60000).toISOString())} · ${money(service.price)}`}
              serviceName={service.name}
              deposit={service.deposit}
              start={slot.start}
              onBooked={onBooked}
              onConflict={() => {
                setSlot(null)
                setRefreshKey((k) => k + 1)
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}

function CustomerForm(props: {
  serviceId: string
  serviceName: string
  summary: string
  deposit: number
  start: string
  onBooked: (code: string) => void
  onConflict: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const booking = await api.createBooking({ serviceId: props.serviceId, start: props.start, name, phone, email })
      props.onBooked(booking.code)
    } catch (err) {
      setError((err as Error).message)
      if ((err as ApiError).status === 409) props.onConflict()
      setBusy(false)
    }
  }

  return (
    <form className="customer card" onSubmit={submit}>
      <h2>Tus datos</h2>
      <p className="summary">
        <strong>{props.serviceName}</strong>
        <span className="muted small">{props.summary}</span>
      </p>
      <label>
        Nombre y apellido
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={3} />
      </label>
      <label>
        Teléfono
        <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" required />
      </label>
      <label>
        <span>
          Correo <span className="muted">· opcional</span>
        </span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <span className="hint">Si lo dejás, te llegan la confirmación y un recordatorio el día anterior.</span>
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={busy}>
        {busy ? 'Reservando…' : `Reservar con seña de ${money(props.deposit)}`}
      </button>
    </form>
  )
}

function LookupForm({ onLookup, onClose }: { onLookup: (code: string) => void; onClose: () => void }) {
  const [code, setCode] = useState('')
  return (
    <form
      className="lookup"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) onLookup(code.trim().toUpperCase())
      }}
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Código de tu turno"
        aria-label="Código de tu turno"
        maxLength={10}
        autoFocus
      />
      <button className="btn primary small">Ver turno</button>
      <button type="button" className="btn ghost small" onClick={onClose}>
        Cerrar
      </button>
    </form>
  )
}
