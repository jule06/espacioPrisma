// Serializa las operaciones que reservan horarios para evitar dos reservas
// simultáneas en el mismo hueco (alcanza con una sola instancia del servidor).
let tail: Promise<unknown> = Promise.resolve();

export function withBookingLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}
