-- Simula o mínimo do Supabase (auth, storage, roles) num Postgres puro.
-- Só para rodar migrations + pgTAP onde o Docker do Supabase não está disponível.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated, service_role;

create schema extensions;
create publication supabase_realtime;
create extension pgcrypto with schema extensions;
create extension citext with schema extensions;
create extension pgtap with schema extensions;
create extension btree_gist with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema auth;
create table auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text, role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text
);
create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text, owner uuid, metadata jsonb,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to authenticated, service_role;
grant select on storage.buckets to anon;
alter default privileges in schema public grant all on tables to service_role;
