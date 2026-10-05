import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { Business, Professional, Service } from '../models/index.js';
import { getDaySlots, getMonthAvailability } from '../services/availability.js';
import { devOutbox, devOutboxEnabled } from '../services/mailer.js';
import { attachReceipt, cancelBooking, createBooking, findByCode, rescheduleBooking, toPublic } from '../services/bookings.js';

export const publicRouter = Router();

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, RECEIPT_TYPES.includes(file.mimetype)),
});

/** Datos del local, profesionales y servicios para armar la página. */
publicRouter.get('/business', async (_req, res) => {
  const [business, pros, services] = await Promise.all([
    Business.findOne(),
    Professional.find({ active: true }).sort({ order: 1 }),
    Service.find({ active: true }).sort({ order: 1 }),
  ]);
  if (!business) return res.status(500).json({ error: 'No hay datos del local. Corré `npm run seed`.' });
  res.json({
    name: business.name,
    address: business.address,
    hoursLabel: business.hoursLabel,
    depositPercent: business.depositPercent,
    changeLimitHours: business.changeLimitHours,
    holdMinutes: business.holdMinutes,
    bookingWindowDays: business.bookingWindowDays,
    professionals: pros.map((p) => ({ id: p.id, name: p.name, role: p.role })),
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price,
      deposit: Math.round((s.price * business.depositPercent) / 100),
    })),
  });
});

async function durationFor(serviceId: unknown): Promise<number> {
  if (typeof serviceId === 'string' && serviceId) {
    const service = await Service.findById(serviceId);
    if (service) return service.durationMinutes;
  }
  // Sin servicio elegido se muestran los días con al menos el turno más corto libre.
  const shortest = await Service.findOne({ active: true }).sort({ durationMinutes: 1 });
  return shortest?.durationMinutes ?? 30;
}

publicRouter.get('/availability/month', async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.query.month);
  res.json({ days: await getMonthAvailability(month, await durationFor(req.query.serviceId)) });
});

publicRouter.get('/availability/day', async (req, res) => {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date);
  res.json({ slots: await getDaySlots(date, await durationFor(req.query.serviceId)) });
});

const createSchema = z.object({
  serviceId: z.string().min(1),
  start: z.string().min(1),
  name: z.string().trim().min(3, 'Ingresá tu nombre y apellido').max(100),
  phone: z.string().trim().regex(/^[\d\s()+-]{8,20}$/, 'Ingresá un teléfono válido'),
  email: z.union([z.literal(''), z.email('Ingresá un correo válido')]).optional(),
});

publicRouter.post('/bookings', async (req, res) => {
  const booking = await createBooking(createSchema.parse(req.body));
  res.status(201).json(await toPublic(booking));
});

publicRouter.get('/bookings/:code', async (req, res) => {
  res.json(await toPublic(await findByCode(req.params.code)));
});

publicRouter.post('/bookings/:code/receipt', upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Subí una foto o PDF del comprobante (máximo 8 MB).' });
  const booking = await attachReceipt(String(req.params.code), req.file);
  res.json(await toPublic(booking));
});

publicRouter.post('/bookings/:code/reschedule', async (req, res) => {
  const { start } = z.object({ start: z.string().min(1) }).parse(req.body);
  res.json(await toPublic(await rescheduleBooking(req.params.code, start)));
});

publicRouter.post('/bookings/:code/cancel', async (req, res) => {
  res.json(await toPublic(await cancelBooking(req.params.code)));
});

/** Bandeja de correos de prueba: solo en desarrollo y sin SMTP configurado. */
publicRouter.get('/dev/outbox', (_req, res) => {
  if (!devOutboxEnabled()) return res.json({ enabled: false, mails: [] });
  res.json({ enabled: true, mails: devOutbox() });
});
