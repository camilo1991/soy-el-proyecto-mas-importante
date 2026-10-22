-- Lógica que vive en el servidor para que nadie pueda falsear PRs, contadores ni el ranking.

-- ---------- Contadores de reacciones y comentarios ----------
create or replace function public.bump_post_counters() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'reactions' then
    update posts set reaction_count = reaction_count + (case when tg_op = 'INSERT' then 1 else -1 end)
    where id = coalesce(new.post_id, old.post_id);
  else
    update posts set comment_count = comment_count + (case when tg_op = 'INSERT' then 1 else -1 end)
    where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end $$;

create trigger reactions_count after insert or delete on reactions
  for each row execute function public.bump_post_counters();
create trigger comments_count after insert or delete on comments
  for each row execute function public.bump_post_counters();

-- ---------- Cerrar entrenamiento: volumen, PRs y post del feed ----------
-- El cliente lo llama después de subir todas las series. Devuelve el id del post (o null si es privado).
create or replace function public.finish_workout(p_workout uuid, p_caption text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  w workouts;
  v_volume numeric;
  v_post uuid;
  v_prs jsonb := '[]'::jsonb;
  r record;
begin
  select * into w from workouts where id = p_workout and owner_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'workout not found'; end if;

  select coalesce(sum(s.weight_kg * s.reps), 0) into v_volume
  from sets s join workout_exercises we on we.id = s.workout_exercise_id
  where we.workout_id = w.id and s.deleted_at is null and we.deleted_at is null
    and s.set_type <> 'warmup' and s.completed_at is not null;

  update workouts set total_volume_kg = v_volume, ended_at = coalesce(ended_at, now())
  where id = w.id;

  -- PR de 1RM estimado (fórmula de Epley) por ejercicio
  for r in
    select distinct on (we.exercise_id) we.exercise_id, s.id as set_id,
           round(s.weight_kg * (1 + s.reps / 30.0), 2) as e1rm, e.name
    from sets s
    join workout_exercises we on we.id = s.workout_exercise_id
    join exercises e on e.id = we.exercise_id
    where we.workout_id = w.id and s.deleted_at is null and s.completed_at is not null
      and s.set_type <> 'warmup' and s.weight_kg > 0 and s.reps between 1 and 12
    order by we.exercise_id, s.weight_kg * (1 + s.reps / 30.0) desc
  loop
    if r.e1rm > coalesce((select max(value) from personal_records
                          where owner_id = w.owner_id and exercise_id = r.exercise_id
                            and record_type = 'est_1rm'), 0) then
      insert into personal_records (owner_id, exercise_id, set_id, record_type, value, achieved_at)
      values (w.owner_id, r.exercise_id, r.set_id, 'est_1rm', r.e1rm, now());
      v_prs := v_prs || jsonb_build_object('exercise', r.name, 'est_1rm', r.e1rm);
    end if;
  end loop;

  if w.visibility <> 'private' then
    insert into posts (id, author_id, workout_id, caption, visibility, summary)
    values (gen_random_uuid(), w.owner_id, w.id, left(p_caption, 2000), w.visibility,
      jsonb_build_object(
        'volume_kg', v_volume,
        'duration_min', round(extract(epoch from (coalesce(w.ended_at, now()) - w.started_at)) / 60),
        'exercises', (select coalesce(jsonb_agg(e.name order by we.position), '[]'::jsonb)
                      from workout_exercises we join exercises e on e.id = we.exercise_id
                      where we.workout_id = w.id and we.deleted_at is null),
        'prs', v_prs))
    on conflict do nothing
    returning id into v_post;
  end if;

  perform public.refresh_weekly_stats(w.owner_id, date_trunc('week', w.started_at)::date);
  return v_post;
end $$;

-- ---------- Ranking semanal ----------
create or replace function public.refresh_weekly_stats(p_user uuid, p_week date)
returns void language sql security definer set search_path = public as $$
  insert into weekly_stats (user_id, week_start, sessions, volume_kg, consistency_score)
  select p_user, p_week, count(*), coalesce(sum(total_volume_kg), 0),
         -- consistencia: días distintos entrenados (máx. 7) x 100 / 7
         least(count(distinct started_at::date), 7) * 100 / 7
  from workouts
  where owner_id = p_user and deleted_at is null and ended_at is not null
    and started_at >= p_week and started_at < p_week + 7
  on conflict (user_id, week_start) do update
    set sessions = excluded.sessions, volume_kg = excluded.volume_kg,
        consistency_score = excluded.consistency_score;
$$;
revoke execute on function public.refresh_weekly_stats from anon, authenticated;

-- ---------- Clonar una rutina pública ----------
create or replace function public.clone_routine(p_source uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare src routines; v_new uuid := gen_random_uuid();
begin
  select * into src from routines where id = p_source and deleted_at is null;
  if not found or not public.can_see(src.owner_id, src.visibility) then
    raise exception 'routine not found';
  end if;
  insert into routines (id, owner_id, source_routine_id, name, notes, visibility)
  values (v_new, auth.uid(), src.id, src.name, src.notes, 'private');
  insert into routine_exercises (id, routine_id, exercise_id, position, target_sets, target_reps, rest_seconds)
  select gen_random_uuid(), v_new, exercise_id, position, target_sets, target_reps, rest_seconds
  from routine_exercises where routine_id = src.id and deleted_at is null;
  update routines set clone_count = clone_count + 1 where id = src.id;
  return v_new;
end $$;

-- ---------- Borrar mi cuenta (exigido por Apple y Google) ----------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();   -- cascada a todas las tablas
end $$;

revoke execute on function public.finish_workout, public.clone_routine, public.delete_my_account from anon;
