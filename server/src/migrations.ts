import mongoose from 'mongoose';
import { Business } from './models/index.js';

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
