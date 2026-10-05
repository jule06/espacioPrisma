import { DateTime } from 'luxon';
import type { Types } from 'mongoose';
import { BLOCKING_STATUSES, Booking, Business, Professional, type BusinessDoc, type ProfessionalDoc } from '../models/index.js';
import { atTime, dayStart, zone } from '../lib/time.js';
import { getBusy, type BusyInterval } from './calendar.js';

export interface Slot {
  time: string; // "16:00"
  start: string; // ISO
  available: boolean;
}

interface Context {
  business: BusinessDoc;
  pros: ProfessionalDoc[];
  busyByPro: Map<string, BusyInterval[]>;
  now: DateTime;
}

interface ExcludeBooking {
  id: Types.ObjectId;
  professional: Types.ObjectId;
  start: Date;
  end: Date;
  googleEventId?: string | null;
}

const overlaps = (aStart: number, aEnd: number, b: BusyInterval) => aStart < b.end.getTime() && b.start.getTime() < aEnd;

/** Quita un intervalo de una lista de ocupados (para ignorar el propio turno al reprogramar). */
function subtract(busy: BusyInterval[], cut: { start: Date; end: Date }): BusyInterval[] {
  const out: BusyInterval[] = [];
  for (const b of busy) {
    if (!overlaps(cut.start.getTime(), cut.end.getTime(), b)) {
      out.push(b);
      continue;
    }
    if (b.start < cut.start) out.push({ start: b.start, end: cut.start });
    if (b.end > cut.end) out.push({ start: cut.end, end: b.end });
  }
  return out;
}

/** Carga profesionales y horarios ocupados (Google Calendar + reservas en Mongo) para un rango. */
async function loadContext(from: DateTime, to: DateTime, exclude?: ExcludeBooking): Promise<Context> {
  const business = await Business.findOne();
  if (!business) throw new Error('No hay datos del local. Corré `npm run seed`.');
  const pros = await Professional.find({ active: true }).sort({ order: 1 });

  const fromDate = from.toJSDate();
  const toDate = to.toJSDate();
  const [googleBusy, bookings] = await Promise.all([
    getBusy(pros.map((p) => p.calendarId), fromDate, toDate),
    Booking.find({
      status: { $in: BLOCKING_STATUSES },
      start: { $lt: toDate },
      end: { $gt: fromDate },
      ...(exclude ? { _id: { $ne: exclude.id } } : {}),
    }).select('professional start end status holdExpiresAt'),
  ]);

  const now = DateTime.now().setZone(zone);
  const busyByPro = new Map<string, BusyInterval[]>();
  for (const pro of pros) {
    let busy = [...(googleBusy.get(pro.calendarId) ?? [])];
    if (exclude?.googleEventId && exclude.professional.equals(pro._id)) busy = subtract(busy, exclude);
    busyByPro.set(pro.id, busy);
  }
  for (const b of bookings) {
    // Las reservas sin comprobante dejan de ocupar el horario cuando vence la espera.
    if (b.status === 'awaiting_receipt' && b.holdExpiresAt && b.holdExpiresAt.getTime() < now.toMillis()) continue;
    busyByPro.get(b.professional.toString())?.push({ start: b.start, end: b.end });
  }
  return { business, pros, busyByPro, now };
}

function workingRange(pro: ProfessionalDoc, day: DateTime) {
  const wh = pro.workingHours.find((w) => w.weekday === day.weekday);
  return wh ? { start: atTime(day, wh.start), end: atTime(day, wh.end) } : null;
}

/** Profesionales libres para [start, start+duration), ordenadas por menos carga ese día. */
function freePros(ctx: Context, start: DateTime, durationMinutes: number): ProfessionalDoc[] {
  const end = start.plus({ minutes: durationMinutes });
  const day = start.startOf('day');
  const dayEnd = day.plus({ days: 1 });
  const candidates: { pro: ProfessionalDoc; load: number }[] = [];

  for (const pro of ctx.pros) {
    const range = workingRange(pro, day);
    if (!range || start < range.start || end > range.end) continue;
    const busy = ctx.busyByPro.get(pro.id) ?? [];
    if (busy.some((b) => overlaps(start.toMillis(), end.toMillis(), b))) continue;
    const load = busy
      .filter((b) => overlaps(day.toMillis(), dayEnd.toMillis(), b))
      .reduce((sum, b) => sum + (b.end.getTime() - b.start.getTime()), 0);
    candidates.push({ pro, load });
  }
  return candidates.sort((a, b) => a.load - b.load).map((c) => c.pro);
}

function isBookableTime(ctx: Context, start: DateTime): boolean {
  const earliest = ctx.now.plus({ minutes: ctx.business.minLeadMinutes });
  const latest = ctx.now.startOf('day').plus({ days: ctx.business.bookingWindowDays + 1 });
  return start >= earliest && start < latest;
}

function slotsForDay(ctx: Context, day: DateTime, durationMinutes: number): Slot[] {
  const ranges = ctx.pros.map((p) => workingRange(p, day)).filter((r) => r !== null);
  if (ranges.length === 0) return [];
  const open = DateTime.min(...ranges.map((r) => r.start))!;
  const close = DateTime.max(...ranges.map((r) => r.end))!;

  const slots: Slot[] = [];
  for (let t = open; t.plus({ minutes: durationMinutes }) <= close; t = t.plus({ minutes: ctx.business.slotStepMinutes })) {
    slots.push({
      time: t.toFormat('HH:mm'),
      start: t.toISO()!,
      available: isBookableTime(ctx, t) && freePros(ctx, t, durationMinutes).length > 0,
    });
  }
  return slots;
}

export async function getDaySlots(isoDate: string, durationMinutes: number): Promise<Slot[]> {
  const day = dayStart(isoDate);
  const ctx = await loadContext(day, day.plus({ days: 1 }));
  return slotsForDay(ctx, day, durationMinutes);
}

/** Para el calendario mensual: qué días tienen al menos un horario libre. */
export async function getMonthAvailability(month: string, durationMinutes: number): Promise<Record<string, boolean>> {
  const first = DateTime.fromISO(`${month}-01`, { zone }).startOf('month');
  if (!first.isValid) throw new Error(`Mes inválido: ${month}`);
  const ctx = await loadContext(first, first.plus({ months: 1 }));
  const days: Record<string, boolean> = {};
  for (let d = first; d.month === first.month; d = d.plus({ days: 1 })) {
    days[d.toISODate()!] = slotsForDay(ctx, d, durationMinutes).some((s) => s.available);
  }
  return days;
}

/**
 * Elige la profesional para un turno, o null si el horario ya no está libre.
 * Se llama dentro de withBookingLock para que no se pisen dos reservas.
 */
export async function pickProfessional(
  startISO: string,
  durationMinutes: number,
  exclude?: ExcludeBooking,
): Promise<ProfessionalDoc | null> {
  const start = DateTime.fromISO(startISO, { zone });
  if (!start.isValid) return null;
  const day = start.startOf('day');
  const ctx = await loadContext(day, day.plus({ days: 1 }), exclude);
  if (!isBookableTime(ctx, start)) return null;
  // Tiene que coincidir con la grilla de horarios que se ofrece.
  if (!slotsForDay(ctx, day, durationMinutes).some((s) => s.time === start.toFormat('HH:mm'))) return null;
  const free = freePros(ctx, start, durationMinutes);
  // Al reprogramar, si la misma profesional está libre, se mantiene.
  return free.find((p) => exclude?.professional.equals(p._id)) ?? free[0] ?? null;
}
