// Todas las fechas se muestran en la zona horaria del local.
export const TZ = 'America/Argentina/Buenos_Aires'

export const money = (n: number) => '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-AR', { timeZone: TZ, ...opts })

const longDay = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
const time = fmt({ hour: '2-digit', minute: '2-digit', hour12: false })
const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "martes 6 de octubre" */
export const formatDay = (iso: string) => longDay.format(new Date(iso)).replace(',', '')
/** "16:00" */
export const formatTime = (iso: string) => time.format(new Date(iso))
/** "martes 6 de octubre, 16:00 a 17:00 h" */
export const formatRange = (start: string, end: string) => `${formatDay(start)}, ${formatTime(start)} a ${formatTime(end)} h`

/** Fecha "YYYY-MM-DD" de hoy en la zona del local. */
export const todayKey = () => isoDay.format(new Date())

/** "YYYY-MM-DD" → "martes 6 de octubre". Usa el mediodía para no correrse de día. */
export const formatDateKey = (key: string) => formatDay(`${key}T12:00:00-03:00`)

/** "YYYY-MM-DD" del inicio de un turno, en la zona del local. */
export const dateKeyOf = (iso: string) => isoDay.format(new Date(iso))

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} días`
}
