import { google } from 'googleapis';
import { config } from '../config.js';

export const LOGIN_SCOPES = ['openid', 'email', 'profile'];
export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
];

export function isGoogleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

// Pasa por el proxy de Vite, así la sesión queda en el mismo origen que el panel.
// Cada origen (localhost, túnel, dominio) tiene que estar cargado en Google Cloud como URI de redireccionamiento.
export const redirectUriFor = (origin: string) => `${origin}/api/admin/auth/google/callback`;

export function oauthClient(origin = config.clientUrl) {
  return new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, redirectUriFor(origin));
}

/** URL de la pantalla de consentimiento de Google. */
export function authUrl(purpose: 'login' | 'calendar', state: string, origin: string): string {
  const calendar = purpose === 'calendar';
  return oauthClient(origin).generateAuthUrl({
    scope: calendar ? [...LOGIN_SCOPES, ...CALENDAR_SCOPES] : LOGIN_SCOPES,
    state,
    // Para el calendario hace falta un refresh token: offline + consent lo garantiza.
    access_type: calendar ? 'offline' : 'online',
    prompt: calendar ? 'consent' : 'select_account',
    include_granted_scopes: true,
  });
}

/** Cambia el código de Google por tokens y devuelve el email verificado de la cuenta. */
export async function exchangeCode(code: string, origin: string) {
  const client = oauthClient(origin);
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error('Google no devolvió la identidad de la cuenta.');
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.google.clientId });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) throw new Error('La cuenta de Google no tiene un email verificado.');
  return { email: payload.email.toLowerCase(), name: payload.name ?? payload.email, tokens };
}
