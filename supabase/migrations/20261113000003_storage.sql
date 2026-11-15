-- Salonix · Fase 1 · Bucket de logos dos salões

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salon-logos', 'salon-logos', true, 2097152,
  array['image/png', 'image/jpeg', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Caminho: {salon_id}/{variant}.{ext}. Só admin do salão escreve.
create function public.can_manage_salon_logo(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (storage.foldername(p_object_name))[1]
         ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.has_salon_role(
      ((storage.foldername(p_object_name))[1])::uuid,
      array['admin']::public.salon_role[])
    else false
  end;
$$;
revoke all on function public.can_manage_salon_logo(text) from public, anon;
grant execute on function public.can_manage_salon_logo(text) to authenticated, service_role;

create policy salon_logos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'salon-logos');

create policy salon_logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'salon-logos' and public.can_manage_salon_logo(name));

create policy salon_logos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'salon-logos' and public.can_manage_salon_logo(name))
  with check (bucket_id = 'salon-logos' and public.can_manage_salon_logo(name));

create policy salon_logos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'salon-logos' and public.can_manage_salon_logo(name));
