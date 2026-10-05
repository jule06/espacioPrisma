import mongoose from 'mongoose';
import { config } from './config.js';
import { Business, Professional, Service } from './models/index.js';

// Datos de ejemplo. Los IDs de Google Calendar de cada profesional se pasan por
// SEED_CALENDAR_IDS (separados por coma, en el mismo orden que la lista de abajo).
const calendarIds = (process.env.SEED_CALENDAR_IDS ?? '').split(',').map((s) => s.trim());

const weekdays = (start: string, end: string, saturdayEnd?: string) => [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, start, end })),
  ...(saturdayEnd ? [{ weekday: 6, start, end: saturdayEnd }] : []),
];

await mongoose.connect(config.mongoUri);

await Business.deleteMany({});
await Business.create({
  name: 'Espacio Prisma',
  address: 'Av. Corrientes 1234 · CABA',
  hoursLabel: 'Lunes a sábado',
  depositPercent: 30,
  bankTransfer: { holder: 'Espacio Prisma', alias: 'espacio.prisma.mp', cbu: '0000003100012345678901', bank: 'Mercado Pago' },
});

await Professional.deleteMany({});
await Professional.create([
  { name: 'Paula Lopez', role: 'Masajista', calendarId: calendarIds[0] ?? '', workingHours: weekdays('09:00', '19:00', '14:00'), order: 1 },
]);

await Service.deleteMany({});
await Service.create([
  { name: 'Masaje Descontracturante', description: 'Espalda, cuello, hombros y cráneo', durationMinutes: 30, price: 30000, order: 1 },
  { name: 'Masaje Circulatorio', description: 'Piernas cansadas', durationMinutes: 30, price: 30000, order: 2 },
  { name: 'Relajante Profundo', description: 'Todo el cuerpo', durationMinutes: 50, price: 40000, order: 3 },
  { name: 'Masaje Integral', description: 'Todo el cuerpo. Relajante + Descontracturante · Para alumnas/os de Shyvana', durationMinutes: 50, price: 45000, order: 4 },
  { name: 'Reflexología podal o palmar', description: '', durationMinutes: 40, price: 30000, order: 5 },
]);

console.log('Datos de ejemplo cargados.');
await mongoose.disconnect();
