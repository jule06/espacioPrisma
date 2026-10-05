import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { config } from './config.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { BookingError } from './services/bookings.js';
import { startJobs } from './services/jobs.js';

const app = express();
app.use(cors({ origin: config.appOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof BookingError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Datos inválidos' });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'El archivo es demasiado grande (máximo 8 MB).' });
  if (err instanceof mongoose.Error.CastError) return res.status(404).json({ error: 'No encontrado' });
  console.error(err);
  res.status(500).json({ error: 'Algo salió mal. Probá de nuevo en un momento.' });
};
app.use(errorHandler);

await mongoose.connect(config.mongoUri);
console.log('[db] conectado a MongoDB');
startJobs();
app.listen(config.port, () => console.log(`[api] escuchando en http://localhost:${config.port}`));
