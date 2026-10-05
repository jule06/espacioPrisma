import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { Business, Professional, type BookingDoc } from '../models/index.js';
import { formatLong, formatMoney } from '../lib/time.js';

const smtpEnabled = Boolean(config.smtp.host);

const transport = smtpEnabled
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

if (!smtpEnabled) console.warn('[mail] SMTP no configurado: los correos se muestran en la consola y en la bandeja de prueba del front.');

export interface OutboxMail {
  id: number;
  to: string;
  subject: string;
  text: string;
  sentAt: string;
}

// Mientras no haya SMTP, los correos quedan acá para verlos desde el front (solo en desarrollo).
const outbox: OutboxMail[] = [];
let nextId = 1;

export const devOutboxEnabled = () => !smtpEnabled && !config.isProduction;
export const devOutbox = () => outbox;

async function send(to: string | undefined, subject: string, text: string): Promise<void> {
  if (!to) return;
  try {
    const info = await transport.sendMail({ from: config.mailFrom, to, subject, text });
    if (!smtpEnabled) {
      console.log(`[mail] → ${to} | ${subject}\n${text}\n`);
      outbox.unshift({ id: nextId++, to, subject, text, sentAt: new Date().toISOString() });
      outbox.length = Math.min(outbox.length, 50);
    }
    else console.log(`[mail] enviado a ${to}: ${subject} (${info.messageId})`);
  } catch (err) {
    // Un correo que falla no debe romper la reserva.
    console.error(`[mail] error enviando "${subject}" a ${to}:`, err);
  }
}

async function context(booking: BookingDoc) {
  const [business, pro] = await Promise.all([Business.findOne(), Professional.findById(booking.professional)]);
  return {
    businessName: business?.name ?? 'El local',
    address: business?.address ?? '',
    proName: pro?.name ?? '',
    when: formatLong(booking.start),
    manageUrl: `${config.clientUrl}/?codigo=${booking.code}`,
  };
}

function summary(booking: BookingDoc, c: Awaited<ReturnType<typeof context>>) {
  return [
    `Servicio: ${booking.serviceName}`,
    `Día y hora: ${c.when}`,
    `Te atiende: ${c.proName}`,
    `Total: ${formatMoney(booking.price)} (seña ${formatMoney(booking.deposit)}, se descuenta del total)`,
    `Código de tu turno: ${booking.code}`,
  ].join('\n');
}

export async function sendBookingCreated(booking: BookingDoc) {
  const [c, business] = await Promise.all([context(booking), Business.findOne()]);
  const bank = business?.bankTransfer;
  const bankLines = bank
    ? [bank.alias && `Alias: ${bank.alias}`, bank.cbu && `CBU/CVU: ${bank.cbu}`, bank.holder && `Titular: ${bank.holder}`, bank.bank && `Banco: ${bank.bank}`]
        .filter(Boolean)
        .join('\n')
    : '';
  await send(
    booking.customer.email,
    `Reservaste tu turno · falta la seña · ${c.businessName}`,
    `Hola ${booking.customer.name},\n\nTe guardamos el horario por ${business?.holdMinutes ?? 60} minutos. Para confirmarlo, transferí la seña de ${formatMoney(booking.deposit)} y subí el comprobante.\n\n${summary(booking, c)}\n\n${bankLines}\n\nSubí el comprobante y gestioná tu turno acá: ${c.manageUrl}`,
  );
}

export async function sendBookingReceived(booking: BookingDoc) {
  const c = await context(booking);
  await send(
    booking.customer.email,
    `Recibimos tu comprobante · ${c.businessName}`,
    `Hola ${booking.customer.name},\n\nRecibimos el comprobante de tu seña. Te avisamos apenas el local la confirme.\n\n${summary(booking, c)}\n\nPodés ver, cambiar o cancelar tu turno acá: ${c.manageUrl}`,
  );
}

export async function sendBookingConfirmed(booking: BookingDoc) {
  const c = await context(booking);
  await send(
    booking.customer.email,
    `Tu turno está confirmado · ${c.businessName}`,
    `Hola ${booking.customer.name},\n\n¡Tu turno está confirmado!\n\n${summary(booking, c)}\n${c.address ? `Dirección: ${c.address}\n` : ''}\nPodés cambiar el día u horario sin costo hasta 24 horas antes: ${c.manageUrl}`,
  );
}

export async function sendBookingRejected(booking: BookingDoc) {
  const c = await context(booking);
  await send(
    booking.customer.email,
    `No pudimos confirmar tu seña · ${c.businessName}`,
    `Hola ${booking.customer.name},\n\nNo pudimos confirmar la seña de tu turno del ${c.when}.${booking.rejectionReason ? `\nMotivo: ${booking.rejectionReason}` : ''}\n\nSi creés que es un error, escribinos y lo revisamos.`,
  );
}

export async function sendBookingRescheduled(booking: BookingDoc) {
  const c = await context(booking);
  await send(
    booking.customer.email,
    `Cambiaste tu turno · ${c.businessName}`,
    `Hola ${booking.customer.name},\n\nTu turno quedó para el nuevo horario.\n\n${summary(booking, c)}\n\nVer tu turno: ${c.manageUrl}`,
  );
}

export async function sendBookingCancelled(booking: BookingDoc) {
  const c = await context(booking);
  await send(
    booking.customer.email,
    `Cancelaste tu turno · ${c.businessName}`,
    `Hola ${booking.customer.name},\n\nCancelaste tu turno de ${booking.serviceName} del ${c.when}. La seña no se reintegra.\n\n¡Te esperamos cuando quieras volver!`,
  );
  await send(
    config.notifyEmail,
    `Turno cancelado: ${booking.customer.name} · ${booking.code}`,
    `${booking.customer.name} (${booking.customer.phone}) canceló su turno.\n\n${summary(booking, c)}`,
  );
}

export async function sendCustomerReminder(booking: BookingDoc) {
  const c = await context(booking);
  await send(
    booking.customer.email,
    `Mañana tenés turno · ${c.businessName}`,
    `Hola ${booking.customer.name},\n\nTe recordamos tu turno de mañana.\n\n${summary(booking, c)}\n${c.address ? `Dirección: ${c.address}\n` : ''}\nVer tu turno: ${c.manageUrl}`,
  );
}

export async function sendNewDepositToAdmin(booking: BookingDoc) {
  const c = await context(booking);
  await send(
    config.notifyEmail,
    `Seña nueva para confirmar: ${booking.customer.name} · ${formatMoney(booking.deposit)}`,
    `Llegó un comprobante nuevo.\n\nClienta: ${booking.customer.name} · ${booking.customer.phone}\n${summary(booking, c)}\n\nConfirmala en el panel: ${config.clientUrl}/panel`,
  );
}

export async function sendApprovalReminderToAdmin(booking: BookingDoc) {
  const c = await context(booking);
  await send(
    config.notifyEmail,
    `Recordatorio: seña sin confirmar de ${booking.customer.name}`,
    `La seña de ${booking.customer.name} lleva más de una hora esperando tu aprobación.\n\n${summary(booking, c)}\n\nPanel: ${config.clientUrl}/panel`,
  );
}
