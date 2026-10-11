import { useEffect, useState } from 'react'
import { api, ApiError, type AdminService } from '../lib/api'
import { money } from '../lib/format'

interface Props {
  onUnauthorized: () => void
}

/** Edición del contenido de cada servicio que se ve en la landing ("+ info"). */
export function ServicesEditor({ onUnauthorized }: Props) {
  const [services, setServices] = useState<AdminService[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.admin
      .services()
      .then((r) => setServices(r.services))
      .catch((err) => {
        if ((err as ApiError).status === 401) return onUnauthorized()
        setError((err as Error).message)
      })
  }, [onUnauthorized])

  if (error) return <p className="error">{error}</p>
  if (!services) return <p className="muted">Cargando servicios…</p>

  return (
    <div className="stack">
      <p className="muted">
        Esto es lo que ven las clientas al tocar <strong>"+ info"</strong> en cada servicio de la página. Los cambios se
        publican apenas guardás.
      </p>
      {services.map((s) => (
        <ServiceForm
          key={s.id}
          service={s}
          open={openId === s.id}
          onToggle={() => setOpenId(openId === s.id ? null : s.id)}
          onSaved={(updated) => setServices((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null)}
          onUnauthorized={onUnauthorized}
        />
      ))}
    </div>
  )
}

function ServiceForm({
  service,
  open,
  onToggle,
  onSaved,
  onUnauthorized,
}: {
  service: AdminService
  open: boolean
  onToggle: () => void
  onSaved: (s: AdminService) => void
  onUnauthorized: () => void
}) {
  const [description, setDescription] = useState(service.description)
  const [details, setDetails] = useState(service.details)
  // Los beneficios se editan como texto: uno por línea.
  const [benefits, setBenefits] = useState(service.benefits.join('\n'))
  const [idealFor, setIdealFor] = useState(service.idealFor)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  const benefitList = benefits
    .split('\n')
    .map((b) => b.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean)
  const dirty =
    description !== service.description ||
    details !== service.details ||
    idealFor !== service.idealFor ||
    benefitList.join('\n') !== service.benefits.join('\n')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError('')
    try {
      const { service: updated } = await api.admin.updateService(service.id, {
        description,
        details,
        benefits: benefitList,
        idealFor,
      })
      onSaved(updated)
      setBenefits(updated.benefits.join('\n'))
      setStatus('saved')
    } catch (err) {
      if ((err as ApiError).status === 401) return onUnauthorized()
      setError((err as Error).message)
      setStatus('idle')
    }
  }

  return (
    <article className="card service-editor">
      <button type="button" className="service-editor-head" aria-expanded={open} onClick={onToggle}>
        <span>
          <strong>{service.name}</strong>
          <span className="muted small">
            {service.durationMinutes} min · {money(service.price)}
          </span>
        </span>
        <span className="service-editor-toggle" aria-hidden="true">
          {open ? '–' : 'Editar'}
        </span>
      </button>

      {open && (
        <form className="service-editor-form" onSubmit={save}>
          <label>
            Descripción corta <span className="muted small">(se ve en la tarjeta)</span>
            <input value={description} maxLength={300} onChange={(e) => (setDescription(e.target.value), setStatus('idle'))} />
          </label>
          <label>
            Cómo es la sesión
            <textarea rows={4} value={details} maxLength={2000} onChange={(e) => (setDetails(e.target.value), setStatus('idle'))} />
          </label>
          <label>
            Beneficios <span className="muted small">(uno por línea)</span>
            <textarea rows={5} value={benefits} onChange={(e) => (setBenefits(e.target.value), setStatus('idle'))} />
          </label>
          <label>
            Ideal para
            <textarea rows={2} value={idealFor} maxLength={500} onChange={(e) => (setIdealFor(e.target.value), setStatus('idle'))} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="btn primary" disabled={!dirty || status === 'saving'}>
              {status === 'saving' ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {status === 'saved' && !dirty && <span className="saved-note">✓ Guardado y publicado</span>}
          </div>
        </form>
      )}
    </article>
  )
}
