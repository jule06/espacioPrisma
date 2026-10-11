import mongoose from 'mongoose';
import { PACKS } from './data/packs.js';
import { SERVICE_DETAILS } from './data/serviceDetails.js';
import { Business, Pack, Service } from './models/index.js';

/**
 * Cambios de datos que corren una sola vez al arrancar el servidor.
 * Cada migración aplicada queda anotada en la colección "migrations" y no se vuelve a ejecutar.
 * Para agregar una nueva, sumarla al final con un id que no se haya usado.
 */
const MIGRATIONS: { id: string; run: () => Promise<void> }[] = [
  {
    id: '2026-10-05-direccion-real',
    run: async () => {
      // Reemplaza la dirección de ejemplo por las zonas donde atiende Paula.
      await Business.updateMany(
        { address: 'Av. Corrientes 1234 · CABA' },
        { $set: { address: 'Liniers · Versalles · Flores · A domicilio', hoursLabel: '' } },
      );
    },
  },
  {
    id: '2026-10-11-descuento-shyvana',
    run: async () => {
      await Service.updateMany(
        { description: 'Todo el cuerpo. Relajante + Descontracturante · Para alumnas/os de Shyvana' },
        { $set: { description: 'Todo el cuerpo. Relajante + Descontracturante · Para alumnas/os de Shyvana (10% de descuento para alumnas de "Shyvana Pilates")' } },
      );
    },
  },
  {
    id: '2026-10-11-detalle-servicios',
    run: async () => {
      // Carga el detalle de "+ info" en los servicios que todavía no lo tienen.
      for (const [name, detail] of Object.entries(SERVICE_DETAILS)) {
        await Service.updateMany({ name, $or: [{ details: { $exists: false } }, { details: '' }] }, { $set: detail });
      }
    },
  },
  {
    id: '2026-10-11-packs-mensuales',
    run: async () => {
      // Carga los packs solo si todavía no hay ninguno.
      if (!(await Pack.exists({}))) await Pack.insertMany(PACKS);
    },
  },
];

export async function runMigrations(): Promise<void> {
  const collection = mongoose.connection.collection<{ _id: string; appliedAt: Date }>('migrations');
  for (const migration of MIGRATIONS) {
    if (await collection.findOne({ _id: migration.id })) continue;
    await migration.run();
    await collection.insertOne({ _id: migration.id, appliedAt: new Date() });
    console.log(`[migraciones] aplicada: ${migration.id}`);
  }
}
