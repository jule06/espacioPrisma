import 'dotenv/config';
import { fileURLToPath } from 'node:url';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const config = {
  port: Number(env('PORT', '4600')),
  // Railway expone MONGO_URL con su plugin de MongoDB.
  mongoUri: process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/agenda_turnos',
  // URL pública del front: se usa en los links de los emails.
  clientUrl: env('CLIENT_URL', 'http://localhost:5600'),
  // Todas las direcciones desde las que se puede abrir el front (ej. localhost y un túnel).
  // El login con Google vuelve a la misma dirección desde la que se inició.
  appOrigins: [
    ...new Set([env('CLIENT_URL', 'http://localhost:5600'), ...env('APP_ORIGINS', '').split(',')].map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)),
  ],
  timezone: env('TIMEZONE', 'America/Argentina/Buenos_Aires'),
  jwtSecret: env('JWT_SECRET'),
  isProduction: process.env.NODE_ENV === 'production',
  // Emails de Google que pueden entrar al panel del local.
  adminEmails: env('ADMIN_EMAILS', '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || undefined,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
  },
  smtp: {
    host: process.env.SMTP_HOST || undefined,
    port: Number(env('SMTP_PORT', '587')),
    secure: env('SMTP_SECURE', 'false') === 'true',
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
  },
  mailFrom: env('MAIL_FROM', 'Agenda de turnos <no-reply@local.test>'),
  notifyEmail: process.env.NOTIFY_EMAIL || undefined,
  // En Railway conviene apuntarlo a un volumen (ej. UPLOADS_DIR=/data/uploads) para no perder los comprobantes en cada deploy.
  uploadsDir: process.env.UPLOADS_DIR || fileURLToPath(new URL('../uploads/', import.meta.url)),
  // Front compilado (client/dist). En producción Express lo sirve junto con la API.
  clientDistDir: fileURLToPath(new URL('../../client/dist/', import.meta.url)),
};
