-- Seguridad: Row Level Security en TODAS las tablas.
-- Regla base: el teléfono nunca es de confianza; la base de datos decide quién ve y escribe qué.

-- ---------- Funciones auxiliares (security definer para evitar recursión entre políticas) ----------
create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.can_see(owner uuid, visibility text) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or (not public.is_blocked(owner, auth.uid()) and (
            visibility = 'public'
         or (visibility = 'followers' and exists (
               select 1 from follows f
               where f.follower_id = auth.uid() and f.followee_id = owner and f.status = 'accepted'))));
$$;

create or replace function public.workout_visible(w uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workouts where id = w and deleted_at is null
                 and public.can_see(owner_id, visibility));
$$;

create or replace function public.owns_workout(w uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workouts where id = w and owner_id = auth.uid());
$$;

create or replace function public.post_visible(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from posts where id = p and deleted_at is null
                 and public.can_see(author_id, visibility));
$$;

revoke execute on function public.is_blocked, public.can_see, public.workout_visible,
  public.owns_workout, public.post_visible from anon;

-- ---------- Activar RLS ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','follows','blocks','exercises','routines','routine_exercises',
    'workouts','workout_exercises','sets','personal_records','posts','post_media','reactions','comments',
    'reports','habits','habit_logs','supplements','supplement_logs','recovery_logs','challenges',
    'challenge_members','weekly_stats']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);   -- nada es visible sin sesión
  end loop;
end $$;

-- ---------- Usuarios ----------
create policy profiles_read on profiles for select to authenticated
  using (deleted_at is null and not public.is_blocked(id, auth.uid()));
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy follows_read on follows for select to authenticated using (true);
create policy follows_insert on follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_blocked(follower_id, followee_id));
create policy follows_delete on follows for delete to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_accept on follows for update to authenticated
  using (followee_id = auth.uid()) with check (followee_id = auth.uid());

create policy blocks_own on blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- ---------- Catálogo ----------
create policy exercises_read on exercises for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy exercises_write on exercises for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- Entrenamiento ----------
create policy routines_read on routines for select to authenticated
  using (deleted_at is null and public.can_see(owner_id, visibility));
create policy routines_write on routines for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy routine_ex_read on routine_exercises for select to authenticated
  using (exists (select 1 from routines r where r.id = routine_id
                 and public.can_see(r.owner_id, r.visibility)));
create policy routine_ex_write on routine_exercises for all to authenticated
  using (exists (select 1 from routines r where r.id = routine_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from routines r where r.id = routine_id and r.owner_id = auth.uid()));

create policy workouts_read on workouts for select to authenticated
  using (public.can_see(owner_id, visibility));
create policy workouts_write on workouts for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy wex_read on workout_exercises for select to authenticated
  using (public.workout_visible(workout_id));
create policy wex_write on workout_exercises for all to authenticated
  using (public.owns_workout(workout_id)) with check (public.owns_workout(workout_id));

create policy sets_read on sets for select to authenticated
  using (exists (select 1 from workout_exercises we where we.id = workout_exercise_id
                 and public.workout_visible(we.workout_id)));
create policy sets_write on sets for all to authenticated
  using (exists (select 1 from workout_exercises we where we.id = workout_exercise_id
                 and public.owns_workout(we.workout_id)))
  with check (exists (select 1 from workout_exercises we where we.id = workout_exercise_id
                 and public.owns_workout(we.workout_id)));

-- Los PRs solo los escribe el servidor (finish_workout); sin política de escritura.
create policy prs_read on personal_records for select to authenticated
  using (public.can_see(owner_id, 'followers'));

-- ---------- Social ----------
create policy posts_read on posts for select to authenticated
  using (deleted_at is null and public.can_see(author_id, visibility));
create policy posts_insert on posts for insert to authenticated
  with check (author_id = auth.uid() and (workout_id is null or public.owns_workout(workout_id)));
create policy posts_update on posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete on posts for delete to authenticated using (author_id = auth.uid());

-- Contadores y resumen los calcula el servidor: el cliente no puede escribir esas columnas.
revoke insert, update on posts from authenticated;
grant insert (id, author_id, workout_id, caption, visibility) on posts to authenticated;
grant update (caption, visibility, deleted_at) on posts to authenticated;
revoke update on routines from authenticated;
grant update (name, notes, visibility, deleted_at) on routines to authenticated;
revoke update on workouts from authenticated;
-- id y owner_id se incluyen porque el upsert de sincronización los reenvía; RLS impide cambiar el dueño.
grant update (id, owner_id, title, started_at, ended_at, visibility, deleted_at, routine_id) on workouts to authenticated;

create policy media_read on post_media for select to authenticated using (public.post_visible(post_id));
create policy media_write on post_media for all to authenticated
  using (exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid()));

create policy reactions_read on reactions for select to authenticated using (public.post_visible(post_id));
create policy reactions_insert on reactions for insert to authenticated
  with check (user_id = auth.uid() and public.post_visible(post_id));
create policy reactions_update on reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete on reactions for delete to authenticated using (user_id = auth.uid());

create policy comments_read on comments for select to authenticated
  using (deleted_at is null and public.post_visible(post_id) and not public.is_blocked(author_id, auth.uid()));
create policy comments_insert on comments for insert to authenticated
  with check (author_id = auth.uid() and public.post_visible(post_id));
create policy comments_update on comments for update to authenticated
  using (author_id = auth.uid()
         or exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid()));

create policy reports_insert on reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_read_own on reports for select to authenticated using (reporter_id = auth.uid());

-- ---------- Estilo de vida: solo el dueño ----------
create policy habits_own on habits for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy habit_logs_own on habit_logs for all to authenticated
  using (exists (select 1 from habits h where h.id = habit_id and h.owner_id = auth.uid()))
  with check (exists (select 1 from habits h where h.id = habit_id and h.owner_id = auth.uid()));
create policy supplements_own on supplements for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy supplement_logs_own on supplement_logs for all to authenticated
  using (exists (select 1 from supplements s where s.id = supplement_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from supplements s where s.id = supplement_id and s.owner_id = auth.uid()));
create policy recovery_own on recovery_logs for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- Gamificación ----------
create policy challenges_read on challenges for select to authenticated using (true);
create policy challenges_insert on challenges for insert to authenticated with check (creator_id = auth.uid());
create policy cm_read on challenge_members for select to authenticated using (true);
create policy cm_join on challenge_members for insert to authenticated
  with check (user_id = auth.uid() and progress = 0);
create policy cm_leave on challenge_members for delete to authenticated using (user_id = auth.uid());
-- weekly_stats: lectura pública para el ranking; ninguna escritura desde el cliente.
create policy weekly_read on weekly_stats for select to authenticated
  using (not public.is_blocked(user_id, auth.uid()));
