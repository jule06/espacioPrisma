import { useCallback, useEffect, useState } from 'react'
import { DevOutbox } from './components/DevOutbox'
import { adminToken, api, type BusinessInfo } from './lib/api'
import { AdminPage } from './pages/AdminPage'
import { BookingPage } from './pages/BookingPage'
import { Landing } from './pages/Landing'
import { MyBooking } from './pages/MyBooking'

// Rutas:
//   "/"                      landing
//   "/reservar"              reserva (?servicio=ID para elegir el servicio de antemano)
//   "/reservar?codigo=XXXX"  turno de la clienta (también "/?codigo=XXXX", el link de los emails viejos)
//   "/panel"                 panel del local
type Page = 'landing' | 'booking' | 'panel'

interface Route {
  page: Page
  code: string | null
  serviceId: string | null
}

function readRoute(): Route {
  const url = new URL(window.location.href)
  const page: Page = url.pathname.startsWith('/panel') ? 'panel' : url.pathname.startsWith('/reservar') ? 'booking' : 'landing'
  return { page, code: url.searchParams.get('codigo'), serviceId: url.searchParams.get('servicio') }
}

function navigate(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

function NavLink({ href, children, active, className = '' }: { href: string; children: React.ReactNode; active?: boolean; className?: string }) {
  return (
    <a
      href={href}
      className={`${className}${active ? ' active' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        navigate(href)
      }}
    >
      {children}
    </a>
  )
}

/** Links a secciones de la landing: si ya estamos ahí solo hace scroll. */
function SectionLink({ id, children, onLanding }: { id: string; children: React.ReactNode; onLanding: boolean }) {
  return (
    <a
      href={`/#${id}`}
      onClick={(e) => {
        e.preventDefault()
        if (!onLanding) navigate('/')
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }))
      }}
    >
      {children}
    </a>
  )
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
    const name = business?.name ?? 'Espacio Prisma'
    const base =
      route.page === 'panel'
        ? 'Panel del local'
        : route.page === 'booking' || route.code
          ? `Reservá tu turno · ${name}`
          : `${name} · Masoterapia Integral`
    document.title = pendingCount > 0 && route.page === 'panel' ? `(${pendingCount}) ${base}` : base
  }, [route.page, route.code, business, pendingCount])

  const showCode = useCallback((code: string) => navigate(`/reservar?codigo=${encodeURIComponent(code)}`), [])
  const book = useCallback((serviceId?: string) => navigate(serviceId ? `/reservar?servicio=${serviceId}` : '/reservar'), [])

  const onLanding = route.page === 'landing' && !route.code
  // Las clientas no ven el panel: solo aparece si ya hay una sesión o si se entra por /panel.
  const showPanelLink = route.page === 'panel' || Boolean(adminToken.get())

  return (
    <div className="app">
      <header className="site-header">
        <NavLink href="/" className="brand">
          Prisma
          <span className="brand-sub">Masoterapia Integral</span>
        </NavLink>
        <nav aria-label="Secciones">
          <SectionLink id="servicios" onLanding={onLanding}>
            Servicios
          </SectionLink>
          <SectionLink id="lugares" onLanding={onLanding}>
            Dónde
          </SectionLink>
          <SectionLink id="preguntas" onLanding={onLanding}>
            Preguntas
          </SectionLink>
          {showPanelLink && (
            <NavLink href="/panel" active={route.page === 'panel'}>
              Panel
              {pendingCount > 0 && <span className="count">{pendingCount}</span>}
            </NavLink>
          )}
          <NavLink href="/reservar" className="btn primary small nav-cta" active={route.page === 'booking'}>
            Reservar turno
          </NavLink>
        </nav>
      </header>

      <main className={onLanding ? 'main-landing' : ''}>
        {route.page === 'panel' ? (
          <AdminPage onPendingCount={setPendingCount} />
        ) : error ? (
          <p className="error center">{error}</p>
        ) : !business ? (
          <p className="muted center">Cargando…</p>
        ) : route.code ? (
          <MyBooking key={route.code} business={business} code={route.code} onExit={() => navigate('/reservar')} />
        ) : route.page === 'booking' ? (
          <BookingPage
            key={route.serviceId ?? 'all'}
            business={business}
            initialServiceId={route.serviceId ?? undefined}
            onBooked={showCode}
            onLookup={showCode}
          />
        ) : (
          <Landing business={business} onBook={book} />
        )}
      </main>
      <DevOutbox />
    </div>
  )
}
