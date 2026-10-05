import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { Booking, GoogleConnection, Professional, type BookingDoc } from '../models/index.js';
import { confirmBooking, rejectBooking } from '../services/bookings.js';
import { calendarStatus } from '../services/calendar.js';
import { authUrl, exchangeCode, isGoogleConfigured, oauthClient } from '../services/google.js';

export const adminRouter = Router();

const STATE_COOKIE = 'oauth_state';
const devLoginEnabled = () => !isGoogleConfigured() && !config.isProduction;

interface Session {
  email: string;
}

const signSession = (email: string) => jwt.sign({ email } satisfies Session, config.jwtSecret, { expiresIn: '7d' });

function readSession(req: Request): Session | null {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    return jwt.verify(token, config.jwtSecret) as Session;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const firstHeader = (value: string | string[] | undefined) => String(Array.isArray(value) ? value[0] : (value ?? '')).split(',')[0].trim();

/**
 * Dirección pública desde la que se abrió el panel (localhost, túnel o dominio), si está permitida.
 * Los túneles (Dev Tunnels, ngrok, Cloudflare) reescriben Origin/Host a localhost y mandan la dirección real
 * en X-Forwarded-Host, así que esa se mira primero.
 */
function requestOrigin(req: Request): string {
  const forwardedHost = firstHeader(req.headers['x-forwarded-host']);
  const forwardedProto = firstHeader(req.headers['x-forwarded-proto']) || 'https';
  const candidates = [
    forwardedHost && `${forwardedProto}://${forwardedHost}`,
    firstHeader(req.headers.origin),
    (() => {
      try {
        return new URL(firstHeader(req.headers.referer)).origin;
      } catch {
        return '';
      }
    })(),
  ].map((o) => o.replace(/\/$/, ''));
  return candidates.find((o) => config.appOrigins.includes(o)) ?? config.clientUrl;
}

/** Vuelve al panel pasando el resultado en el hash (no viaja al servidor ni queda en logs). */
function backToPanel(res: Response, origin: string, params: Record<string, string>) {
  res.redirect(`${origin}/panel#${new URLSearchParams(params)}`);
}

// ---------- Autenticación ----------

adminRouter.get('/auth/config', (_req, res) => {
  res.json({ google: isGoogleConfigured(), devLogin: devLoginEnabled() });
});

/**
 * Arranca el flujo OAuth2. Devuelve la URL de Google; el cliente navega hacia ella.
 * - login: cualquiera puede iniciarlo, pero solo entran los emails de ADMIN_EMAILS.
 * - calendar: requiere sesión; conecta la cuenta cuyo calendario se va a usar.
 */
adminRouter.post('/auth/google/start', (req, res) => {
  if (!isGoogleConfigured()) return res.status(503).json({ error: 'Google todavía no está configurado en el servidor.' });
  const { purpose } = z.object({ purpose: z.enum(['login', 'calendar']) }).parse(req.body);
  if (purpose === 'calendar' && !readSession(req)) return res.status(401).json({ error: 'Sesión vencida. Volvé a ingresar.' });

  const origin = requestOrigin(req);
  console.log(
    `[auth] inicio ${purpose} desde ${origin} (origin=${req.headers.origin ?? '-'} x-forwarded-host=${req.headers['x-forwarded-host'] ?? '-'} referer=${req.headers.referer ?? '-'})`,
  );

  const nonce = randomBytes(16).toString('hex');
  const state = jwt.sign({ purpose, nonce, origin }, config.jwtSecret, { expiresIn: '10m' });
  res.cookie(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: 10 * 60 * 1000,
    path: '/api/admin/auth',
  });
  res.json({ url: authUrl(purpose, state, origin) });
});

adminRouter.get('/auth/google/callback', async (req, res) => {
  res.clearCookie(STATE_COOKIE, { path: '/api/admin/auth' });
  let purpose: 'login' | 'calendar';
  let origin = config.clientUrl;
  try {
    const state = jwt.verify(String(req.query.state ?? ''), config.jwtSecret) as { purpose: typeof purpose; nonce: string; origin: string };
    if (config.appOrigins.includes(state.origin)) origin = state.origin;
    const cookieNonce = readCookie(req, STATE_COOKIE);
    if (!cookieNonce || !safeEqual(cookieNonce, state.nonce)) throw new Error('state');
    purpose = state.purpose;
  } catch {
    return backToPanel(res, origin, { error: 'La sesión con Google venció. Probá de nuevo.' });
  }
  if (typeof req.query.error === 'string') return backToPanel(res, origin, { error: 'Se canceló el ingreso con Google.' });

  try {
    const { email, tokens } = await exchangeCode(String(req.query.code ?? ''), origin);
    if (purpose === 'login') {
      if (!config.adminEmails.includes(email)) {
        return backToPanel(res, origin, { error: `La cuenta ${email} no tiene acceso al panel.` });
      }
      return backToPanel(res, origin, { token: signSession(email) });
    }

    if (!tokens.refresh_token) {
      return backToPanel(res, origin, { error: 'Google no dio acceso permanente al calendario. Probá conectar de nuevo.' });
    }
    const granted = tokens.scope ?? '';
    if (!granted.includes('calendar.events') || !granted.includes('calendar.freebusy')) {
      return backToPanel(res, origin, { error: 'Para conectar el calendario hay que aceptar todos los permisos.' });
    }
    await GoogleConnection.deleteMany({});
    await GoogleConnection.create({ email, refreshToken: tokens.refresh_token, scope: granted });
    backToPanel(res, origin, { calendar: 'connected' });
  } catch (err) {
    console.error('[auth] error en el callback de Google:', err);
    backToPanel(res, origin, { error: 'No pudimos completar el ingreso con Google.' });
  }
});

/** Solo en desarrollo y mientras no haya credenciales de Google. */
adminRouter.post('/auth/dev', (_req, res) => {
  if (!devLoginEnabled()) return res.status(404).json({ error: 'No disponible' });
  res.json({ token: signSession('dev@localhost') });
});

const requireAdmin: RequestHandler = (req, res, next) => {
  const session = readSession(req);
  // Si sacan un email de ADMIN_EMAILS, su sesión deja de valer en el próximo pedido.
  const allowed = session && (config.adminEmails.includes(session.email) || (session.email === 'dev@localhost' && devLoginEnabled()));
  if (!allowed) return res.status(401).json({ error: 'Sesión vencida. Volvé a ingresar.' });
  res.locals.session = session;
  next();
};

adminRouter.use(requireAdmin);

adminRouter.get('/me', (_req, res) => {
  res.json({ email: (res.locals.session as Session).email });
});

// ---------- Google Calendar ----------

adminRouter.get('/status', async (_req, res) => {
  res.json({ calendar: await calendarStatus() });
});

adminRouter.post('/calendar/disconnect', async (_req, res) => {
  const connection = await GoogleConnection.findOne();
  if (connection) {
    await oauthClient()
      .revokeToken(connection.refreshToken)
      .catch(() => undefined);
    await GoogleConnection.deleteMany({});
  }
  res.json({ calendar: await calendarStatus() });
});

// ---------- Turnos ----------

async function toAdmin(bookings: BookingDoc[]) {
  const pros = await Professional.find({ _id: { $in: bookings.map((b) => b.professional) } });
  const proName = new Map(pros.map((p) => [p.id, p.name]));
  return bookings.map((b) => ({
    id: b.id,
    code: b.code,
    status: b.status,
    serviceName: b.serviceName,
    price: b.price,
    deposit: b.deposit,
    start: b.start.toISOString(),
    end: b.end.toISOString(),
    professional: proName.get(b.professional.toString()) ?? '',
    customer: b.customer,
    receipt: b.receipt?.filename
      ? { originalName: b.receipt.originalName, mimetype: b.receipt.mimetype, uploadedAt: b.receipt.uploadedAt }
      : null,
    inCalendar: Boolean(b.googleEventId),
    holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
    rejectionReason: b.rejectionReason,
    createdAt: (b as unknown as { createdAt: Date }).createdAt,
  }));
}

/** Señas esperando aprobación (lo que se ve en el panel). */
adminRouter.get('/bookings/pending', async (_req, res) => {
  const bookings = await Booking.find({ status: 'awaiting_approval' }).sort({ 'receipt.uploadedAt': 1 });
  res.json({ bookings: await toAdmin(bookings) });
});

/** Reservas que todavía no subieron el comprobante (el horario está guardado hasta que vence la espera). */
adminRouter.get('/bookings/awaiting-receipt', async (_req, res) => {
  const bookings = await Booking.find({ status: 'awaiting_receipt', holdExpiresAt: { $gt: new Date() } }).sort({ start: 1 });
  res.json({ bookings: await toAdmin(bookings) });
});

/** Próximos turnos confirmados. */
adminRouter.get('/bookings/upcoming', async (_req, res) => {
  const bookings = await Booking.find({ status: 'confirmed', end: { $gte: new Date() } })
    .sort({ start: 1 })
    .limit(100);
  res.json({ bookings: await toAdmin(bookings) });
});

adminRouter.get('/bookings/:id/receipt', async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking?.receipt?.filename) return res.status(404).json({ error: 'Sin comprobante.' });
  res.type(booking.receipt.mimetype ?? 'application/octet-stream');
  res.sendFile(path.join(config.uploadsDir, path.basename(booking.receipt.filename)));
});

adminRouter.post('/bookings/:id/confirm', async (req, res) => {
  const booking = await confirmBooking(req.params.id);
  res.json({ booking: (await toAdmin([booking]))[0] });
});

adminRouter.post('/bookings/:id/reject', async (req, res) => {
  const { reason } = z.object({ reason: z.string().max(300).optional() }).parse(req.body ?? {});
  const booking = await rejectBooking(req.params.id, reason);
  res.json({ booking: (await toAdmin([booking]))[0] });
});
