import { useEffect, useState } from 'react'
import { api, type OutboxMail } from '../lib/api'
import { formatTime } from '../lib/format'

const POLL_MS = 4000

/** Convierte las URLs del texto en links. */
function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part}>
        {part}
      </a>
    ) : (
      part
    ),
  )
}

/**
 * Bandeja de emails de prueba. Solo aparece en desarrollo mientras el servidor no tenga SMTP:
 * muestra los correos que se habrían enviado (con el código y el link del turno).
 */
export function DevOutbox() {
  const [enabled, setEnabled] = useState(false)
  const [mails, setMails] = useState<OutboxMail[]>([])
  const [open, setOpen] = useState(false)
  const [seenId, setSeenId] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      api
        .devOutbox()
        .then((r) => {
          if (cancelled) return
          setEnabled(r.enabled)
          setMails(r.mails)
        })
        .catch(() => undefined)
    void load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (!enabled) return null
  const unread = mails.filter((m) => m.id > seenId).length

  return (
    <div className="outbox">
      {open && (
        <div className="outbox-panel card" role="dialog" aria-label="Emails de prueba">
          <div className="outbox-head">
            <strong>Emails de prueba</strong>
            <button className="btn ghost small" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
          <p className="hint">Mientras no haya SMTP configurado, los correos no se envían: se muestran acá.</p>
          {mails.length === 0 ? (
            <p className="muted">Todavía no se generó ningún email.</p>
          ) : (
            <ul>
              {mails.map((m) => (
                <li key={m.id}>
                  <details open={m.id === mails[0].id}>
                    <summary>
                      <strong>{m.subject}</strong>
                      <span className="muted small">
                        Para {m.to} · {formatTime(m.sentAt)} h
                      </span>
                    </summary>
                    <pre>{linkify(m.text)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        className="outbox-toggle"
        onClick={() => {
          setOpen(!open)
          setSeenId(mails[0]?.id ?? 0)
        }}
      >
        ✉️ Emails de prueba
        {unread > 0 && <span className="count">{unread}</span>}
      </button>
    </div>
  )
}
