-- Pruebas de seguridad (RLS). Se ejecutan dentro de una transacción que se revierte al final.
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
begin;

-- Usuarios de prueba: A sigue a B; C no sigue a nadie.
-- El registro crea el perfil automáticamente (trigger on_auth_user_created).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'ana@otro.com');
do $$ begin
  assert (select count(*) from profiles) = 3, 'cada registro debe crear su perfil';
  assert (select count(distinct username) from profiles) = 3, 'usernames únicos aunque el correo se repita';
end $$;
insert into follows (follower_id, followee_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, true);
$$;

-- B registra un entrenamiento solo para seguidores, con una serie, y lo cierra.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into workouts (id, owner_id, started_at, visibility)
  values ('11111111-0000-7000-8000-000000000001', '00000000-0000-0000-0000-00000000000b', now() - interval '1 hour', 'followers');
insert into workout_exercises (id, workout_id, exercise_id, position)
  values ('22222222-0000-7000-8000-000000000001', '11111111-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000002', 0);
insert into sets (id, workout_exercise_id, position, weight_kg, reps, completed_at)
  values ('33333333-0000-7000-8000-000000000001', '22222222-0000-7000-8000-000000000001', 0, 100, 5, now());
insert into habits (id, owner_id, name) values ('44444444-0000-7000-8000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Dormir 8h');
select finish_workout('11111111-0000-7000-8000-000000000001', 'Buen día de pecho') is not null as post_creado \gset
\if :post_creado \else \echo 'FALLO: finish_workout no creó post' \quit \endif

do $$ begin
  assert (select total_volume_kg from workouts where id = '11111111-0000-7000-8000-000000000001') = 500, 'volumen';
  assert (select count(*) from personal_records) = 1, 'PR registrado';
  assert (select count(*) from weekly_stats where user_id = auth.uid()) = 1, 'ranking actualizado';
end $$;

-- A (seguidor) ve el post y la serie; puede reaccionar y el contador sube.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from posts) = 1, 'A debería ver el post de B';
  assert (select count(*) from sets) = 1, 'A debería ver las series de B';
  assert (select count(*) from habits) = 0, 'A NO debe ver hábitos de B';
end $$;
insert into reactions (post_id, user_id) select id, auth.uid() from posts;
do $$ begin assert (select reaction_count from posts) = 1, 'contador de reacciones'; end $$;

-- C (no seguidor) no ve nada de B.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from posts) = 0, 'C NO debe ver el post';
  assert (select count(*) from workouts) = 0, 'C NO debe ver el entrenamiento';
  assert (select count(*) from sets) = 0, 'C NO debe ver las series';
end $$;

-- B no puede inflar sus contadores ni escribir en el ranking.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin update posts set reaction_count = 9999; raise exception 'FALLO: B editó reaction_count';
  exception when insufficient_privilege then null; end;
  begin update weekly_stats set volume_kg = 1e9;
    assert (select max(volume_kg) from weekly_stats) < 1e9, 'FALLO: B editó el ranking';
  exception when insufficient_privilege then null; end;
  begin insert into sets (id, workout_exercise_id, position, weight_kg, reps)
        values (gen_random_uuid(), '22222222-0000-7000-8000-000000000001', 1, 5000, 1);
        raise exception 'FALLO: aceptó 5000 kg';
  exception when check_violation then null; end;
end $$;

-- C no puede escribir series en el entrenamiento de B.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin insert into sets (id, workout_exercise_id, position, weight_kg, reps)
        values (gen_random_uuid(), '22222222-0000-7000-8000-000000000001', 2, 50, 5);
        raise exception 'FALLO: C escribió en el entrenamiento de B';
  exception when insufficient_privilege then null; end;
  -- C intenta apropiarse del entrenamiento de B mediante un upsert de sincronización.
  begin insert into workouts (id, owner_id, started_at)
        values ('11111111-0000-7000-8000-000000000001', auth.uid(), now())
        on conflict (id) do update set owner_id = excluded.owner_id;
        raise exception 'FALLO: C se apropió del entrenamiento de B';
  exception when insufficient_privilege then null; end;
end $$;

-- Bloqueo: si B bloquea a A, A deja de ver el post.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000a');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin assert (select count(*) from posts) = 0, 'A bloqueado no debe ver el post'; end $$;

-- Sin sesión (anon) no se ve nada.
reset role; set local role anon;
do $$ begin
  begin perform count(*) from posts; raise exception 'FALLO: anon leyó posts';
  exception when insufficient_privilege then null; end;
end $$;

-- Fotos de perfil: cada quien sube solo a su carpeta.
reset role; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/avatar.jpg');
do $$ begin
  begin insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000b/avatar.jpg');
        raise exception 'FALLO: A subió una foto en la carpeta de B';
  exception when insufficient_privilege then null; end;
  begin update profiles set avatar_url = 'https://evil.example.com/x.jpg' where id = auth.uid();
        raise exception 'FALLO: aceptó una foto de perfil externa';
  exception when check_violation then null; end;
end $$;

\echo 'OK: todas las pruebas de seguridad pasaron'
rollback;
