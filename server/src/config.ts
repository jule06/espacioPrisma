import 'dotenv/config';
import { fileURLToPath } from 'node:url';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const config = {
  port: Number(env('PORT', '4600')),
  mongoUri: env('MONGO_URI', 'mongodb://localhost:27017/agenda_turnos'),
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
  uploadsDir: fileURLToPath(new URL('../uploads/', import.meta.url)),
};
