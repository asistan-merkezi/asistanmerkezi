-- core.profiles: hub kullanıcı profili + rol tanımı, RLS ve auth.users senkron trigger'ı.
-- Idempotent: bu blok birden fazla kez çalıştırılabilir.
--
-- ÖNEMLİ (Dashboard'da SQL çalıştırıldıktan sonra elle yapılacak):
-- Settings > API > Exposed schemas listesine "core" eklenmeli, aksi halde
-- PostgREST (ve dolayısıyla lib/supabase/client.ts, server.ts, proxy.ts'teki
-- db: { schema: "core" } client'ları) bu şemayı göremez.

begin;

create schema if not exists core;

-- core.profiles.rol: CLAUDE.md §6.2'de tanımlı tek rol enum'u (super_admin, destek).
-- Not: bu roller "panel rolleri" olarak tanımlı (Mesaj Merkezi yönetim paneli için).
-- Kiracı/tenant kullanıcılarının yetkisi CLAUDE.md §7'ye göre tenant bazlı ve
-- dinamik olacak (ayrı bir yetki tablosu) — bu migration'ın kapsamı dışında.
-- Trigger'la otomatik oluşan her profile şimdilik en az yetkili rol olan
-- 'destek' atanıyor; tenant kullanıcı modeli netleşince ayrı bir migration'la
-- gözden geçirilmeli.
do $$
begin
  create type core.rol_tipi as enum ('super_admin', 'destek');
exception
  when duplicate_object then null;
end
$$;

create table if not exists core.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  rol core.rol_tipi not null default 'destek',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at otomatik güncelleme
create or replace function core.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on core.profiles;
create trigger set_updated_at
  before update on core.profiles
  for each row
  execute function core.set_updated_at();

-- RLS: kullanıcı yalnızca kendi profilini okuyabilir/güncelleyebilir
alter table core.profiles enable row level security;

drop policy if exists "profiles_select_own" on core.profiles;
create policy "profiles_select_own"
  on core.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on core.profiles;
create policy "profiles_update_own"
  on core.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Tablo/kolon yetkileri: authenticated kendi satırını SELECT edebilir,
-- ama UPDATE yalnızca "email" kolonuyla sınırlı — "rol" kolonu grant
-- listesine dahil edilmedi, aksi halde RLS'in "kendi satırını güncelleyebilir"
-- kuralı kullanıcının kendini super_admin yapmasına izin verirdi
-- (privilege escalation). Rol değişimi CLAUDE.md §5.6 gereği audit'li,
-- ayrı bir yönetim akışından (service_role ile) yapılmalı.
grant usage on schema core to authenticated, service_role;
grant select on core.profiles to authenticated;
grant update (email) on core.profiles to authenticated;
grant all on core.profiles to service_role;

-- auth.users'a yeni kullanıcı eklendiğinde core.profiles'a otomatik satır
create or replace function core.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = core, pg_temp
as $$
begin
  insert into core.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function core.handle_new_user();

commit;
