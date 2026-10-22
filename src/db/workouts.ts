import type { SQLiteDatabase } from 'expo-sqlite';

import { nowIso, uuidv7 } from '@/lib/id';

export type Visibility = 'public' | 'followers' | 'private';

export type SetRow = {
  id: string;
  workout_exercise_id: string;
  position: number;
  set_type: 'warmup' | 'normal' | 'dropset' | 'failure';
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  completed_at: string | null;
};

export type WorkoutExerciseView = {
  id: string;
  exercise_id: string;
  name: string;
  position: number;
  sets: SetRow[];
};

/** Guarda una fila localmente y encola su subida, todo en una transacción. */
async function writeAndQueue(db: SQLiteDatabase, table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
     ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(',')}`,
    cols.map((c) => row[c] as string | number | null),
  );
  await db.runAsync(
    'INSERT INTO outbox (kind, target, row_id, payload, created_at) VALUES (?,?,?,?,?)',
    'upsert', table, String(row.id), JSON.stringify(row), nowIso(),
  );
}

export async function startWorkout(db: SQLiteDatabase, ownerId: string, title?: string) {
  const id = uuidv7();
  const now = nowIso();
  await db.withTransactionAsync(() =>
    writeAndQueue(db, 'workouts', {
      id, owner_id: ownerId, title: title ?? null, started_at: now,
      visibility: 'followers', updated_at: now,
    }),
  );
  return id;
}

export async function addExercise(db: SQLiteDatabase, workoutId: string, exerciseId: string) {
  const id = uuidv7();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    const r = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM workout_exercises WHERE workout_id = ? AND deleted_at IS NULL', workoutId);
    await writeAndQueue(db, 'workout_exercises', {
      id, workout_id: workoutId, exercise_id: exerciseId, position: r?.n ?? 0, updated_at: now,
    });
  });
  // Primera serie vacía para que el registro sea inmediato
  await addSet(db, id);
  return id;
}

/** Nueva serie, precargada con el peso y reps de la anterior (como Heavy/Symmetry). */
export async function addSet(db: SQLiteDatabase, workoutExerciseId: string) {
  const id = uuidv7();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    const prev = await db.getFirstAsync<SetRow>(
      `SELECT * FROM sets WHERE workout_exercise_id = ? AND deleted_at IS NULL
       ORDER BY position DESC LIMIT 1`, workoutExerciseId);
    await writeAndQueue(db, 'sets', {
      id, workout_exercise_id: workoutExerciseId, position: (prev?.position ?? -1) + 1,
      set_type: 'normal', weight_kg: prev?.weight_kg ?? null, reps: prev?.reps ?? null,
      rpe: null, rest_seconds: null, completed_at: null, updated_at: now,
    });
  });
  return id;
}

export async function updateSet(db: SQLiteDatabase, set: SetRow) {
  await db.withTransactionAsync(() => writeAndQueue(db, 'sets', { ...set, updated_at: nowIso() }));
}

export async function finishWorkout(db: SQLiteDatabase, workoutId: string, caption: string | null) {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    const w = await db.getFirstAsync<Record<string, string | null>>('SELECT * FROM workouts WHERE id = ?', workoutId);
    if (!w) throw new Error('Entrenamiento no encontrado');
    await writeAndQueue(db, 'workouts', { ...w, ended_at: now, updated_at: now });
    // El servidor calcula volumen, PRs, ranking y publica el post (no se puede falsear desde aquí).
    await db.runAsync(
      'INSERT INTO outbox (kind, target, row_id, payload, created_at) VALUES (?,?,?,?,?)',
      'rpc', 'finish_workout', workoutId, JSON.stringify({ p_workout: workoutId, p_caption: caption }), now,
    );
  });
}

export async function getActiveWorkoutId(db: SQLiteDatabase, ownerId: string) {
  const w = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM workouts WHERE owner_id = ? AND ended_at IS NULL AND deleted_at IS NULL
     ORDER BY started_at DESC LIMIT 1`, ownerId);
  return w?.id ?? null;
}

export async function loadWorkout(db: SQLiteDatabase, workoutId: string): Promise<WorkoutExerciseView[]> {
  const exercises = await db.getAllAsync<Omit<WorkoutExerciseView, 'sets'>>(
    `SELECT we.id, we.exercise_id, e.name, we.position FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? AND we.deleted_at IS NULL ORDER BY we.position`, workoutId);
  const sets = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? AND s.deleted_at IS NULL ORDER BY s.position`, workoutId);
  return exercises.map((e) => ({ ...e, sets: sets.filter((s) => s.workout_exercise_id === e.id) }));
}

export function volumeOf(view: WorkoutExerciseView[]) {
  return view.reduce((sum, e) => sum + e.sets.reduce((s, set) =>
    s + (set.completed_at && set.set_type !== 'warmup' ? (set.weight_kg ?? 0) * (set.reps ?? 0) : 0), 0), 0);
}
