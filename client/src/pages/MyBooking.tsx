import { useCallback, useEffect, useState } from 'react'
import { DateTimePicker } from '../components/DateTimePicker'
import { api, ApiError, type BusinessInfo, type PublicBooking, type Slot } from '../lib/api'
import { capitalize, formatRange, formatTime, money } from '../lib/format'

interface Props {
  business: BusinessInfo
  code: string
  onExit: () => void
}

const STATUS: Record<PublicBooking['status'], { label: string; tone: string; text: string }> = {
  awaiting_receipt: {
    label: 'Falta la seña',
    tone: 'warn',
    text: 'Transferí la seña y subí el comprobante para reservar el horario.',
  },
  awaiting_approval: {
    label: 'Seña en revisión',
    tone: 'info',
    text: 'Recibimos tu comprobante. Te avisamos apenas el local confirme la seña.',
  },
  confirmed: { label: 'Confirmado', tone: 'ok', text: '¡Te esperamos!' },
  rejected: { label: 'Seña rechazada', tone: 'bad', text: 'El local no pudo confirmar la seña de este turno.' },
  cancelled: { label: 'Cancelado', tone: 'bad', text: 'Este turno fue cancelado.' },
  expired: {
    label: 'Vencido',
    tone: 'bad',
    text: 'No recibimos el comprobante a tiempo y el horario se liberó. Podés reservar de nuevo.',
  },
}

export function MyBooking({ business, code, onExit }: Props) {
  const [booking, setBooking] = useState<PublicBooking | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view')

  useEffect(() => {
    let cancelled = false
    api
      .getBooking(code)
      .then((b) => !cancelled && setBooking(b))
      .catch((e: ApiError) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [code])

  if (error && !booking) {
    return (
      <section className="panel narrow">
        <h2>No encontramos tu turno</h2>
        <p className="muted">{error} Revisá que el código esté bien escrito.</p>
        <button className="btn secondary" onClick={onExit}>
          Volver
        </button>
      </section>
    )
  }
  if (!booking) return <p className="muted center">Cargando tu turno…</p>

  const status = STATUS[booking.status]

  return (
    <section className="panel narrow">
      <div className="booking-head">
        <div>
          <p className="eyebrow">Tu turno</p>
          <h2>{booking.serviceName}</h2>
        </div>
        <span className={`badge ${status.tone}`}>{status.label}</span>
      </div>

      <div className="code-box">
        <span className="muted small">Código de tu turno</span>
        <strong>{booking.code}</strong>
        <span className="muted small">Guardalo: con este código ves, cambiás o cancelás tu turno.</span>
      </div>

      <dl className="details">
        <div>
          <dt>Día y hora</dt>
          <dd>{capitalize(formatRange(booking.start, booking.end))}</dd>
        </div>
        {booking.professional && (
          <div>
            <dt>Te atiende</dt>
            <dd>
              {booking.professional.name} · {booking.professional.role}
            </dd>
          </div>
        )}
        <div>
          <dt>Total</dt>
          <dd>
            {money(booking.price)} <span className="muted">· seña {money(booking.deposit)}</span>
          </dd>
        </div>
        {business.address && (
          <div>
            <dt>Dónde</dt>
            <dd>{business.address}</dd>
          </div>
        )}
      </dl>

      <p className={`status-text ${status.tone}`}>
        {status.text}
        {booking.rejectionReason && <> Motivo: {booking.rejectionReason}</>}
      </p>

      {booking.status === 'awaiting_receipt' && <ReceiptStep booking={booking} onUploaded={setBooking} />}

      {mode === 'view' && booking.canChange && (
        <div className="actions">
          <button className="btn secondary" onClick={() => setMode('reschedule')}>
            Cambiar día u horario
          </button>
          <button className="btn ghost danger" onClick={() => setMode('cancel')}>
            Cancelar turno
          </button>
        </div>
      )}
      {mode === 'view' && !booking.canChange && ['awaiting_approval', 'confirmed'].includes(booking.status) && (
        <p className="hint">
          Faltan menos de {business.changeLimitHours} horas: para cambios escribinos directamente.
        </p>
      )}

      {mode === 'reschedule' && (
        <Reschedule business={business} booking={booking} onDone={(b) => (setBooking(b), setMode('view'))} onBack={() => setMode('view')} />
      )}
      {mode === 'cancel' && (
        <CancelConfirm booking={booking} onDone={(b) => (setBooking(b), setMode('view'))} onBack={() => setMode('view')} />
      )}

      <button className="link-btn" onClick={onExit}>
        ← Reservar otro turno
      </button>
    </section>
  )
}

function ReceiptStep({ booking, onUploaded }: { booking: PublicBooking; onUploaded: (b: PublicBooking) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const bank = booking.bankTransfer

  const copy = useCallback(async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      // el navegador no dejó copiar; el dato queda visible igual
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return setError('Elegí la foto o el PDF del comprobante.')
    setBusy(true)
    setError('')
    try {
      onUploaded(await api.uploadReceipt(booking.code, file))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="receipt card" onSubmit={submit}>
      <h3>Transferí la seña de {money(booking.deposit)}</h3>
      {bank && (
        <dl className="bank">
          {[
            ['Alias', bank.alias],
            ['CBU / CVU', bank.cbu],
            ['Titular', bank.holder],
            ['Banco', bank.bank],
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <span className={label === 'Alias' || label === 'CBU / CVU' ? 'mono' : ''}>{value}</span>
                  {(label === 'Alias' || label === 'CBU / CVU') && (
                    <button type="button" className="copy-btn" onClick={() => copy(label, value)}>
                      {copied === label ? 'Copiado' : 'Copiar'}
                    </button>
                  )}
                </dd>
              </div>
            ))}
        </dl>
      )}
      {booking.holdExpiresAt && (
        <p className="hint">Te guardamos el horario hasta las {formatTime(booking.holdExpiresAt)} h. Guardá tu código: <strong>{booking.code}</strong></p>
      )}
      <label className="file">
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <span>{file ? file.name : 'Subí la captura o el PDF del comprobante'}</span>
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={busy}>
        {busy ? 'Enviando…' : 'Enviar comprobante'}
      </button>
    </form>
  )
}

function Reschedule({
  business,
  booking,
  onDone,
  onBack,
}: {
  business: BusinessInfo
  booking: PublicBooking
  onDone: (b: PublicBooking) => void
  onBack: () => void
}) {
  const [slot, setSlot] = useState<Slot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  async function confirm() {
    if (!slot) return
    setBusy(true)
    setError('')
    try {
      onDone(await api.reschedule(booking.code, slot.start))
    } catch (err) {
      setError((err as Error).message)
      if ((err as ApiError).status === 409) setRefreshKey((k) => k + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="reschedule">
      <h3>Elegí el nuevo día y horario</h3>
      <DateTimePicker
        serviceId={booking.serviceId}
        bookingWindowDays={business.bookingWindowDays}
        selectedStart={slot?.start ?? null}
        onSelect={setSlot}
        refreshKey={refreshKey}
      />
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="btn primary" disabled={!slot || busy} onClick={confirm}>
          {busy ? 'Guardando…' : slot ? `Confirmar el cambio a las ${slot.time}` : 'Confirmar el cambio'}
        </button>
        <button className="btn ghost" onClick={onBack}>
          No cambiar nada
        </button>
      </div>
    </div>
  )
}

function CancelConfirm({ booking, onDone, onBack }: { booking: PublicBooking; onDone: (b: PublicBooking) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function cancel() {
    setBusy(true)
    try {
      onDone(await api.cancel(booking.code))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="card warn-card">
      <p>
        ¿Seguro que querés cancelar? La seña de {money(booking.deposit)} no se reintegra. Si preferís, podés cambiar el día sin costo.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="btn danger" disabled={busy} onClick={cancel}>
          {busy ? 'Cancelando…' : 'Sí, cancelar el turno'}
        </button>
        <button className="btn ghost" onClick={onBack}>
          Volver
        </button>
      </div>
    </div>
  )
}
