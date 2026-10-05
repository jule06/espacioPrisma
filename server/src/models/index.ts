import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

// Datos del local. Hay un único documento.
const businessSchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, default: '' },
    hoursLabel: { type: String, default: '' },
    depositPercent: { type: Number, default: 30 },
    slotStepMinutes: { type: Number, default: 30 },
    // Mínimo de anticipación para reservar un turno.
    minLeadMinutes: { type: Number, default: 60 },
    // Hasta cuántas horas antes la clienta puede cambiar o cancelar sola.
    changeLimitHours: { type: Number, default: 24 },
    // Tiempo que se guarda el horario mientras la clienta sube el comprobante.
    holdMinutes: { type: Number, default: 60 },
    // Cuántos días hacia adelante se pueden reservar turnos.
    bookingWindowDays: { type: Number, default: 60 },
    bankTransfer: {
      holder: { type: String, default: '' },
      alias: { type: String, default: '' },
      cbu: { type: String, default: '' },
      bank: { type: String, default: '' },
    },
  },
  { timestamps: true },
);

const workingHoursSchema = new Schema(
  {
    // 1 = lunes … 7 = domingo (ISO, igual que luxon)
    weekday: { type: Number, required: true, min: 1, max: 7 },
    start: { type: String, required: true }, // "09:00"
    end: { type: String, required: true }, // "19:00"
  },
  { _id: false },
);

const professionalSchema = new Schema(
  {
    name: { type: String, required: true },
    role: { type: String, default: '' },
    // ID del Google Calendar de la profesional (normalmente su email).
    // Tiene que estar compartido con la cuenta de servicio con permiso para modificar eventos.
    calendarId: { type: String, default: '' },
    workingHours: { type: [workingHoursSchema], default: [] },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const serviceSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    durationMinutes: { type: Number, required: true },
    price: { type: Number, required: true },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const BOOKING_STATUSES = [
  'awaiting_receipt', // reservado, falta subir el comprobante de la seña
  'awaiting_approval', // comprobante subido, el local tiene que confirmar
  'confirmed', // seña confirmada, el turno está en Google Calendar
  'rejected', // el local rechazó la seña
  'cancelled', // la clienta canceló
  'expired', // no subió el comprobante a tiempo
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Estados que ocupan el horario en la agenda.
export const BLOCKING_STATUSES: BookingStatus[] = ['awaiting_receipt', 'awaiting_approval', 'confirmed'];

const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
  },
  { _id: false },
);

const bookingSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    status: { type: String, enum: BOOKING_STATUSES, required: true, default: 'awaiting_receipt' },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    // Copia de los datos del servicio al momento de reservar.
    serviceName: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    price: { type: Number, required: true },
    deposit: { type: Number, required: true },
    professional: { type: Schema.Types.ObjectId, ref: 'Professional', required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    customer: { type: customerSchema, required: true },
    receipt: {
      filename: String,
      originalName: String,
      mimetype: String,
      uploadedAt: Date,
    },
    holdExpiresAt: { type: Date },
    googleEventId: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    confirmedAt: Date,
    approvalReminderSentAt: Date,
    customerReminderSentAt: Date,
  },
  { timestamps: true },
);
bookingSchema.index({ professional: 1, start: 1 });
bookingSchema.index({ status: 1, start: 1 });

// Cuenta de Google conectada para leer y escribir los calendarios (OAuth2). Hay un único documento.
const googleConnectionSchema = new Schema(
  {
    email: { type: String, required: true },
    refreshToken: { type: String, required: true },
    scope: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Business = model('Business', businessSchema);
export const GoogleConnection = model('GoogleConnection', googleConnectionSchema);
export const Professional = model('Professional', professionalSchema);
export const Service = model('Service', serviceSchema);
export const Booking = model('Booking', bookingSchema);

export type BusinessDoc = HydratedDocument<InferSchemaType<typeof businessSchema>>;
export type ProfessionalDoc = HydratedDocument<InferSchemaType<typeof professionalSchema>>;
export type ServiceDoc = HydratedDocument<InferSchemaType<typeof serviceSchema>>;
export type BookingDoc = HydratedDocument<InferSchemaType<typeof bookingSchema>>;
