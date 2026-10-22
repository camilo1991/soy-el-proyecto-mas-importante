/**
 * Base local (SQLite). Es la fuente de verdad mientras entrenas: todo se escribe aquí primero
 * y la tabla `outbox` guarda en orden los cambios pendientes de subir a Supabase.
 */
export const LOCAL_SCHEMA_VERSION = 1;

export const LOCAL_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  equipment TEXT,
  tracking_type TEXT NOT NULL DEFAULT 'weight_reps',
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  routine_id TEXT,
  title TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  visibility TEXT NOT NULL DEFAULT 'followers',
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  notes TEXT,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY NOT NULL,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  set_type TEXT NOT NULL DEFAULT 'normal',
  weight_kg REAL,
  reps INTEGER,
  rpe REAL,
  rest_seconds INTEGER,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,          -- 'upsert' | 'rpc'
  target TEXT NOT NULL,        -- nombre de tabla o función remota
  row_id TEXT NOT NULL,
  payload TEXT NOT NULL,       -- JSON
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id, position);
CREATE INDEX IF NOT EXISTS idx_sets_we ON sets(workout_exercise_id, position);
`;
