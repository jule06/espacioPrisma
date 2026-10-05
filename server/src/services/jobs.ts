import cron from 'node-cron';
import { DateTime } from 'luxon';
import { Booking } from '../models/index.js';
import { zone } from '../lib/time.js';
import { sendApprovalReminderToAdmin, sendCustomerReminder } from './mailer.js';

// Desde qué hora del día anterior se mandan los recordatorios a las clientas.
const CUSTOMER_REMINDER_HOUR = 10;

async function expireHolds() {
  const res = await Booking.updateMany(
    { status: 'awaiting_receipt', holdExpiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } },
  );
  if (res.modifiedCount) console.log(`[jobs] ${res.modifiedCount} reservas vencidas sin comprobante`);
}

async function remindAdmin() {
  const hourAgo = DateTime.now().minus({ hours: 1 }).toJSDate();
  const pending = await Booking.find({
    status: 'awaiting_approval',
    'receipt.uploadedAt': { $lt: hourAgo },
    approvalReminderSentAt: null,
  });
  for (const booking of pending) {
    await sendApprovalReminderToAdmin(booking);
    booking.approvalReminderSentAt = new Date();
    await booking.save();
  }
}

async function remindCustomers() {
  const now = DateTime.now().setZone(zone);
  if (now.hour < CUSTOMER_REMINDER_HOUR) return;
  const tomorrow = now.startOf('day').plus({ days: 1 });
  const bookings = await Booking.find({
    status: 'confirmed',
    start: { $gte: tomorrow.toJSDate(), $lt: tomorrow.plus({ days: 1 }).toJSDate() },
    customerReminderSentAt: null,
    'customer.email': { $ne: '' },
  });
  for (const booking of bookings) {
    await sendCustomerReminder(booking);
    booking.customerReminderSentAt = new Date();
    await booking.save();
  }
}

async function runAll() {
  for (const job of [expireHolds, remindAdmin, remindCustomers]) {
    try {
      await job();
    } catch (err) {
      console.error(`[jobs] error en ${job.name}:`, err);
    }
  }
}

export function startJobs() {
  cron.schedule('*/5 * * * *', runAll, { timezone: zone });
  void runAll();
}
