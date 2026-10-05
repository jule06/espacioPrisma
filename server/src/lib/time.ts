import { DateTime } from 'luxon';
import { config } from '../config.js';

export const zone = config.timezone;

/** "2026-10-06" → inicio de ese día en la zona horaria del local. */
export function dayStart(isoDate: string): DateTime {
  const dt = DateTime.fromISO(isoDate, { zone });
  if (!dt.isValid) throw new Error(`Fecha inválida: ${isoDate}`);
  return dt.startOf('day');
}

/** Combina un día con una hora "HH:mm" en la zona del local. */
export function atTime(day: DateTime, hhmm: string): DateTime {
  const [h, m] = hhmm.split(':').map(Number);
  return day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

export function toLocal(date: Date): DateTime {
  return DateTime.fromJSDate(date, { zone });
}

/** "martes 6 de octubre, 16:00 h" */
export function formatLong(date: Date): string {
  return toLocal(date).setLocale('es-AR').toFormat("cccc d 'de' LLLL, HH:mm 'h'");
}

export function formatMoney(n: number): string {
  return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}
