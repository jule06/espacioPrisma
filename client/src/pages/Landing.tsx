import type { BusinessInfo } from '../lib/api'
import { APPROACH, FAQ, INSTAGRAM_URL, PLACES, PROMO, WHATSAPP_DISPLAY, whatsappLink } from '../lib/content'
import { money, todayKey } from '../lib/format'

interface Props {
  business: BusinessInfo
  onBook: (serviceId?: string) => void
}

const SERVICE_ICONS: Record<string, string> = {
  descontracturante: '💆',
  circulatorio: '🦵',
  relajante: '☁️',
  integral: '☯️',
  reflexología: '👣',
}

const iconFor = (name: string) =>
  Object.entries(SERVICE_ICONS).find(([key]) => name.toLowerCase().includes(key))?.[1] ?? '🌿'

export function Landing({ business, onBook }: Props) {
  const promoActive = todayKey() <= PROMO.until
  const promoService = business.services.find((s) => s.name === PROMO.serviceName)
  const pro = business.professionals[0]

  return (
    <div className="landing">
      <section className="l-hero">
        <div className="prism-line" aria-hidden="true" />
        <span className="script">Masoterapia Integral</span>
        <h1>
          Liberá el estrés
          <br />y la tensión
        </h1>
        <p className="l-lead">
          Masajes descontracturantes y relajantes en Liniers, Versalles, Flores y a domicilio. Una pausa para que tu cuerpo
          vuelva a su equilibrio.
        </p>
        <div className="l-cta">
          <button className="btn primary big" onClick={() => onBook()}>
            Reservar turno
          </button>
          <a className="btn secondary big" href={whatsappLink()} target="_blank" rel="noreferrer">
            Escribime por WhatsApp
          </a>
        </div>
        <ul className="l-places-inline" aria-label="Dónde atiendo">
          {PLACES.map((p) => (
            <li key={p.name}>{p.name}</li>
          ))}
        </ul>
      </section>

      {promoActive && (
        <section className="l-promo" aria-label="Promoción">
          <div>
            <p className="eyebrow">{PROMO.eyebrow} ✨</p>
            <h2>{PROMO.title}</h2>
            <p>{PROMO.text}</p>
          </div>
          <div className="l-promo-actions">
            {promoService && (
              <button className="btn primary" onClick={() => onBook(promoService.id)}>
                Reservar {PROMO.serviceName}
              </button>
            )}
            <a className="btn ghost" href={whatsappLink('Hola Pau! Quería pedir una Gift Card 🎁')} target="_blank" rel="noreferrer">
              Pedir Gift Card
            </a>
          </div>
        </section>
      )}

      <section id="servicios" className="l-section">
        <p className="eyebrow">Servicios</p>
        <h2>¿Qué está necesitando tu cuerpo hoy?</h2>
        <p className="l-sub">
          Muchas veces naturalizamos vivir con tensión, dolores de espalda o el cansancio de la semana. Tu bienestar no debería
          esperar.
        </p>
        <div className="l-services">
          {business.services.map((s) => (
            <article key={s.id} className="l-service card">
              <span className="l-service-icon" aria-hidden="true">
                {iconFor(s.name)}
              </span>
              <h3>{s.name}</h3>
              {s.description && <p className="muted">{s.description}</p>}
              <p className="l-service-meta">
                <span>{s.durationMinutes} min</span>
                <strong>{money(s.price)}</strong>
              </p>
              <button className="btn secondary" onClick={() => onBook(s.id)}>
                Reservar
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="enfoque" className="l-section l-about">
        <div className="l-about-intro">
          <p className="eyebrow">Mi enfoque</p>
          <h2>Sintonizá con tu calma interior</h2>
          <p>
            Soy {pro?.name.split(' ')[0] ?? 'Pau'}, masoterapeuta integral. A través de la masoterapia holística te acompaño a
            soltar lo que tu cuerpo viene cargando. Tu cuerpo es tu templo y merece ser cuidado. 🌸
          </p>
        </div>
        <div className="l-approach">
          {APPROACH.map((a) => (
            <div key={a.title} className="l-approach-item">
              <h3>{a.title}</h3>
              <p className="muted">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="lugares" className="l-section">
        <p className="eyebrow">Dónde atiendo</p>
        <h2>Gabinetes y a domicilio</h2>
        <div className="l-places">
          {PLACES.map((p) => (
            <div key={p.name} className="l-place card">
              <span className="l-place-pin" aria-hidden="true">
                {p.name === 'A domicilio' ? '🏠' : '📍'}
              </span>
              <div>
                <h3>{p.name}</h3>
                <p className="muted small">{p.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="preguntas" className="l-section">
        <p className="eyebrow">Preguntas frecuentes</p>
        <h2>Todo lo que querés saber</h2>
        <div className="l-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="contacto" className="l-final">
        <span className="script">Permitite esta pausa</span>
        <h2>Reservá tu momento de relax</h2>
        <div className="l-cta">
          <button className="btn primary big" onClick={() => onBook()}>
            Reservar turno
          </button>
          <a className="btn secondary big" href={whatsappLink()} target="_blank" rel="noreferrer">
            WhatsApp {WHATSAPP_DISPLAY}
          </a>
        </div>
        <p className="muted small">
          También por mensaje directo en{' '}
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
            @miespacioprisma
          </a>
        </p>
      </section>

      <footer className="l-footer">
        <span>
          {business.name} · Masoterapia Integral 🌈
        </span>
        <span>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
            Instagram
          </a>{' '}
          ·{' '}
          <a href={whatsappLink()} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </span>
      </footer>
    </div>
  )
}
