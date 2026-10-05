import { useCallback, useEffect, useRef, useState } from 'react'
import { adminToken, api, ApiError, type AdminBooking, type CalendarStatus } from '../lib/api'
import { capitalize, formatDay, formatTime, money, timeAgo } from '../lib/format'

const POLL_MS = 20_000

interface OAuthResult {
  error?: string
  calendarConnected?: boolean
}

// Google vuelve a /panel con el resultado en el hash (#token=…, #error=…, #calendar=connected).
// Se lee una sola vez al cargar el módulo y se limpia la URL para que el token no quede a la vista.
const oauthResult: OAuthResult = (() => {
  const params = new URLSearchParams(window.location.hash.slice(1))
  if (![...params.keys()].length) return {}
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  const token = params.get('token')
  if (token) adminToken.set(token)
  return { error: params.get('error') ?? undefined, calendarConnected: params.get('calendar') === 'connected' }
})()

interface Props {
  onPendingCount: (n: number) => void
}

export function AdminPage({ onPendingCount }: Props) {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(adminToken.get()))

  const logout = useCallback(() => {
    adminToken.set(null)
    setLoggedIn(false)
    onPendingCount(0)
  }, [onPendingCount])

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />
  return <Dashboard onPendingCount={onPendingCount} onLogout={logout} />
}

async function goToGoogle(purpose: 'login' | 'calendar') {
  const { url } = await api.admin.googleStart(purpose)
  window.location.assign(url)
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [authConfig, setAuthConfig] = useState<{ google: boolean; devLogin: boolean } | null>(null)
  const [error, setError] = useState(oauthResult.error ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.admin
      .authConfig()
      .then(setAuthConfig)
      .catch((e) => setError(e.message))
  }, [])

  async function google() {
    setBusy(true)
    setError('')
    try {
      await goToGoogle('login')
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function dev() {
    try {
      adminToken.set((await api.admin.devLogin()).token)
      onLogin()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="panel narrow">
      <span className="script">Bienvenida</span>
      <h1>Panel del local</h1>
      <p className="muted">Ingresá con tu cuenta de Google para confirmar las señas.</p>
      <div className="customer card">
        <button className="btn google" disabled={busy || !authConfig?.google} onClick={google}>
          <GoogleIcon />
          {busy ? 'Abriendo Google…' : 'Ingresar con Google'}
        </button>
        {authConfig && !authConfig.google && (
          <p className="hint">Google todavía no está configurado en el servidor (faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).</p>
        )}
        {authConfig?.devLogin && (
          <button className="btn secondary" onClick={dev}>
            Entrar en modo desarrollo
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  )
}

function CalendarCard({ status, onChange }: { status: CalendarStatus; onChange: (s: CalendarStatus) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(oauthResult.error ?? '')
  const [justConnected] = useState(Boolean(oauthResult.calendarConnected))

  async function connect() {
    setBusy(true)
    setError('')
    try {
      await goToGoogle('calendar')
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!window.confirm('¿Desconectar Google Calendar? Los turnos nuevos se guardarán solo en el sistema.')) return
    setBusy(true)
    try {
      onChange((await api.admin.disconnectCalendar()).calendar)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!status.configured) {
    return (
      <div className="card warn-card">
        Google Calendar todavía no está configurado en el servidor: por ahora los turnos se guardan solo en el sistema.
      </div>
    )
  }

  return (
    <div className={`card calendar-card${status.connected ? '' : ' warn-card'}`}>
      {status.connected ? (
        <p>
          📅 Calendario conectado: <strong>{status.email}</strong>
          {justConnected && ' · ¡Listo!'}
          <br />
          <span className="muted small">La disponibilidad sale de este calendario y cada seña confirmada se agrega como evento.</span>
        </p>
      ) : (
        <p>
          📅 Conectá el Google Calendar de quien atiende para que la agenda use su disponibilidad real y se agreguen los turnos
          confirmados.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        {status.connected ? (
          <button className="btn ghost small" disabled={busy} onClick={disconnect}>
            Desconectar
          </button>
        ) : (
          <button className="btn google small" disabled={busy} onClick={connect}>
            <GoogleIcon />
            {busy ? 'Abriendo Google…' : 'Conectar Google Calendar'}
          </button>
        )}
      </div>
    </div>
  )
}

/** Un "ding" corto con Web Audio para avisar que llegó una seña nueva. */
function ding() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => ctx.close()
  } catch {
    // sin audio disponible
  }
}

function Dashboard({ onPendingCount, onLogout }: { onPendingCount: (n: number) => void; onLogout: () => void }) {
  const [pending, setPending] = useState<AdminBooking[] | null>(null)
  const [upcoming, setUpcoming] = useState<AdminBooking[]>([])
  const [awaiting, setAwaiting] = useState<AdminBooking[]>([])
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null)
  const [me, setMe] = useState('')
  const [error, setError] = useState('')
  const seen = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, u, w, s, who] = await Promise.all([
        api.admin.pending(),
        api.admin.upcoming(),
        api.admin.awaitingReceipt(),
        api.admin.status(),
        api.admin.me(),
      ])
      // Suena solo por señas que no estaban en la carga anterior.
      const ids = new Set(p.bookings.map((b) => b.id))
      if (seen.current && p.bookings.some((b) => !seen.current!.has(b.id))) ding()
      seen.current = ids
      setPending(p.bookings)
      setUpcoming(u.bookings)
      setAwaiting(w.bookings)
      setCalendar(s.calendar)
      setMe(who.email)
      onPendingCount(p.bookings.length)
      setError('')
    } catch (err) {
      if ((err as ApiError).status === 401) return onLogout()
      setError((err as Error).message)
    }
  }, [onPendingCount, onLogout])

  useEffect(() => {
    void load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const resolve = (id: string) => {
    setPending((list) => list?.filter((b) => b.id !== id) ?? null)
    void load()
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>Señas por confirmar</h1>
          <p className="muted">
            Al confirmar, el turno se escribe en el Google Calendar de quien atiende y a la clienta le llega la confirmación.
          </p>
        </div>
        <div className="session">
          {me && <span className="muted small">{me}</span>}
          <button className="btn ghost small" onClick={onLogout}>
            Salir
          </button>
        </div>
      </div>

      <div className="card note">
        🔔 Cada seña nueva suena en esta pestaña y te llega un correo. Si pasa una hora sin confirmarla, te lo recordamos.
      </div>
      {calendar && <CalendarCard status={calendar} onChange={setCalendar} />}
      {error && <p className="error">{error}</p>}

      <h2 className="section-label">Esperando tu aprobación</h2>
      {pending === null ? (
        <p className="muted">Cargando…</p>
      ) : pending.length === 0 ? (
        <p className="muted empty">No hay señas pendientes. 🎉</p>
      ) : (
        <div className="stack">
          {pending.map((b) => (
            <PendingCard key={b.id} booking={b} onResolved={() => resolve(b.id)} />
          ))}
        </div>
      )}

      {awaiting.length > 0 && (
        <>
          <h2 className="section-label">Reservados, falta el comprobante</h2>
          <ul className="upcoming card">
            {awaiting.map((b) => (
              <li key={b.id}>
                <span className="when">
                  {capitalize(formatDay(b.start))} · {formatTime(b.start)} h
                </span>
                <span>
                  <strong>{b.customer.name}</strong> · {b.serviceName}
                </span>
                <span className="muted small">
                  {b.customer.phone} · {b.code} · seña {money(b.deposit)}
                  {b.holdExpiresAt && ` · el horario se libera a las ${formatTime(b.holdExpiresAt)} h si no sube el comprobante`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section-label">Próximos turnos confirmados</h2>
      {upcoming.length === 0 ? (
        <p className="muted empty">Todavía no hay turnos confirmados.</p>
      ) : (
        <ul className="upcoming card">
          {upcoming.map((b) => (
            <li key={b.id}>
              <span className="when">
                {capitalize(formatDay(b.start))} · {formatTime(b.start)} h
              </span>
              <span>
                <strong>{b.customer.name}</strong> · {b.serviceName}
              </span>
              <span className="muted small">
                {b.professional} · {b.customer.phone} · {b.code}
                {!b.inCalendar && calendar?.connected && ' · ⚠ no está en el calendario'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PendingCard({ booking: b, onResolved }: { booking: AdminBooking; onResolved: () => void }) {
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  async function act(kind: 'confirm' | 'reject') {
    setBusy(kind)
    setError('')
    try {
      if (kind === 'confirm') await api.admin.confirm(b.id)
      else await api.admin.reject(b.id, reason)
      onResolved()
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  async function openReceipt() {
    // Se abre la pestaña antes del await para que el navegador no la bloquee.
    const win = window.open('', '_blank')
    try {
      const url = await api.admin.receiptUrl(b.id)
      if (win) win.location.href = url
      else window.location.href = url
    } catch (err) {
      win?.close()
      setError((err as Error).message)
    }
  }

  return (
    <article className="pending card">
      <div className="pending-head">
        <div>
          <strong>
            {b.customer.name} · {b.code}
          </strong>
          <p className="muted small">
            {b.serviceName} · {formatDay(b.start)}, {formatTime(b.start)} h · {b.professional} · {b.customer.phone}
          </p>
        </div>
        <span className="price">{money(b.deposit)}</span>
      </div>
      {b.receipt && (
        <button type="button" className="receipt-file" onClick={openReceipt}>
          <span>📎 {b.receipt.originalName}</span>
          <span className="link">Ver</span>
        </button>
      )}
      {b.receipt && <p className="waiting">Esperando tu aprobación {timeAgo(b.receipt.uploadedAt)}</p>}
      {rejecting && (
        <label className="reason">
          Motivo (opcional, se lo enviamos a la clienta)
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ej: el monto no coincide" />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions two">
        {rejecting ? (
          <>
            <button className="btn danger" disabled={busy !== null} onClick={() => act('reject')}>
              {busy === 'reject' ? 'Rechazando…' : 'Rechazar seña'}
            </button>
            <button className="btn secondary" disabled={busy !== null} onClick={() => setRejecting(false)}>
              Volver
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" disabled={busy !== null} onClick={() => act('confirm')}>
              {busy === 'confirm' ? 'Confirmando…' : 'Confirmar seña'}
            </button>
            <button className="btn secondary" disabled={busy !== null} onClick={() => setRejecting(true)}>
              Rechazar
            </button>
          </>
        )}
      </div>
    </article>
  )
}
