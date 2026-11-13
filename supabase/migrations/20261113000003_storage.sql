-- Logos dos salões: leitura pública, escrita só do admin do salão dono da pasta.
-- Caminho: {salon_id}/{light|dark}.{png|jpg|svg}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salon-logos', 'salon-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Extrai o salon_id da primeira pasta do caminho; null se não for um uuid.
create or replace function public.salon_id_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

create policy "admin envia logo do salão" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'salon-logos' and public.has_salon_role(public.salon_id_from_path(name), '{admin}'));

create policy "admin altera logo do salão" on storage.objects
  for update to authenticated
  using (bucket_id = 'salon-logos' and public.has_salon_role(public.salon_id_from_path(name), '{admin}'))
  with check (bucket_id = 'salon-logos' and public.has_salon_role(public.salon_id_from_path(name), '{admin}'));

create policy "admin remove logo do salão" on storage.objects
  for delete to authenticated
  using (bucket_id = 'salon-logos' and public.has_salon_role(public.salon_id_from_path(name), '{admin}'));

-- Upsert do Storage precisa ler o objeto existente.
create policy "admin lê logos do salão" on storage.objects
  for select to authenticated
  using (bucket_id = 'salon-logos' and public.has_salon_role(public.salon_id_from_path(name), '{admin}'));
