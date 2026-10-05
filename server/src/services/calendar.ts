import { google, type calendar_v3 } from 'googleapis';
import { config } from '../config.js';
import { GoogleConnection } from '../models/index.js';
import { isGoogleConfigured, oauthClient } from './google.js';

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface CalendarEventInput {
  calendarId: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
}

// Si la profesional no tiene un calendario propio cargado, se usa el principal de la cuenta conectada.
const resolveId = (calendarId: string) => calendarId || 'primary';

let cached: { refreshToken: string; client: calendar_v3.Calendar } | null = null;

/**
 * Cliente de Google Calendar con la cuenta conectada desde el panel (OAuth2).
 * Devuelve null si no hay cuenta conectada: la agenda funciona solo con MongoDB.
 */
async function getClient(): Promise<calendar_v3.Calendar | null> {
  if (!isGoogleConfigured()) return null;
  const connection = await GoogleConnection.findOne();
  if (!connection) return null;
  if (cached?.refreshToken !== connection.refreshToken) {
    const auth = oauthClient();
    auth.setCredentials({ refresh_token: connection.refreshToken });
    cached = { refreshToken: connection.refreshToken, client: google.calendar({ version: 'v3', auth }) };
  }
  return cached.client;
}

/** Si Google revocó el acceso (contraseña cambiada, permiso quitado), se desconecta para no romper la agenda. */
async function handleAuthError(err: unknown): Promise<never> {
  const message = String((err as { message?: string }).message ?? '');
  if (message.includes('invalid_grant')) {
    await GoogleConnection.deleteMany({});
    cached = null;
    console.error('[calendar] Google revocó el acceso. Volvé a conectar el calendario desde el panel.');
  }
  throw err;
}

export async function calendarStatus() {
  const connection = isGoogleConfigured() ? await GoogleConnection.findOne() : null;
  return { configured: isGoogleConfigured(), connected: Boolean(connection), email: connection?.email ?? null };
}

/** Horarios ocupados de varios calendarios entre `from` y `to`, por calendarId. */
export async function getBusy(calendarIds: string[], from: Date, to: Date): Promise<Map<string, BusyInterval[]>> {
  const result = new Map<string, BusyInterval[]>();
  const cal = await getClient();
  if (!cal || calendarIds.length === 0) return result;

  const ids = [...new Set(calendarIds.map(resolveId))];
  const res = await cal.freebusy
    .query({ requestBody: { timeMin: from.toISOString(), timeMax: to.toISOString(), items: ids.map((id) => ({ id })) } })
    .catch(handleAuthError);

  for (const original of calendarIds) {
    const id = resolveId(original);
    const entry = res.data.calendars?.[id];
    if (entry?.errors?.length) {
      throw new Error(`[calendar] No se pudo leer el calendario ${id}: ${entry.errors.map((e) => e.reason).join(', ')}`);
    }
    result.set(original, (entry?.busy ?? []).map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) })));
  }
  return result;
}

export async function createEvent(input: CalendarEventInput): Promise<string> {
  const cal = await getClient();
  if (!cal) return '';
  const res = await cal.events
    .insert({
      calendarId: resolveId(input.calendarId),
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString(), timeZone: config.timezone },
        end: { dateTime: input.end.toISOString(), timeZone: config.timezone },
      },
    })
    .catch(handleAuthError);
  return res.data.id ?? '';
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const cal = await getClient();
  if (!cal || !eventId) return;
  try {
    await cal.events.delete({ calendarId: resolveId(calendarId), eventId });
  } catch (err: unknown) {
    // Si ya lo borraron a mano desde el calendario no es un error.
    const status = (err as { code?: number }).code;
    if (status !== 404 && status !== 410) await handleAuthError(err);
  }
}
