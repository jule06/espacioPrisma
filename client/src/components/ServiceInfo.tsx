import { useEffect, useRef } from 'react'
import type { ServiceItem } from '../lib/api'
import { money } from '../lib/format'

interface Props {
  service: ServiceItem | null
  icon: string
  onClose: () => void
  onBook: (serviceId: string) => void
}

/** Ventana "+ info" de un servicio: cómo es la sesión, beneficios y para quién es ideal. */
export function ServiceInfo({ service, icon, onClose, onBook }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (service && !dialog.open) dialog.showModal()
    if (!service && dialog.open) dialog.close()
  }, [service])

  return (
    <dialog
      ref={ref}
      className="service-info"
      aria-labelledby="service-info-title"
      onClose={onClose}
      // Clic fuera del contenido (sobre el fondo) cierra la ventana.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {service && (
        <div className="service-info-body">
          <button className="service-info-close" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
          <span className="l-service-icon" aria-hidden="true">
            {icon}
          </span>
          <h2 id="service-info-title">{service.name}</h2>
          {service.description && <p className="muted">{service.description}</p>}
          <p className="service-info-meta">
            <span>{service.durationMinutes} min</span>
            <span>·</span>
            <strong>{money(service.price)}</strong>
            <span className="muted small">(seña {money(service.deposit)})</span>
          </p>

          {service.details && (
            <section>
              <h3>Cómo es la sesión</h3>
              <p>{service.details}</p>
            </section>
          )}
          {service.benefits?.length > 0 && (
            <section>
              <h3>Beneficios</h3>
              <ul className="service-info-benefits">
                {service.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </section>
          )}
          {service.idealFor && (
            <section>
              <h3>Ideal para</h3>
              <p>{service.idealFor}</p>
            </section>
          )}

          <button className="btn primary big" onClick={() => onBook(service.id)}>
            Reservar {service.name}
          </button>
        </div>
      )}
    </dialog>
  )
}
