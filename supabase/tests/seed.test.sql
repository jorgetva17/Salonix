begin;
set local search_path to public, extensions;
select plan(3);

select is((select count(*)::int from public.salon_members m join public.salons s on s.id = m.salon_id where s.slug = 'barbearia-demo'),
  3, 'seed cria 3 membros no salão demo');
select is((select string_agg(role::text, ',' order by role::text) from public.salon_members), 'admin,professional,reception', 'um de cada perfil');
select is((select count(*)::int from public.profiles where full_name <> ''), 3, 'perfis criados com nome');

select * from finish();
rollback;
