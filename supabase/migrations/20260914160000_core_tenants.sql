-- core.tenants: kayıt formunun işletme/tam yetkili/trial bilgileri (CLAUDE.md
-- §5.1-§5.4). core.profiles'a bir ad_soyad kolonu da eklenir (kayıt yapan
-- kişinin kişisel bilgisi — form alanı, auth.users.raw_user_meta_data'dan
-- tetikleyiciyle senkronize edilir).
-- Idempotent: bu blok birden fazla kez çalıştırılabilir.

begin;

do $$
begin
  create type core.abonelik_durumu_tipi as enum ('trial', 'aktif', 'salt_okunur');
exception
  when duplicate_object then null;
end
$$;

alter table core.profiles add column if not exists ad_soyad text;

create table if not exists core.tenants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references core.profiles (id) on delete cascade,
  sirket_adi text not null,
  vergi_dairesi text not null,
  vergi_no text not null,
  kayit_yapan_gorev text not null,
  -- tam_yetkili_mi = false ise tam_yetkili_* alanları dolu olmalı (§5.1 "tam
  -- yetkili değilse tam yetkilinin bilgisi").
  tam_yetkili_mi boolean not null default true,
  tam_yetkili_ad text,
  tam_yetkili_eposta text,
  tam_yetkili_telefon text,
  -- §5.2: kayıtta tam yetkiliye onay linkli mail gider; onay gelmeden de
  -- deneme başlar ama ödeme/hesap silme/yetki devri bu alan true olana kadar
  -- kısıtlıdır (kısıtlama uygulama katmanında, bu migration kapsamında değil).
  tam_yetkili_onaylandi boolean not null default false,
  -- Kayıt formunda zorunlu onay kutusu; aşağıdaki CHECK ile false değeriyle
  -- satır oluşturulamaz — sözleşme onayı yalnız istemci tarafında değil DB'de
  -- de zorunlu kılınıyor.
  sozlesme_onaylandi boolean not null default false,
  sozlesme_onay_tarihi timestamptz not null default now(),
  -- §5.3: her yeni kiracıya otomatik 30 gün.
  trial_baslangic timestamptz not null default now(),
  trial_bitis timestamptz not null default (now() + interval '30 days'),
  abonelik_durumu core.abonelik_durumu_tipi not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id),
  constraint tam_yetkili_bilgisi_gerekli check (
    tam_yetkili_mi = true or (tam_yetkili_ad is not null and tam_yetkili_eposta is not null)
  ),
  constraint sozlesme_onayi_zorunlu check (sozlesme_onaylandi = true)
);

drop trigger if exists set_updated_at on core.tenants;
create trigger set_updated_at
  before update on core.tenants
  for each row
  execute function core.set_updated_at();

alter table core.tenants enable row level security;

-- Yazma yalnızca service_role ile (kayıt akışı auth.signUp sonrası, oturum
-- her zaman hazır olmayabileceği için service_role kullanıyor — core.profiles
-- tetikleyicisiyle aynı mantık). authenticated yalnızca kendi kaydını okur;
-- işletme bilgisi düzenleme akışı henüz yok.
drop policy if exists "tenants_select_own" on core.tenants;
create policy "tenants_select_own"
  on core.tenants
  for select
  to authenticated
  using (auth.uid() = profile_id);

grant select on core.tenants to authenticated;
grant all on core.tenants to service_role;

-- auth.users.raw_user_meta_data'daki ad_soyad'ı core.profiles'a da yazsın.
create or replace function core.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = core, pg_temp
as $$
begin
  insert into core.profiles (id, email, ad_soyad)
  values (new.id, new.email, new.raw_user_meta_data ->> 'ad_soyad')
  on conflict (id) do nothing;
  return new;
end;
$$;

commit;
