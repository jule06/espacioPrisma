export interface Professional {
  id: string
  name: string
  role: string
}

export interface ServiceItem {
  id: string
  name: string
  description: string
  durationMinutes: number
  price: number
  deposit: number
}

export interface BusinessInfo {
  name: string
  address: string
  hoursLabel: string
  depositPercent: number
  changeLimitHours: number
  holdMinutes: number
  bookingWindowDays: number
  professionals: Professional[]
  services: ServiceItem[]
}

export interface Slot {
  time: string
  start: string
  available: boolean
}

export type BookingStatus =
  | 'awaiting_receipt'
  | 'awaiting_approval'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export interface BankTransfer {
  holder: string
  alias: string
  cbu: string
  bank: string
}

export interface PublicBooking {
  code: string
  status: BookingStatus
  serviceId: string
  serviceName: string
  durationMinutes: number
  price: number
  deposit: number
  start: string
  end: string
  professional: { name: string; role: string } | null
  customer: { name: string }
  holdExpiresAt: string | null
  hasReceipt: boolean
  canChange: boolean
  rejectionReason: string | null
  bankTransfer: BankTransfer | null
}

export interface AdminBooking {
  id: string
  code: string
  status: BookingStatus
  serviceName: string
  price: number
  deposit: number
  start: string
  end: string
  professional: string
  customer: { name: string; phone: string; email: string }
  receipt: { originalName: string; mimetype: string; uploadedAt: string } | null
  inCalendar: boolean
  holdExpiresAt: string | null
  rejectionReason: string
  createdAt: string
}

export interface CalendarStatus {
  configured: boolean
  connected: boolean
  email: string | null
}

export interface OutboxMail {
  id: number
  to: string
  subject: string
  text: string
  sentAt: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const TOKEN_KEY = 'agenda.adminToken'

export const adminToken = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      // Sin almacenamiento disponible: la sesión dura lo que la pestaña.
    }
  },
}

async function request<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json')
  if (auth) headers.set('authorization', `Bearer ${adminToken.get() ?? ''}`)
  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    throw new ApiError('No pudimos conectar con el servidor.', 0)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error ?? 'No pudimos conectar con el servidor.', res.status)
  }
  return res.json()
}

const post = (body?: unknown): RequestInit => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
const q = encodeURIComponent

export const api = {
  business: () => request<BusinessInfo>('/business'),
  month: (month: string, serviceId?: string) =>
    request<{ days: Record<string, boolean> }>(`/availability/month?month=${month}&serviceId=${serviceId ?? ''}`),
  day: (date: string, serviceId?: string) =>
    request<{ slots: Slot[] }>(`/availability/day?date=${date}&serviceId=${serviceId ?? ''}`),
  createBooking: (data: { serviceId: string; start: string; name: string; phone: string; email: string }) =>
    request<PublicBooking>('/bookings', post(data)),
  getBooking: (code: string) => request<PublicBooking>(`/bookings/${q(code)}`),
  uploadReceipt: (code: string, file: File) => {
    const body = new FormData()
    body.append('receipt', file)
    return request<PublicBooking>(`/bookings/${q(code)}/receipt`, { method: 'POST', body })
  },
  reschedule: (code: string, start: string) => request<PublicBooking>(`/bookings/${q(code)}/reschedule`, post({ start })),
  cancel: (code: string) => request<PublicBooking>(`/bookings/${q(code)}/cancel`, post()),
  devOutbox: () => request<{ enabled: boolean; mails: OutboxMail[] }>('/dev/outbox'),

  admin: {
    authConfig: () => request<{ google: boolean; devLogin: boolean }>('/admin/auth/config'),
    /** Devuelve la URL de Google a la que hay que navegar. "calendar" requiere sesión. */
    googleStart: (purpose: 'login' | 'calendar') =>
      request<{ url: string }>('/admin/auth/google/start', post({ purpose }), purpose === 'calendar'),
    devLogin: () => request<{ token: string }>('/admin/auth/dev', post()),
    me: () => request<{ email: string }>('/admin/me', {}, true),
    status: () => request<{ calendar: CalendarStatus }>('/admin/status', {}, true),
    disconnectCalendar: () => request<{ calendar: CalendarStatus }>('/admin/calendar/disconnect', post(), true),
    pending: () => request<{ bookings: AdminBooking[] }>('/admin/bookings/pending', {}, true),
    upcoming: () => request<{ bookings: AdminBooking[] }>('/admin/bookings/upcoming', {}, true),
    awaitingReceipt: () => request<{ bookings: AdminBooking[] }>('/admin/bookings/awaiting-receipt', {}, true),
    confirm: (id: string) => request<{ booking: AdminBooking }>(`/admin/bookings/${id}/confirm`, post(), true),
    reject: (id: string, reason: string) => request<{ booking: AdminBooking }>(`/admin/bookings/${id}/reject`, post({ reason }), true),
    /** Descarga el comprobante con el token y devuelve una URL local para abrirlo. */
    receiptUrl: async (id: string) => {
      const res = await fetch(`/api/admin/bookings/${id}/receipt`, {
        headers: { authorization: `Bearer ${adminToken.get() ?? ''}` },
      })
      if (!res.ok) throw new ApiError('No se pudo abrir el comprobante.', res.status)
      return URL.createObjectURL(await res.blob())
    },
  },
}
