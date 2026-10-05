# Agenda de turnos

Reserva de turnos online con seña por transferencia, panel del local para confirmar señas y sincronización con Google Calendar.

- `client/`: React + Vite + TypeScript (http://localhost:5600)
- `server/`: Node + Express + Mongoose + TypeScript (http://localhost:4600)
- MongoDB: `mongodb://localhost:27017/agenda_turnos` (o `docker compose up -d`)

## Arrancar

```bash
cd server && npm install && cp .env.example .env   # completar JWT_SECRET, GOOGLE_* y ADMIN_EMAILS
npm run seed    # datos de ejemplo (borra local, profesionales y servicios)
npm run dev
```

```bash
cd client && npm install && npm run dev
```

- Reserva: http://localhost:5600
- Turno de una clienta: http://localhost:5600/?codigo=XXXXXX
- Panel del local: http://localhost:5600/panel (ingreso con Google, solo emails de `ADMIN_EMAILS`)

## Flujo

1. La clienta elige servicio, día y horario. El sistema asigna a la profesional libre con menos carga ese día.
2. Se crea la reserva con un código y se guarda el horario `holdMinutes` (60 min) mientras transfiere la seña (30%).
3. Sube el comprobante: el local recibe un email y la seña aparece en el panel (con sonido).
4. El local confirma: se crea el evento en el Google Calendar de la profesional y la clienta recibe el email de confirmación.
5. Con el código la clienta puede cambiar el horario o cancelar hasta 24 h antes. El día anterior recibe un recordatorio.

Tareas cada 5 minutos: vencer reservas sin comprobante, recordar al local señas sin confirmar después de 1 h, recordatorios del día anterior (desde las 10:00).

## Google (OAuth2): login del panel y Google Calendar

No hay usuario y contraseña: al panel se entra solo con Google. Mientras no haya credenciales, en desarrollo aparece un botón "Entrar en modo desarrollo" (nunca con `NODE_ENV=production`).

1. En Google Cloud Console: crear un proyecto y habilitar **Google Calendar API**.
2. **Pantalla de consentimiento de OAuth**: tipo *Externo*, agregar los scopes `calendar.events` y `calendar.freebusy`. Pasarla a *En producción*: en modo *Prueba* Google vence el acceso al calendario a los 7 días.
3. **Credenciales → ID de cliente de OAuth → Aplicación web**, con URI de redireccionamiento autorizado
   `http://localhost:5600/api/admin/auth/google/callback` (y la del dominio real cuando se publique).
4. En `server/.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `ADMIN_EMAILS=paula@gmail.com`.
5. Entrar al panel con Google y tocar **Conectar Google Calendar** con la cuenta de Paula. Desde ahí la disponibilidad sale de su calendario (free/busy) y cada seña confirmada se agrega como evento.

Sin calendario conectado, todo funciona igual usando solo MongoDB.

## Emails

Configurar `SMTP_*`, `MAIL_FROM` y `NOTIFY_EMAIL` en `server/.env`. Sin SMTP, los correos se imprimen en la consola del servidor.
