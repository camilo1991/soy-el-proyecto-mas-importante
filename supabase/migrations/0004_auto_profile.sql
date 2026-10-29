-- Crea el perfil automáticamente cuando alguien se registra.
-- Sin perfil no se pueden guardar entrenamientos (owner_id apunta a profiles).

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := lower(regexp_replace(split_part(coalesce(new.email, 'atleta'), '@', 1), '[^a-z0-9_]', '', 'g'));
  candidate text;
begin
  base := left(case when length(base) < 3 then 'atleta' else base end, 14);
  candidate := base;
  -- Si el nombre ya existe, añade un sufijo aleatorio corto.
  while exists (select 1 from profiles where username = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 5);
  end loop;
  insert into profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'display_name', base))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para quienes ya se registraron antes de este cambio.
insert into profiles (id, username, display_name)
select u.id,
       left(lower(regexp_replace(split_part(coalesce(u.email, 'atleta'), '@', 1), '[^a-z0-9_]', '', 'g')), 14)
         || '_' || substr(md5(u.id::text), 1, 5),
       split_part(coalesce(u.email, 'Atleta'), '@', 1)
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);
