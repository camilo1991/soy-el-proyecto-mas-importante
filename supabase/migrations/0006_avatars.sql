-- Fotos de perfil: bucket "avatars".
-- Lectura abierta a quien tenga la URL (como cualquier red social); escritura solo en tu propia carpeta.
-- La app re-codifica la foto a JPEG de 512 px antes de subirla, lo que elimina los metadatos EXIF (incluido el GPS).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Solo se aceptan URLs de nuestro propio bucket como foto de perfil.
alter table public.profiles add constraint avatar_url_own_bucket
  check (avatar_url is null or avatar_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/');
