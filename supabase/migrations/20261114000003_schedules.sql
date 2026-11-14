-- Jornada semanal (weekday 0 = domingo) e bloqueios de agenda dos profissionais.

create table public.professional_schedules (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  professional_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);

create index professional_schedules_professional_idx on public.professional_schedules (professional_id, weekday);

alter table public.professional_schedules enable row level security;

create policy "membros veem jornadas" on public.professional_schedules
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin cria jornadas" on public.professional_schedules
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin remove jornadas" on public.professional_schedules
  for delete to authenticated using (public.has_salon_role(salon_id, '{admin}'));

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null check (kind in ('day_off', 'vacation', 'break', 'other')),
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);

create index schedule_blocks_professional_idx on public.schedule_blocks (professional_id, starts_at);

alter table public.schedule_blocks enable row level security;

create policy "membros veem bloqueios" on public.schedule_blocks
  for select to authenticated using (public.is_salon_member(salon_id));
create policy "admin cria bloqueios" on public.schedule_blocks
  for insert to authenticated with check (public.has_salon_role(salon_id, '{admin}'));
create policy "admin remove bloqueios" on public.schedule_blocks
  for delete to authenticated using (public.has_salon_role(salon_id, '{admin}'));

-- RPCs (security invoker: a RLS acima decide quem pode) ----------------------

-- Troca a jornada inteira do profissional; se houver sobreposição, nada muda.
-- p_slots: [{"weekday": 2, "starts_at": "09:00", "ends_at": "12:00"}, ...]
create or replace function public.set_professional_schedule(p_professional_id uuid, p_slots jsonb)
returns setof public.professional_schedules
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_salon_id uuid;
begin
  select salon_id into v_salon_id from public.professionals where id = p_professional_id;
  if v_salon_id is null then
    raise exception 'Profissional não encontrado.';
  end if;

  delete from public.professional_schedules where professional_id = p_professional_id;

  insert into public.professional_schedules (salon_id, professional_id, weekday, starts_at, ends_at)
  select v_salon_id, p_professional_id, (s ->> 'weekday')::smallint, (s ->> 'starts_at')::time, (s ->> 'ends_at')::time
  from jsonb_array_elements(p_slots) s;

  if exists (
    select 1
    from public.professional_schedules a
    join public.professional_schedules b
      on b.professional_id = a.professional_id and b.weekday = a.weekday and b.id <> a.id
    where a.professional_id = p_professional_id
      and a.starts_at < b.ends_at and b.starts_at < a.ends_at
  ) then
    raise exception 'Horários se sobrepõem na jornada.';
  end if;

  return query
    select * from public.professional_schedules
    where professional_id = p_professional_id
    order by weekday, starts_at;
end;
$$;

-- Recebe data/hora como o salão vê (sem fuso) e grava em UTC usando o fuso do salão.
create or replace function public.create_schedule_block(
  p_professional_id uuid,
  p_starts_local timestamp,
  p_ends_local timestamp,
  p_kind text,
  p_note text default null
)
returns public.schedule_blocks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_salon_id uuid;
  v_timezone text;
  v_block public.schedule_blocks;
begin
  select p.salon_id, s.timezone into v_salon_id, v_timezone
  from public.professionals p
  join public.salons s on s.id = p.salon_id
  where p.id = p_professional_id;
  if v_salon_id is null then
    raise exception 'Profissional não encontrado.';
  end if;

  insert into public.schedule_blocks (salon_id, professional_id, starts_at, ends_at, kind, note)
  values (
    v_salon_id, p_professional_id,
    p_starts_local at time zone v_timezone, p_ends_local at time zone v_timezone,
    p_kind, nullif(trim(p_note), '')
  )
  returning * into v_block;
  return v_block;
end;
$$;

revoke execute on function public.set_professional_schedule(uuid, jsonb) from public, anon;
revoke execute on function public.create_schedule_block(uuid, timestamp, timestamp, text, text) from public, anon;
grant execute on function public.set_professional_schedule(uuid, jsonb) to authenticated;
grant execute on function public.create_schedule_block(uuid, timestamp, timestamp, text, text) to authenticated;
