-- Esquema principal. IDs generados en el cliente (UUID v7) para que el modo offline no choque al subir.
create extension if not exists citext;

-- ============ Usuarios (auth.users lo gestiona Supabase Auth) ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username citext unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (length(display_name) between 1 and 60),
  avatar_url text,
  bio text check (length(bio) <= 280),
  units text not null default 'kg' check (units in ('kg','lb')),
  default_visibility text not null default 'followers'
    check (default_visibility in ('public','followers','private')),
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.follows (
  follower_id uuid references public.profiles on delete cascade,
  followee_id uuid references public.profiles on delete cascade,
  status text not null default 'accepted' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table public.blocks (
  blocker_id uuid references public.profiles on delete cascade,
  blocked_id uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ============ Catálogo ============
create table public.exercises (
  id uuid primary key,
  owner_id uuid references public.profiles on delete cascade, -- null = ejercicio del sistema
  name text not null,
  muscle_group text not null,
  equipment text,
  tracking_type text not null default 'weight_reps'
    check (tracking_type in ('weight_reps','reps','time','distance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============ Entrenamiento ============
create table public.routines (
  id uuid primary key,
  owner_id uuid not null references public.profiles on delete cascade,
  source_routine_id uuid references public.routines on delete set null,
  name text not null,
  notes text,
  visibility text not null default 'private' check (visibility in ('public','followers','private')),
  clone_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.routine_exercises (
  id uuid primary key,
  routine_id uuid not null references public.routines on delete cascade,
  exercise_id uuid not null references public.exercises,
  position smallint not null,
  target_sets smallint check (target_sets between 1 and 20),
  target_reps text,
  rest_seconds smallint check (rest_seconds between 0 and 1800),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workouts (
  id uuid primary key,
  owner_id uuid not null references public.profiles on delete cascade,
  routine_id uuid references public.routines on delete set null,
  title text,
  started_at timestamptz not null,
  ended_at timestamptz,
  total_volume_kg numeric(10,2),
  visibility text not null default 'followers' check (visibility in ('public','followers','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);

create table public.workout_exercises (
  id uuid primary key,
  workout_id uuid not null references public.workouts on delete cascade,
  exercise_id uuid not null references public.exercises,
  position smallint not null,
  notes text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.sets (
  id uuid primary key,
  workout_exercise_id uuid not null references public.workout_exercises on delete cascade,
  position smallint not null,
  set_type text not null default 'normal' check (set_type in ('warmup','normal','dropset','failure')),
  weight_kg numeric(6,2) check (weight_kg between 0 and 1000),   -- límites contra trampas en el ranking
  reps smallint check (reps between 0 and 500),
  rpe numeric(3,1) check (rpe between 1 and 10),
  duration_seconds int check (duration_seconds >= 0),
  distance_m numeric(8,2) check (distance_m >= 0),
  rest_seconds smallint check (rest_seconds between 0 and 3600),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  exercise_id uuid not null references public.exercises,
  set_id uuid references public.sets on delete set null,
  record_type text not null check (record_type in ('max_weight','est_1rm','max_reps','max_volume')),
  value numeric(10,2) not null,
  achieved_at timestamptz not null
);

-- ============ Social ============
create table public.posts (
  id uuid primary key,
  author_id uuid not null references public.profiles on delete cascade,
  workout_id uuid references public.workouts on delete cascade,
  caption text check (length(caption) <= 2000),
  summary jsonb,                 -- volumen, ejercicios destacados, PRs (lo calcula el servidor)
  visibility text not null default 'followers' check (visibility in ('public','followers','private')),
  reaction_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.post_media (
  id uuid primary key,
  post_id uuid not null references public.posts on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image','video')),
  position smallint not null default 0
);

create table public.reactions (
  post_id uuid references public.posts on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  kind text not null default 'fuerza' check (kind in ('fuerza','fuego','respeto')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key,
  post_id uuid not null references public.posts on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  parent_id uuid references public.comments on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  target_type text not null check (target_type in ('post','comment','profile')),
  target_id uuid not null,
  reason text not null check (length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open','reviewed','actioned')),
  created_at timestamptz not null default now()
);

-- ============ Estilo de vida (privado, nunca aparece en el feed) ============
create table public.habits (
  id uuid primary key,
  owner_id uuid not null references public.profiles on delete cascade,
  name text not null,
  target_per_week smallint check (target_per_week between 1 and 7),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.habit_logs (
  id uuid primary key,
  habit_id uuid not null references public.habits on delete cascade,
  log_date date not null,
  done boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create table public.supplements (
  id uuid primary key,
  owner_id uuid not null references public.profiles on delete cascade,
  name text not null,
  dose text,
  schedule text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.supplement_logs (
  id uuid primary key,
  supplement_id uuid not null references public.supplements on delete cascade,
  taken_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.recovery_logs (
  id uuid primary key,
  owner_id uuid not null references public.profiles on delete cascade,
  log_date date not null,
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  soreness smallint check (soreness between 1 and 5),
  energy smallint check (energy between 1 and 5),
  hrv_ms smallint check (hrv_ms between 0 and 300),
  updated_at timestamptz not null default now(),
  unique (owner_id, log_date)
);

-- ============ Gamificación ============
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles on delete set null,
  title text not null,
  metric text not null check (metric in ('volume','sessions','streak')),
  goal numeric,
  starts_on date not null,
  ends_on date not null,
  check (ends_on >= starts_on)
);

create table public.challenge_members (
  challenge_id uuid references public.challenges on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  progress numeric not null default 0,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table public.weekly_stats (   -- solo lo escribe el servidor
  user_id uuid references public.profiles on delete cascade,
  week_start date not null,
  sessions smallint not null default 0,
  volume_kg numeric(12,2) not null default 0,
  consistency_score smallint not null default 0,
  primary key (user_id, week_start)
);

-- ============ Índices ============
create index on public.workouts (owner_id, started_at desc);
create index on public.workouts (updated_at);
create index on public.workout_exercises (workout_id, position);
create index on public.sets (workout_exercise_id, position);
create index on public.sets (updated_at);
create index on public.posts (author_id, created_at desc);
create unique index posts_one_per_workout on public.posts (workout_id) where workout_id is not null;
create index on public.posts (created_at desc) where deleted_at is null;
create index on public.comments (post_id, created_at);
create index on public.follows (followee_id);
create index on public.personal_records (owner_id, exercise_id, record_type);
create index on public.weekly_stats (week_start, volume_kg desc);

-- ============ updated_at automático ============
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','exercises','routines','routine_exercises','workouts',
    'workout_exercises','sets','posts','habits','habit_logs','supplements','supplement_logs','recovery_logs']
  loop
    execute format('create trigger touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
