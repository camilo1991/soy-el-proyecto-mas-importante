import type { SQLiteDatabase } from 'expo-sqlite';

import { supabase } from '@/lib/supabase';

type OutboxRow = { seq: number; kind: 'upsert' | 'rpc'; target: string; row_id: string; payload: string };

// Columnas que el cliente puede enviar por tabla (el resto lo decide el servidor).
const ALLOWED: Record<string, string[]> = {
  workouts: ['id', 'owner_id', 'routine_id', 'title', 'started_at', 'ended_at', 'visibility', 'deleted_at'],
  workout_exercises: ['id', 'workout_id', 'exercise_id', 'position', 'notes', 'deleted_at'],
  sets: ['id', 'workout_exercise_id', 'position', 'set_type', 'weight_kg', 'reps', 'rpe',
    'rest_seconds', 'completed_at', 'deleted_at'],
};
const RPCS = new Set(['finish_workout']);

const pick = (obj: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

let running = false;

/**
 * Sube los cambios pendientes en el orden en que se hicieron.
 * Si algo falla (sin red), se detiene y lo reintenta en la próxima llamada.
 */
export async function pushOutbox(db: SQLiteDatabase): Promise<{ pushed: number; pending: number }> {
  if (running) return { pushed: 0, pending: -1 };
  running = true;
  let pushed = 0;
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { pushed, pending: await pendingCount(db) };

    const rows = await db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY seq LIMIT 200');
    for (const row of rows) {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      let error: { message: string } | null = null;

      if (row.kind === 'upsert' && ALLOWED[row.target]) {
        ({ error } = await supabase.from(row.target).upsert(pick(payload, ALLOWED[row.target])));
      } else if (row.kind === 'rpc' && RPCS.has(row.target)) {
        ({ error } = await supabase.rpc(row.target, payload));
      } else {
        error = { message: `Operación no permitida: ${row.kind} ${row.target}` };
      }

      if (error) {
        await db.runAsync('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE seq = ?',
          error.message, row.seq);
        break; // mantener el orden: no saltar operaciones
      }
      await db.runAsync('DELETE FROM outbox WHERE seq = ?', row.seq);
      pushed++;
    }
  } finally {
    running = false;
  }
  return { pushed, pending: await pendingCount(db) };
}

export async function pendingCount(db: SQLiteDatabase) {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return r?.n ?? 0;
}

/** Descarga el catálogo de ejercicios (sistema + propios) para usarlo sin conexión. */
export async function pullExercises(db: SQLiteDatabase) {
  const last = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = 'exercises'");
  const since = last?.value ?? '1970-01-01T00:00:00Z';
  const { data, error } = await supabase.from('exercises')
    .select('id, owner_id, name, muscle_group, equipment, tracking_type, updated_at, deleted_at')
    .gt('updated_at', since).order('updated_at').limit(1000);
  if (error || !data?.length) return;
  await db.withTransactionAsync(async () => {
    for (const e of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO exercises (id, owner_id, name, muscle_group, equipment, tracking_type, updated_at, deleted_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        e.id, e.owner_id, e.name, e.muscle_group, e.equipment, e.tracking_type, e.updated_at, e.deleted_at);
    }
    await db.runAsync("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('exercises', ?)",
      data[data.length - 1].updated_at);
  });
}
