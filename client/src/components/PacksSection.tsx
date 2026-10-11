import { useEffect, useState } from 'react'
import { api, type Pack } from '../lib/api'
import { whatsappLink } from '../lib/content'
import { money } from '../lib/format'

/** Sección "Packs mensuales" de la landing. Los packs se coordinan por WhatsApp. */
export function PacksSection() {
  const [packs, setPacks] = useState<Pack[]>([])

  useEffect(() => {
    api
      .packs()
      .then((r) => setPacks(r.packs))
      .catch(() => setPacks([]))
  }, [])

  if (packs.length === 0) return null

  return (
    <section id="packs" className="l-section">
      <p className="eyebrow">Packs mensuales</p>
      <h2>Tu bienestar, todos los meses</h2>
      <p className="l-sub">
        Sesiones fijas cada semana o cada quince días, a un precio especial. Elegí tu pack y coordinamos juntas los días por
        WhatsApp.
      </p>
      <div className="l-packs">
        {packs.map((p) => {
          const saving = p.regularPrice > p.price ? p.regularPrice - p.price : 0
          return (
            <article key={p.id} className="l-pack card">
              <div className="l-pack-head">
                <span className="l-pack-sessions">{p.sessions}</span>
                {saving > 0 && <span className="l-pack-saving">Ahorrás {money(saving)}</span>}
              </div>
              <h3>{p.name}</h3>
              {p.subtitle && <p className="l-pack-subtitle">{p.subtitle}</p>}
              {p.includes && <p className="small">{p.includes}</p>}
              <p className="l-pack-price">
                {saving > 0 && <s className="muted">{money(p.regularPrice)}</s>}
                <strong>{money(p.price)}</strong>
              </p>
              {p.idealFor && (
                <p className="l-pack-ideal">
                  <span>💡 Ideal para</span>
                  {p.idealFor}
                </p>
              )}
              <a
                className="btn secondary"
                href={whatsappLink(`Hola Pau! Me interesa el pack "${p.name}" (${money(p.price)}) 🌈`)}
                target="_blank"
                rel="noreferrer"
              >
                Quiero este pack
              </a>
            </article>
          )
        })}
      </div>
    </section>
  )
}
