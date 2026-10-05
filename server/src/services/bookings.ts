import { DateTime } from 'luxon';
import { Booking, Business, Professional, Service, type BookingDoc } from '../models/index.js';
import { generateCode } from '../lib/code.js';
import { withBookingLock } from '../lib/lock.js';
import { zone } from '../lib/time.js';
import { pickProfessional } from './availability.js';
import { createEvent, deleteEvent } from './calendar.js';
import * as mail from './mailer.js';

export class BookingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const SLOT_TAKEN = 'Ese horario se acaba de ocupar. Elegí otro, por favor.';

async function getBusiness() {
  const business = await Business.findOne();
  if (!business) throw new BookingError('No hay datos del local. Corré `npm run seed`.', 500);
  return business;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    if (!(await Booking.exists({ code }))) return code;
  }
  throw new Error('No se pudo generar un código único');
}

export async function findByCode(code: string): Promise<BookingDoc> {
  const booking = await Booking.findOne({ code: code.trim().toUpperCase() });
  if (!booking) throw new BookingError('No encontramos un turno con ese código.', 404);
  return booking;
}

/** Datos del turno que puede ver la clienta con su código. */
export async function toPublic(booking: BookingDoc) {
  const [business, pro] = await Promise.all([getBusiness(), Professional.findById(booking.professional)]);
  return {
    code: booking.code,
    status: booking.status,
    serviceId: booking.service.toString(),
    serviceName: booking.serviceName,
    durationMinutes: booking.durationMinutes,
    price: booking.price,
    deposit: booking.deposit,
    start: booking.start.toISOString(),
    end: booking.end.toISOString(),
    professional: pro ? { name: pro.name, role: pro.role } : null,
    customer: { name: booking.customer.name },
    holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    hasReceipt: Boolean(booking.receipt?.filename),
    canChange: canChange(booking, business.changeLimitHours),
    rejectionReason: booking.rejectionReason || null,
    bankTransfer: booking.status === 'awaiting_receipt' ? business.bankTransfer : null,
  };
}

function canChange(booking: BookingDoc, limitHours: number): boolean {
  if (!['awaiting_receipt', 'awaiting_approval', 'confirmed'].includes(booking.status)) return false;
  return booking.start.getTime() - Date.now() >= limitHours * 3600_000;
}

export interface CreateBookingInput {
  serviceId: string;
  start: string;
  name: string;
  phone: string;
  email?: string;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingDoc> {
  const [business, service] = await Promise.all([getBusiness(), Service.findOne({ _id: input.serviceId, active: true })]);
  if (!service) throw new BookingError('El servicio no existe.', 404);

  const booking = await withBookingLock(async () => {
    const pro = await pickProfessional(input.start, service.durationMinutes);
    if (!pro) throw new BookingError(SLOT_TAKEN, 409);
    const start = DateTime.fromISO(input.start, { zone });
    return Booking.create({
      code: await uniqueCode(),
      status: 'awaiting_receipt',
      service: service._id,
      serviceName: service.name,
      durationMinutes: service.durationMinutes,
      price: service.price,
      deposit: Math.round((service.price * business.depositPercent) / 100),
      professional: pro._id,
      start: start.toJSDate(),
      end: start.plus({ minutes: service.durationMinutes }).toJSDate(),
      customer: { name: input.name.trim(), phone: input.phone.trim(), email: input.email?.trim() ?? '' },
      holdExpiresAt: DateTime.now().plus({ minutes: business.holdMinutes }).toJSDate(),
    });
  });
  await mail.sendBookingCreated(booking);
  return booking;
}

export async function attachReceipt(
  code: string,
  file: { filename: string; originalname: string; mimetype: string },
): Promise<BookingDoc> {
  const booking = await findByCode(code);
  if (booking.status === 'expired') {
    throw new BookingError('Se venció el tiempo para subir el comprobante. Reservá el turno de nuevo, por favor.', 410);
  }
  if (!['awaiting_receipt', 'awaiting_approval'].includes(booking.status)) {
    throw new BookingError('Este turno ya no admite comprobantes.', 409);
  }
  const isFirstReceipt = booking.status === 'awaiting_receipt';
  if (isFirstReceipt && booking.holdExpiresAt && booking.holdExpiresAt.getTime() < Date.now()) {
    // Se pasó del tiempo de espera: si el horario sigue libre lo mantenemos.
    await withBookingLock(async () => {
      const pro = await pickProfessional(booking.start.toISOString(), booking.durationMinutes, {
        id: booking._id,
        professional: booking.professional,
        start: booking.start,
        end: booking.end,
      });
      if (!pro) {
        booking.status = 'expired';
        await booking.save();
        throw new BookingError('Se venció el tiempo de espera y el horario ya se ocupó. Escribinos y lo resolvemos.', 410);
      }
      booking.professional = pro._id;
    });
  }
  booking.receipt = {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    uploadedAt: new Date(),
  };
  booking.status = 'awaiting_approval';
  booking.holdExpiresAt = undefined;
  await booking.save();

  if (isFirstReceipt) {
    await Promise.all([mail.sendBookingReceived(booking), mail.sendNewDepositToAdmin(booking)]);
  }
  return booking;
}

async function writeEvent(booking: BookingDoc): Promise<void> {
  const pro = await Professional.findById(booking.professional);
  if (!pro) return;
  booking.googleEventId = await createEvent({
    calendarId: pro.calendarId,
    start: booking.start,
    end: booking.end,
    summary: `${booking.serviceName} · ${booking.customer.name}`,
    description: [
      `Clienta: ${booking.customer.name}`,
      `Teléfono: ${booking.customer.phone}`,
      booking.customer.email ? `Email: ${booking.customer.email}` : '',
      `Seña: $${booking.deposit} (total $${booking.price})`,
      `Código: ${booking.code}`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

async function removeEvent(booking: BookingDoc): Promise<void> {
  if (!booking.googleEventId) return;
  const pro = await Professional.findById(booking.professional);
  await deleteEvent(pro?.calendarId ?? '', booking.googleEventId);
  booking.googleEventId = '';
}

export async function confirmBooking(id: string): Promise<BookingDoc> {
  const booking = await Booking.findById(id);
  if (!booking) throw new BookingError('Turno no encontrado.', 404);
  if (booking.status !== 'awaiting_approval') throw new BookingError('Este turno no está esperando aprobación.', 409);
  await writeEvent(booking);
  booking.status = 'confirmed';
  booking.confirmedAt = new Date();
  await booking.save();
  await mail.sendBookingConfirmed(booking);
  return booking;
}

export async function rejectBooking(id: string, reason = ''): Promise<BookingDoc> {
  const booking = await Booking.findById(id);
  if (!booking) throw new BookingError('Turno no encontrado.', 404);
  if (booking.status !== 'awaiting_approval') throw new BookingError('Este turno no está esperando aprobación.', 409);
  booking.status = 'rejected';
  booking.rejectionReason = reason.trim();
  await booking.save();
  await mail.sendBookingRejected(booking);
  return booking;
}

export async function rescheduleBooking(code: string, newStart: string): Promise<BookingDoc> {
  const [business, booking] = await Promise.all([getBusiness(), findByCode(code)]);
  if (!canChange(booking, business.changeLimitHours)) {
    throw new BookingError(`Los cambios se pueden hacer hasta ${business.changeLimitHours} horas antes del turno.`, 409);
  }

  await withBookingLock(async () => {
    const pro = await pickProfessional(newStart, booking.durationMinutes, {
      id: booking._id,
      professional: booking.professional,
      start: booking.start,
      end: booking.end,
      googleEventId: booking.googleEventId,
    });
    if (!pro) throw new BookingError(SLOT_TAKEN, 409);

    const wasConfirmed = booking.status === 'confirmed';
    if (wasConfirmed) await removeEvent(booking);
    const start = DateTime.fromISO(newStart, { zone });
    booking.start = start.toJSDate();
    booking.end = start.plus({ minutes: booking.durationMinutes }).toJSDate();
    booking.professional = pro._id;
    booking.customerReminderSentAt = undefined;
    if (wasConfirmed) await writeEvent(booking);
    await booking.save();
  });

  await mail.sendBookingRescheduled(booking);
  return booking;
}

export async function cancelBooking(code: string): Promise<BookingDoc> {
  const [business, booking] = await Promise.all([getBusiness(), findByCode(code)]);
  if (!canChange(booking, business.changeLimitHours)) {
    throw new BookingError(`Las cancelaciones se pueden hacer hasta ${business.changeLimitHours} horas antes del turno.`, 409);
  }
  await removeEvent(booking);
  booking.status = 'cancelled';
  await booking.save();
  await mail.sendBookingCancelled(booking);
  return booking;
}
