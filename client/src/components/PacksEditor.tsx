import { useEffect, useState } from 'react'
import { api, ApiError, type AdminPack } from '../lib/api'
import { money } from '../lib/format'

interface Props {
  onUnauthorized: () => void
}

/** Edición de los packs mensuales que se muestran en la landing. */
export function PacksEditor({ onUnauthorized }: Props) {
  const [packs, setPacks] = useState<AdminPack[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.admin
      .packs()
      .then((r) => setPacks(r.packs))
      .catch((err) => {
        if ((err as ApiError).status === 401) return onUnauthorized()
        setError((err as Error).message)
      })
  }, [onUnauthorized])

  if (error) return <p className="error">{error}</p>
  if (!packs) return <p className="muted">Cargando packs…</p>

  return (
    <div className="stack">
      <p className="muted">
        Los packs se muestran en la página con el botón <strong>"Quiero este pack"</strong>, que abre WhatsApp. Si desactivás
        uno, deja de mostrarse.
      </p>
      {packs.map((p) => (
        <PackForm
          key={p.id}
          pack={p}
          open={openId === p.id}
          onToggle={() => setOpenId(openId === p.id ? null : p.id)}
          onSaved={(updated) => setPacks((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null)}
          onUnauthorized={onUnauthorized}
        />
      ))}
    </div>
  )
}

const toNumber = (value: string) => Number(value.replace(/\D/g, '')) || 0

function PackForm({
  pack,
  open,
  onToggle,
  onSaved,
  onUnauthorized,
}: {
  pack: AdminPack
  open: boolean
  onToggle: () => void
  onSaved: (p: AdminPack) => void
  onUnauthorized: () => void
}) {
  const [form, setForm] = useState(pack)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')
  const dirty = (Object.keys(pack) as (keyof AdminPack)[]).some((k) => form[k] !== pack[k])

  const set = <K extends keyof AdminPack>(key: K, value: AdminPack[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setStatus('idle')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError('')
    try {
      const { id: _id, ...data } = form
      const { pack: updated } = await api.admin.updatePack(pack.id, data)
      onSaved(updated)
      setForm(updated)
      setStatus('saved')
    } catch (err) {
      if ((err as ApiError).status === 401) return onUnauthorized()
      setError((err as Error).message)
      setStatus('idle')
    }
  }

  return (
    <article className={`card service-editor${pack.active ? '' : ' inactive'}`}>
      <button type="button" className="service-editor-head" aria-expanded={open} onClick={onToggle}>
        <span>
          <strong>{pack.name}</strong>
          <span className="muted small">
            {pack.sessions} · {money(pack.price)}
            {!pack.active && ' · oculto'}
          </span>
        </span>
        <span className="service-editor-toggle" aria-hidden="true">
          {open ? '–' : 'Editar'}
        </span>
      </button>

      {open && (
        <form className="service-editor-form" onSubmit={save}>
          <label>
            Nombre
            <input value={form.name} maxLength={120} required onChange={(e) => set('name', e.target.value)} />
          </label>
          <label>
            Subtítulo <span className="muted small">(opcional, ej. "Masaje Integral + Circulatorio")</span>
            <input value={form.subtitle} maxLength={160} onChange={(e) => set('subtitle', e.target.value)} />
          </label>
          <label>
            Frecuencia
            <input value={form.sessions} maxLength={120} placeholder="Semanal · 4 sesiones al mes" onChange={(e) => set('sessions', e.target.value)} />
          </label>
          <label>
            Qué incluye <span className="muted small">(opcional)</span>
            <textarea rows={2} value={form.includes} maxLength={600} onChange={(e) => set('includes', e.target.value)} />
          </label>
          <div className="form-row">
            <label>
              Precio sin pack <span className="muted small">(tachado)</span>
              <input inputMode="numeric" value={form.regularPrice || ''} onChange={(e) => set('regularPrice', toNumber(e.target.value))} />
            </label>
            <label>
              Precio del pack
              <input inputMode="numeric" required value={form.price || ''} onChange={(e) => set('price', toNumber(e.target.value))} />
            </label>
          </div>
          <label>
            Ideal para
            <textarea rows={3} value={form.idealFor} maxLength={600} onChange={(e) => set('idealFor', e.target.value)} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
            Mostrar en la página
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
