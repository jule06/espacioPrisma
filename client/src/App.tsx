import { useCallback, useEffect, useState } from 'react'
import { DevOutbox } from './components/DevOutbox'
import { adminToken, api, type BusinessInfo } from './lib/api'
import { AdminPage } from './pages/AdminPage'
import { BookingPage } from './pages/BookingPage'
import { MyBooking } from './pages/MyBooking'

// Rutas: "/" reserva, "/?codigo=XXXX" turno de la clienta, "/panel" panel del local.
interface Route {
  panel: boolean
  code: string | null
}

function readRoute(): Route {
  const url = new URL(window.location.href)
  return { panel: url.pathname.startsWith('/panel'), code: url.searchParams.get('codigo') }
}

function navigate(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [business, setBusiness] = useState<BusinessInfo | null>(null)
  const [error, setError] = useState('')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const onPop = () => setRoute(readRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    api
      .business()
      .then(setBusiness)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const base = route.panel ? 'Panel del local' : business ? `${business.name} · Reservá tu turno` : 'Reservá tu turno'
    document.title = pendingCount > 0 && route.panel ? `(${pendingCount}) ${base}` : base
  }, [route.panel, business, pendingCount])

  const showCode = useCallback((code: string) => navigate(`/?codigo=${encodeURIComponent(code)}`), [])

  return (
    <div className="app">
      <nav className="tabs" aria-label="Secciones">
        <a
          href="/"
          className={!route.panel ? 'active' : ''}
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          Reservar turno
        </a>
        {/* Las clientas no ven el panel: solo aparece si ya hay una sesión o si se entra por /panel. */}
        {(route.panel || adminToken.get()) && (
        <a
          href="/panel"
          className={route.panel ? 'active' : ''}
          onClick={(e) => {
            e.preventDefault()
            navigate('/panel')
          }}
        >
          Panel del local
          {pendingCount > 0 && <span className="count">{pendingCount}</span>}
        </a>
        )}
      </nav>

      <main>
        {route.panel ? (
          <AdminPage onPendingCount={setPendingCount} />
        ) : error ? (
          <p className="error center">{error}</p>
        ) : !business ? (
          <p className="muted center">Cargando…</p>
        ) : route.code ? (
          <MyBooking key={route.code} business={business} code={route.code} onExit={() => navigate('/')} />
        ) : (
          <BookingPage business={business} onBooked={showCode} onLookup={showCode} />
        )}
      </main>
      <DevOutbox />
    </div>
  )
}
