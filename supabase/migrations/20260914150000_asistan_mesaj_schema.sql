-- asistan_mesaj: mesaj merkezi şeması (CLAUDE.md §6.2/§6.3) — kategori → proje →
-- proje kullanıcısı → gönderen kimliği hiyerarşisi, kredi defteri, mesaj istek/log,
-- idempotency, webhook, zamanlayıcı defteri ve audit log.
-- Idempotent: bu blok birden fazla kez çalıştırılabilir.
--
-- ÖNEMLİ (Dashboard'da SQL çalıştırıldıktan sonra elle yapılacak):
-- Settings > API > Exposed schemas listesine "asistan_mesaj" eklenmeli, aksi halde
-- PostgREST bu şemayı göremez (core_profiles.sql'deki aynı adımın tekrarı).
--
-- KAPSAM NOTU: bu migration yalnızca şema + RLS + kredi/audit fonksiyonlarını
-- kurar. Gerçek sağlayıcı (Netgsm/Meta/Resend/Telegram) ve QStash bağlantısı
-- CLAUDE.md §9 "Açık sorunlar" gereği henüz mümkün değil (kimlik bilgisi yok);
-- ilgili kolonlar (api_key_hash, bot_token vb.) bu adımda dolduruluyor değil,
-- yalnızca yapı hazırlanıyor.

begin;

create schema if not exists asistan_mesaj;

-- ── Enum tipleri ────────────────────────────────────────────────────────────

do $$
begin
  create type asistan_mesaj.kanal_tipi as enum ('sms', 'whatsapp', 'eposta', 'telegram');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type asistan_mesaj.baglanti_durumu_tipi as enum ('pending', 'connected', 'revoked');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type asistan_mesaj.mesaj_tipi_tipi as enum ('hizmet', 'ticari');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type asistan_mesaj.mesaj_durum_tipi as enum ('pending', 'queued', 'sent', 'failed', 'iys_rejected');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type asistan_mesaj.kredi_sebep_tipi as enum ('yukleme', 'rezervasyon', 'kesinlesme', 'iade');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type asistan_mesaj.iys_durum_tipi as enum ('PERMIT', 'REFUSE');
exception
  when duplicate_object then null;
end
$$;

-- ── updated_at yardımcı fonksiyonu (core.set_updated_at ile aynı desen) ─────

create or replace function asistan_mesaj.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Tablolar ─────────────────────────────────────────────────────────────

-- kategoriler: CLAUDE.md §3'teki 8 modülün kaynağı.
create table if not exists asistan_mesaj.kategoriler (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  slug text not null unique,
  sira integer not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on asistan_mesaj.kategoriler;
create trigger set_updated_at
  before update on asistan_mesaj.kategoriler
  for each row
  execute function asistan_mesaj.set_updated_at();

-- projeler: alt proje (domain, api key, webhook).
create table if not exists asistan_mesaj.projeler (
  id uuid primary key default gen_random_uuid(),
  kategori_id uuid not null references asistan_mesaj.kategoriler (id),
  ad text not null,
  slug text not null unique,
  domain text,
  api_key_hash text not null,
  webhook_url text,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projeler_kategori_id_idx on asistan_mesaj.projeler (kategori_id);

drop trigger if exists set_updated_at on asistan_mesaj.projeler;
create trigger set_updated_at
  before update on asistan_mesaj.projeler
  for each row
  execute function asistan_mesaj.set_updated_at();

-- proje_kullanicilari: mesajı tetikleyen kiracı (alt projenin kendi kullanıcısı).
create table if not exists asistan_mesaj.proje_kullanicilari (
  id uuid primary key default gen_random_uuid(),
  proje_id uuid not null references asistan_mesaj.projeler (id) on delete cascade,
  dis_kullanici_id text not null,
  ad text,
  eposta text,
  telefon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proje_id, dis_kullanici_id)
);

create index if not exists proje_kullanicilari_proje_id_idx on asistan_mesaj.proje_kullanicilari (proje_id);

drop trigger if exists set_updated_at on asistan_mesaj.proje_kullanicilari;
create trigger set_updated_at
  before update on asistan_mesaj.proje_kullanicilari
  for each row
  execute function asistan_mesaj.set_updated_at();

-- gonderen_kimlikleri: kullanıcı ↔ kanal ↔ teknik kimlik.
create table if not exists asistan_mesaj.gonderen_kimlikleri (
  id uuid primary key default gen_random_uuid(),
  proje_kullanici_id uuid not null references asistan_mesaj.proje_kullanicilari (id) on delete cascade,
  kanal asistan_mesaj.kanal_tipi not null,
  baglanti_durumu asistan_mesaj.baglanti_durumu_tipi not null default 'pending',
  waba_id text,
  phone_number_id text,
  gonderen_ad text,
  gonderen_adres text,
  sms_basligi text,
  -- bot_token burada düz metin tutulmaz; Vault entegrasyonu (CLAUDE.md §2)
  -- kurulana kadar bu kolon boş kalır, doldurulmayacak.
  bot_token_sifreli text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proje_kullanici_id, kanal)
);

create index if not exists gonderen_kimlikleri_proje_kullanici_id_idx on asistan_mesaj.gonderen_kimlikleri (proje_kullanici_id);

drop trigger if exists set_updated_at on asistan_mesaj.gonderen_kimlikleri;
create trigger set_updated_at
  before update on asistan_mesaj.gonderen_kimlikleri
  for each row
  execute function asistan_mesaj.set_updated_at();

-- kredi_cuzdanlari: defterin kendisi, kanal bazlı bakiye + optimistic lock versiyonu.
create table if not exists asistan_mesaj.kredi_cuzdanlari (
  id uuid primary key default gen_random_uuid(),
  proje_kullanici_id uuid not null references asistan_mesaj.proje_kullanicilari (id) on delete cascade,
  kanal asistan_mesaj.kanal_tipi not null,
  bakiye integer not null default 0,
  bakiye_versiyonu integer not null default 0,
  esik integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proje_kullanici_id, kanal),
  constraint bakiye_negatif_olamaz check (bakiye >= 0)
);

drop trigger if exists set_updated_at on asistan_mesaj.kredi_cuzdanlari;
create trigger set_updated_at
  before update on asistan_mesaj.kredi_cuzdanlari
  for each row
  execute function asistan_mesaj.set_updated_at();

-- kredi_paketleri: satılabilir paket tanımları.
create table if not exists asistan_mesaj.kredi_paketleri (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  kanal asistan_mesaj.kanal_tipi not null,
  adet integer not null,
  fiyat numeric(12, 2) not null,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- odemeler: paket alımı / kredi yükleme talebi.
-- durum enum değil serbest metin: CLAUDE.md §9 "Açık sorunlar" — ödeme tahsilatı
-- sağlayıcısı henüz seçilmedi, kredi yükleme şimdilik yalnız super_admin elle
-- yapıyor; sağlayıcı seçilince durum kümesi netleşecek.
create table if not exists asistan_mesaj.odemeler (
  id uuid primary key default gen_random_uuid(),
  proje_kullanici_id uuid not null references asistan_mesaj.proje_kullanicilari (id) on delete cascade,
  paket_id uuid references asistan_mesaj.kredi_paketleri (id),
  odeme_gunu date,
  tutar numeric(12, 2) not null,
  saglayici_ref text,
  durum text not null default 'beklemede',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists odemeler_proje_kullanici_id_idx on asistan_mesaj.odemeler (proje_kullanici_id);

drop trigger if exists set_updated_at on asistan_mesaj.odemeler;
create trigger set_updated_at
  before update on asistan_mesaj.odemeler
  for each row
  execute function asistan_mesaj.set_updated_at();

-- kredi_hareketleri: defterin hareket kayıtları. odeme_id / mesaj_istek_id FK'leri
-- ileride tanımlanacak tablolara işaret ettiği için en altta ALTER TABLE ile eklenir.
create table if not exists asistan_mesaj.kredi_hareketleri (
  id uuid primary key default gen_random_uuid(),
  cuzdan_id uuid not null references asistan_mesaj.kredi_cuzdanlari (id) on delete cascade,
  kanal asistan_mesaj.kanal_tipi not null,
  miktar integer not null,
  sebep asistan_mesaj.kredi_sebep_tipi not null,
  odeme_id uuid,
  mesaj_istek_id uuid,
  -- elle_mi: manuel kredi ekleme audit tetikleyicisi için (CLAUDE.md §5.6).
  elle_mi boolean not null default false,
  aciklama text,
  created_at timestamptz not null default now()
);

create index if not exists kredi_hareketleri_cuzdan_id_idx on asistan_mesaj.kredi_hareketleri (cuzdan_id);
create index if not exists kredi_hareketleri_mesaj_istek_id_idx on asistan_mesaj.kredi_hareketleri (mesaj_istek_id);

-- mesaj_istekleri: her gönderim isteği.
create table if not exists asistan_mesaj.mesaj_istekleri (
  id uuid primary key default gen_random_uuid(),
  proje_kullanici_id uuid not null references asistan_mesaj.proje_kullanicilari (id) on delete cascade,
  gonderen_kimlik_id uuid references asistan_mesaj.gonderen_kimlikleri (id),
  kanal asistan_mesaj.kanal_tipi not null,
  mesaj_tipi asistan_mesaj.mesaj_tipi_tipi not null,
  alici_hash text not null,
  alici_maskeli text not null,
  icerik text,
  sablon_adi text,
  degiskenler jsonb,
  durum asistan_mesaj.mesaj_durum_tipi not null default 'pending',
  oncelik integer not null default 0,
  planlanan_zaman timestamptz,
  dis_mesaj_id text,
  hata_kodu text,
  idempotency_anahtari text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint icerik_veya_sablon check (icerik is not null or sablon_adi is not null)
);

create index if not exists mesaj_istekleri_proje_kullanici_id_idx on asistan_mesaj.mesaj_istekleri (proje_kullanici_id);
create index if not exists mesaj_istekleri_durum_idx on asistan_mesaj.mesaj_istekleri (durum);
create index if not exists mesaj_istekleri_kuyruk_idx on asistan_mesaj.mesaj_istekleri (planlanan_zaman) where durum = 'queued';

drop trigger if exists set_updated_at on asistan_mesaj.mesaj_istekleri;
create trigger set_updated_at
  before update on asistan_mesaj.mesaj_istekleri
  for each row
  execute function asistan_mesaj.set_updated_at();

alter table asistan_mesaj.kredi_hareketleri
  add constraint kredi_hareketleri_odeme_id_fkey
    foreign key (odeme_id) references asistan_mesaj.odemeler (id),
  add constraint kredi_hareketleri_mesaj_istek_id_fkey
    foreign key (mesaj_istek_id) references asistan_mesaj.mesaj_istekleri (id);

-- mesaj_loglari: sonuç + teslim (webhook'la güncellenir).
create table if not exists asistan_mesaj.mesaj_loglari (
  id uuid primary key default gen_random_uuid(),
  istek_id uuid not null references asistan_mesaj.mesaj_istekleri (id) on delete cascade,
  sonuc text,
  teslim_zamani timestamptz,
  dusen_kredi integer,
  icerik_hash text,
  -- icerik_silinme_tarihi: CLAUDE.md §7 saklama kuralı — 90 gün sonra redaksiyon.
  icerik_silinme_tarihi timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mesaj_loglari_istek_id_idx on asistan_mesaj.mesaj_loglari (istek_id);

-- iys_izinleri: ticari mesaj izin cache'i.
create table if not exists asistan_mesaj.iys_izinleri (
  id uuid primary key default gen_random_uuid(),
  alici_hash text not null,
  kanal asistan_mesaj.kanal_tipi not null,
  durum asistan_mesaj.iys_durum_tipi not null,
  kaynak text,
  son_kontrol timestamptz not null default now(),
  unique (alici_hash, kanal)
);

-- whatsapp_sablonlari: Meta webhook'uyla senkron tutulan şablon durumları.
create table if not exists asistan_mesaj.whatsapp_sablonlari (
  id uuid primary key default gen_random_uuid(),
  proje_id uuid not null references asistan_mesaj.projeler (id) on delete cascade,
  sablon_adi text not null,
  dil text not null default 'tr',
  durum text not null default 'beklemede',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proje_id, sablon_adi, dil)
);

drop trigger if exists set_updated_at on asistan_mesaj.whatsapp_sablonlari;
create trigger set_updated_at
  before update on asistan_mesaj.whatsapp_sablonlari
  for each row
  execute function asistan_mesaj.set_updated_at();

-- idempotency_kayitlari: CLAUDE.md §6.3 idempotency sözleşmesi.
-- yanit = null → istek hâlâ işleniyor (aynı anahtarla eşzamanlı ikinci istek 409 alır).
create table if not exists asistan_mesaj.idempotency_kayitlari (
  id uuid primary key default gen_random_uuid(),
  proje_kullanici_id uuid not null references asistan_mesaj.proje_kullanicilari (id) on delete cascade,
  anahtar text not null,
  istek_hash text not null,
  yanit jsonb,
  http_status integer,
  created_at timestamptz not null default now(),
  unique (proje_kullanici_id, anahtar)
);

-- webhook_olaylari: gelen ham webhook, imza doğrulanmadan işlenmez (uygulama katmanı).
create table if not exists asistan_mesaj.webhook_olaylari (
  id uuid primary key default gen_random_uuid(),
  saglayici text not null,
  dis_olay_id text not null,
  govde jsonb not null,
  islendi_mi boolean not null default false,
  created_at timestamptz not null default now(),
  unique (saglayici, dis_olay_id)
);

create index if not exists webhook_olaylari_bekleyen_idx on asistan_mesaj.webhook_olaylari (created_at) where islendi_mi = false;

-- planli_gorevler / planli_gorev_calismalari: merkezi cron defteri (§6.3 "pull modeli").
create table if not exists asistan_mesaj.planli_gorevler (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  hedef_url text not null,
  govde jsonb,
  -- cron: UTC (CLAUDE.md §7 zorunlu kılıyor, Europe/Istanbul değil).
  cron text not null,
  aktif boolean not null default true,
  son_calisma timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on asistan_mesaj.planli_gorevler;
create trigger set_updated_at
  before update on asistan_mesaj.planli_gorevler
  for each row
  execute function asistan_mesaj.set_updated_at();

create table if not exists asistan_mesaj.planli_gorev_calismalari (
  id uuid primary key default gen_random_uuid(),
  gorev_id uuid not null references asistan_mesaj.planli_gorevler (id) on delete cascade,
  baslangic timestamptz not null default now(),
  bitis timestamptz,
  durum text,
  hata text,
  created_at timestamptz not null default now()
);

create index if not exists planli_gorev_calismalari_gorev_id_idx on asistan_mesaj.planli_gorev_calismalari (gorev_id);

-- audit_log: append-only (CLAUDE.md §5.6 / §6.3 — telefon görüntüleme, manuel kredi ekleme).
create table if not exists asistan_mesaj.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id),
  eylem text not null,
  hedef_tablo text,
  hedef_id text,
  detay jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on asistan_mesaj.audit_log (created_at);

-- ── Kategoriler seed (CLAUDE.md §3, tanıtım listesiyle birebir) ────────────

insert into asistan_mesaj.kategoriler (ad, slug, sira, aktif)
values
  ('Catering & Yeme-İçme', 'catering', 1, true),
  ('Okul & Kreş Yönetim', 'okul-kres', 2, true),
  ('Muayene & Sağlık (Klinik Asistanı)', 'klinik', 3, true),
  ('Otel & Konaklama', 'otel', 4, true),
  ('Market / Tekel / Mağaza', 'market', 5, true),
  ('Sekreterya / Arama / Randevu Takip', 'sekreterya', 6, true),
  ('Borsa & Ev Ekonomisi', 'borsa', 7, true),
  ('Sosyal Medya & Dijital Pazarlama', 'medya', 8, true)
on conflict (slug) do nothing;

-- ── Rol helper'ları (core.profiles.rol üzerinden) ──────────────────────────

create or replace function asistan_mesaj.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = core, pg_temp
as $$
  select exists (
    select 1 from core.profiles
    where id = auth.uid() and rol = 'super_admin'
  );
$$;

create or replace function asistan_mesaj.is_personel()
returns boolean
language sql
stable
security definer
set search_path = core, pg_temp
as $$
  select exists (
    select 1 from core.profiles
    where id = auth.uid() and rol in ('super_admin', 'destek')
  );
$$;

grant execute on function asistan_mesaj.is_super_admin() to authenticated, service_role;
grant execute on function asistan_mesaj.is_personel() to authenticated, service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────
-- service_role tüm tablolarda RLS'i doğası gereği bypass eder (Supabase
-- service_role BYPASSRLS); aşağıdaki politikalar panel (authenticated/personel)
-- erişimini sınırlamak içindir. Alt proje istekleri (/api/v1) service_role
-- client'ıyla, proje bağlamı uygulama katmanında enjekte edilerek çalışır.

alter table asistan_mesaj.kategoriler enable row level security;
alter table asistan_mesaj.projeler enable row level security;
alter table asistan_mesaj.proje_kullanicilari enable row level security;
alter table asistan_mesaj.gonderen_kimlikleri enable row level security;
alter table asistan_mesaj.kredi_cuzdanlari enable row level security;
alter table asistan_mesaj.kredi_hareketleri enable row level security;
alter table asistan_mesaj.kredi_paketleri enable row level security;
alter table asistan_mesaj.odemeler enable row level security;
alter table asistan_mesaj.mesaj_istekleri enable row level security;
alter table asistan_mesaj.mesaj_loglari enable row level security;
alter table asistan_mesaj.iys_izinleri enable row level security;
alter table asistan_mesaj.whatsapp_sablonlari enable row level security;
alter table asistan_mesaj.idempotency_kayitlari enable row level security;
alter table asistan_mesaj.webhook_olaylari enable row level security;
alter table asistan_mesaj.planli_gorevler enable row level security;
alter table asistan_mesaj.planli_gorev_calismalari enable row level security;
alter table asistan_mesaj.audit_log enable row level security;

-- personel (super_admin + destek) salt-okunur panel erişimi
drop policy if exists "personel_select" on asistan_mesaj.kategoriler;
create policy "personel_select" on asistan_mesaj.kategoriler for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.projeler;
create policy "personel_select" on asistan_mesaj.projeler for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.gonderen_kimlikleri;
create policy "personel_select" on asistan_mesaj.gonderen_kimlikleri for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.kredi_cuzdanlari;
create policy "personel_select" on asistan_mesaj.kredi_cuzdanlari for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.kredi_hareketleri;
create policy "personel_select" on asistan_mesaj.kredi_hareketleri for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.kredi_paketleri;
create policy "personel_select" on asistan_mesaj.kredi_paketleri for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.odemeler;
create policy "personel_select" on asistan_mesaj.odemeler for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.mesaj_istekleri;
create policy "personel_select" on asistan_mesaj.mesaj_istekleri for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.mesaj_loglari;
create policy "personel_select" on asistan_mesaj.mesaj_loglari for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.iys_izinleri;
create policy "personel_select" on asistan_mesaj.iys_izinleri for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.whatsapp_sablonlari;
create policy "personel_select" on asistan_mesaj.whatsapp_sablonlari for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.webhook_olaylari;
create policy "personel_select" on asistan_mesaj.webhook_olaylari for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.planli_gorevler;
create policy "personel_select" on asistan_mesaj.planli_gorevler for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.planli_gorev_calismalari;
create policy "personel_select" on asistan_mesaj.planli_gorev_calismalari for select to authenticated using (asistan_mesaj.is_personel());

drop policy if exists "personel_select" on asistan_mesaj.audit_log;
create policy "personel_select" on asistan_mesaj.audit_log for select to authenticated using (asistan_mesaj.is_personel());

-- proje_kullanicilari (çiğ telefon içerir): yalnız super_admin — destek için
-- aşağıdaki maskeli view kullanılır.
drop policy if exists "super_admin_select" on asistan_mesaj.proje_kullanicilari;
create policy "super_admin_select" on asistan_mesaj.proje_kullanicilari for select to authenticated using (asistan_mesaj.is_super_admin());

-- idempotency_kayitlari: iç plumbing, panel ekranı yok — yalnız super_admin (debug amaçlı).
drop policy if exists "super_admin_select" on asistan_mesaj.idempotency_kayitlari;
create policy "super_admin_select" on asistan_mesaj.idempotency_kayitlari for select to authenticated using (asistan_mesaj.is_super_admin());

-- ── Grantlar ────────────────────────────────────────────────────────────

grant usage on schema asistan_mesaj to authenticated, service_role;

grant select on
  asistan_mesaj.kategoriler,
  asistan_mesaj.projeler,
  asistan_mesaj.proje_kullanicilari,
  asistan_mesaj.gonderen_kimlikleri,
  asistan_mesaj.kredi_cuzdanlari,
  asistan_mesaj.kredi_hareketleri,
  asistan_mesaj.kredi_paketleri,
  asistan_mesaj.odemeler,
  asistan_mesaj.mesaj_istekleri,
  asistan_mesaj.mesaj_loglari,
  asistan_mesaj.iys_izinleri,
  asistan_mesaj.whatsapp_sablonlari,
  asistan_mesaj.idempotency_kayitlari,
  asistan_mesaj.webhook_olaylari,
  asistan_mesaj.planli_gorevler,
  asistan_mesaj.planli_gorev_calismalari,
  asistan_mesaj.audit_log
to authenticated;

grant all on all tables in schema asistan_mesaj to service_role;

-- ── Telefon maskeleme + görüntüleme (§6.3 "panelde telefon maskeli... tam
-- numarayı yalnız super_admin görür ve görüntüleme audit'e yazılır") ───────

create or replace function asistan_mesaj.telefon_maskele(p_telefon text)
returns text
language sql
immutable
as $$
  select case
    when p_telefon is null then null
    when length(p_telefon) < 6 then repeat('*', length(p_telefon))
    else left(p_telefon, 3) || repeat('*', greatest(length(p_telefon) - 5, 3)) || right(p_telefon, 2)
  end;
$$;

-- security invoker olmayan (varsayılan) view: sahibi (migration'ı çalıştıran
-- rol) üzerinden değerlendirilir, WHERE is_personel() satırları zaten
-- kişiye göre filtreler — böylece destek çiğ tabloya dokunmadan maskeli veriyi görür.
create or replace view asistan_mesaj.proje_kullanicilari_maskeli as
select
  id,
  proje_id,
  dis_kullanici_id,
  ad,
  eposta,
  asistan_mesaj.telefon_maskele(telefon) as telefon_maskeli,
  created_at,
  updated_at
from asistan_mesaj.proje_kullanicilari
where asistan_mesaj.is_personel();

grant select on asistan_mesaj.proje_kullanicilari_maskeli to authenticated;

create or replace function asistan_mesaj.telefon_goster(p_proje_kullanici_id uuid)
returns text
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_telefon text;
begin
  if not asistan_mesaj.is_super_admin() then
    raise exception 'yetkisiz';
  end if;

  select telefon into v_telefon
  from asistan_mesaj.proje_kullanicilari
  where id = p_proje_kullanici_id;

  insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id)
  values (auth.uid(), 'telefon_goruntuleme', 'proje_kullanicilari', p_proje_kullanici_id::text);

  return v_telefon;
end;
$$;

grant execute on function asistan_mesaj.telefon_goster(uuid) to authenticated;

-- manuel kredi ekleme audit tetikleyicisi (§5.6)
create or replace function asistan_mesaj.audit_manuel_kredi()
returns trigger
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
begin
  if new.elle_mi then
    insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      auth.uid(),
      'manuel_kredi_ekleme',
      'kredi_hareketleri',
      new.id::text,
      jsonb_build_object('miktar', new.miktar, 'kanal', new.kanal, 'cuzdan_id', new.cuzdan_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_manuel_kredi on asistan_mesaj.kredi_hareketleri;
create trigger audit_manuel_kredi
  after insert on asistan_mesaj.kredi_hareketleri
  for each row
  execute function asistan_mesaj.audit_manuel_kredi();

-- ── Kredi rezervasyon/kesinleşme/iade fonksiyonları (§6.3 "Kredi") ─────────
-- Atomik: UPDATE ... WHERE bakiye >= :adet satır kilidiyle çalışır, ardından
-- açıklayıcı kredi_hareketleri satırı eklenir. `if (bakiye > 0)` kontrolüne
-- güvenilmez kuralı burada uygulanır — yetersiz bakiyede 0 satır döner.

create or replace function asistan_mesaj.kredi_rezerve_et(
  p_proje_kullanici_id uuid,
  p_kanal asistan_mesaj.kanal_tipi,
  p_adet integer,
  p_istek_id uuid
)
returns table (bakiye integer, versiyon integer)
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_cuzdan_id uuid;
  v_bakiye integer;
  v_versiyon integer;
begin
  update asistan_mesaj.kredi_cuzdanlari
  set bakiye = bakiye - p_adet,
      bakiye_versiyonu = bakiye_versiyonu + 1
  where proje_kullanici_id = p_proje_kullanici_id
    and kanal = p_kanal
    and bakiye >= p_adet
  returning id, kredi_cuzdanlari.bakiye, kredi_cuzdanlari.bakiye_versiyonu
  into v_cuzdan_id, v_bakiye, v_versiyon;

  if v_cuzdan_id is null then
    return;
  end if;

  insert into asistan_mesaj.kredi_hareketleri (cuzdan_id, kanal, miktar, sebep, mesaj_istek_id)
  values (v_cuzdan_id, p_kanal, -p_adet, 'rezervasyon', p_istek_id);

  bakiye := v_bakiye;
  versiyon := v_versiyon;
  return next;
end;
$$;

create or replace function asistan_mesaj.kredi_kesinlestir(p_istek_id uuid)
returns void
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_rezervasyon asistan_mesaj.kredi_hareketleri%rowtype;
begin
  select * into v_rezervasyon
  from asistan_mesaj.kredi_hareketleri
  where mesaj_istek_id = p_istek_id and sebep = 'rezervasyon'
  order by created_at desc
  limit 1;

  if v_rezervasyon.id is null then
    raise exception 'rezervasyon bulunamadı: %', p_istek_id;
  end if;

  insert into asistan_mesaj.kredi_hareketleri (cuzdan_id, kanal, miktar, sebep, mesaj_istek_id)
  values (v_rezervasyon.cuzdan_id, v_rezervasyon.kanal, 0, 'kesinlesme', p_istek_id);
end;
$$;

create or replace function asistan_mesaj.kredi_iade_et(p_istek_id uuid)
returns void
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_rezervasyon asistan_mesaj.kredi_hareketleri%rowtype;
begin
  select * into v_rezervasyon
  from asistan_mesaj.kredi_hareketleri
  where mesaj_istek_id = p_istek_id and sebep = 'rezervasyon'
  order by created_at desc
  limit 1;

  if v_rezervasyon.id is null then
    raise exception 'rezervasyon bulunamadı: %', p_istek_id;
  end if;

  update asistan_mesaj.kredi_cuzdanlari
  set bakiye = bakiye + abs(v_rezervasyon.miktar),
      bakiye_versiyonu = bakiye_versiyonu + 1
  where id = v_rezervasyon.cuzdan_id;

  insert into asistan_mesaj.kredi_hareketleri (cuzdan_id, kanal, miktar, sebep, mesaj_istek_id)
  values (v_rezervasyon.cuzdan_id, v_rezervasyon.kanal, abs(v_rezervasyon.miktar), 'iade', p_istek_id);
end;
$$;

grant execute on function asistan_mesaj.kredi_rezerve_et(uuid, asistan_mesaj.kanal_tipi, integer, uuid) to service_role;
grant execute on function asistan_mesaj.kredi_kesinlestir(uuid) to service_role;
grant execute on function asistan_mesaj.kredi_iade_et(uuid) to service_role;

commit;
