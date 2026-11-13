-- Logos dos salões: leitura pública; escrita SOMENTE pelo servidor (service role),
-- depois de validar o arquivo e convertê-lo para PNG. Nenhum SVG enviado é armazenado.
-- Caminho: {salon_id}/{light|dark}.png

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salon-logos', 'salon-logos', true, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Sem policies para "authenticated" em storage.objects deste bucket: usuários não
-- gravam direto pela API do Storage. A leitura pública dispensa policy de select.
