-- Gönderim motoru altyapısı (CLAUDE.md §6.3 akış): kill switch, sandbox modu,
-- veritabanı tabanlı kuyruk (lease + skip locked), sonuçlandırma (kesinleşme/iade),
-- teslim durumu. QStash/Upstash gerekmez — kuyruk mesaj_istekleri'nin kendisi.
-- Idempotent: birden fazla kez çalıştırılabilir. Yeni enum değeri EKLENMEZ
-- (transaction içinde kullanılamazdı); kuyruk durumu kilit_zamani (lease) ile izlenir.

-- ── Kolonlar ───────────────────────────────────────────────────────────────

alter table asistan_mesaj.mesaj_istekleri
  add column if not exists konu text,                              -- e-posta konusu (opsiyonel)
  add column if not exists sandbox boolean not null default false, -- gerçek sağlayıcıya gitmez, kredi düşmez
  add column if not exists deneme_sayisi integer not null default 0,
  add column if not exists sonraki_deneme timestamptz,
  add column if not exists kilit_zamani timestamptz;               -- worker lease'i (5 dk)

alter table asistan_mesaj.projeler
  add column if not exists sandbox boolean not null default false;

alter table asistan_mesaj.mesaj_loglari
  add column if not exists teslim_durumu text;                     -- delivered | bounced | complained | delayed

-- ── Uçuştaki alıcı ─────────────────────────────────────────────────────────
-- mesaj_istekleri yalnız alici_hash + alici_maskeli tutar; gönderim için ham alıcı
-- gerekir. Ham değer BURADA, yalnız gönderim tamamlanana kadar (sonuçlandırmada
-- silinir) durur. Panel/authenticated erişemez: RLS açık, politika yok.
create table if not exists asistan_mesaj.mesaj_alicilari (
  istek_id uuid primary key references asistan_mesaj.mesaj_istekleri (id) on delete cascade,
  alici text not null,
  created_at timestamptz not null default now()
);
alter table asistan_mesaj.mesaj_alicilari enable row level security;
revoke all on asistan_mesaj.mesaj_alicilari from anon, authenticated;
grant all on asistan_mesaj.mesaj_alicilari to service_role;

-- ── Kill switch ────────────────────────────────────────────────────────────

create table if not exists asistan_mesaj.gonderim_durdurmalari (
  id uuid primary key default gen_random_uuid(),
  kapsam text not null check (kapsam in ('genel', 'kanal', 'proje')),
  kanal asistan_mesaj.kanal_tipi,
  proje_id uuid references asistan_mesaj.projeler (id) on delete cascade,
  sebep text not null check (length(btrim(sebep)) > 0),
  aktif boolean not null default true,
  olusturan uuid references auth.users (id),
  kaldiran uuid references auth.users (id),
  kaldirildi_at timestamptz,
  created_at timestamptz not null default now(),
  constraint kapsam_alanlari check (
    (kapsam = 'genel' and kanal is null and proje_id is null) or
    (kapsam = 'kanal' and kanal is not null and proje_id is null) or
    (kapsam = 'proje' and proje_id is not null)   -- kanal doluysa: yalnız o projenin o kanalı
  )
);

-- Aynı kapsamda aynı anda tek aktif durdurma.
-- (enum→text dönüşümü index ifadesinde IMMUTABLE olmadığı için kapsam başına ayrı kısmi index.)
create unique index if not exists gonderim_durdurmalari_genel_uidx
  on asistan_mesaj.gonderim_durdurmalari (kapsam) where aktif and kapsam = 'genel';
create unique index if not exists gonderim_durdurmalari_kanal_uidx
  on asistan_mesaj.gonderim_durdurmalari (kanal) where aktif and kapsam = 'kanal';
create unique index if not exists gonderim_durdurmalari_proje_uidx
  on asistan_mesaj.gonderim_durdurmalari (proje_id) where aktif and kapsam = 'proje' and kanal is null;
create unique index if not exists gonderim_durdurmalari_proje_kanal_uidx
  on asistan_mesaj.gonderim_durdurmalari (proje_id, kanal) where aktif and kapsam = 'proje' and kanal is not null;

alter table asistan_mesaj.gonderim_durdurmalari enable row level security;
drop policy if exists "personel_select" on asistan_mesaj.gonderim_durdurmalari;
create policy "personel_select" on asistan_mesaj.gonderim_durdurmalari
  for select to authenticated using (asistan_mesaj.is_personel());
grant select on asistan_mesaj.gonderim_durdurmalari to authenticated;
grant all on asistan_mesaj.gonderim_durdurmalari to service_role;

create or replace function asistan_mesaj.gonderim_durdur(
  p_kapsam text,
  p_kanal text,
  p_proje_id uuid,
  p_sebep text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not asistan_mesaj.is_super_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  insert into asistan_mesaj.gonderim_durdurmalari (kapsam, kanal, proje_id, sebep, olusturan)
  values (p_kapsam, nullif(p_kanal, '')::asistan_mesaj.kanal_tipi, p_proje_id, p_sebep, auth.uid())
  returning id into v_id;

  insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id, detay)
  values (auth.uid(), 'gonderim_durdur', 'gonderim_durdurmalari', v_id::text,
          jsonb_build_object('kapsam', p_kapsam, 'kanal', p_kanal, 'proje_id', p_proje_id, 'sebep', p_sebep));
  return v_id;
exception
  when unique_violation then
    raise exception 'bu kapsamda zaten aktif bir durdurma var';
end;
$$;

create or replace function asistan_mesaj.gonderim_baslat(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not asistan_mesaj.is_super_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  update asistan_mesaj.gonderim_durdurmalari
  set aktif = false, kaldiran = auth.uid(), kaldirildi_at = now()
  where id = p_id and aktif;
  if not found then
    raise exception 'aktif durdurma bulunamadı';
  end if;

  insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id)
  values (auth.uid(), 'gonderim_baslat', 'gonderim_durdurmalari', p_id::text);
end;
$$;

-- Girişte kontrol: aktif bir durdurma varsa sebebini döndürür, yoksa null.
create or replace function asistan_mesaj.gonderim_engeli(p_proje_id uuid, p_kanal asistan_mesaj.kanal_tipi)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.sebep
  from asistan_mesaj.gonderim_durdurmalari d
  where d.aktif
    and (
      d.kapsam = 'genel'
      or (d.kapsam = 'kanal' and d.kanal = p_kanal)
      or (d.kapsam = 'proje' and d.proje_id = p_proje_id and (d.kanal is null or d.kanal = p_kanal))
    )
  order by d.created_at
  limit 1;
$$;

-- ── Sandbox ────────────────────────────────────────────────────────────────

create or replace function asistan_mesaj.proje_sandbox_ayarla(p_proje_id uuid, p_sandbox boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not asistan_mesaj.is_super_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  update asistan_mesaj.projeler set sandbox = p_sandbox where id = p_proje_id;
  if not found then
    raise exception 'proje yok';
  end if;

  insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id, detay)
  values (auth.uid(), 'proje_sandbox_ayarla', 'projeler', p_proje_id::text,
          jsonb_build_object('sandbox', p_sandbox));
end;
$$;

-- ── Kuyruk: alma / ertele / sonuçlandır ────────────────────────────────────

-- Vadesi gelmiş kuyruk satırlarını kilitleyip (lease) worker'a verir. Durdurulmuş
-- proje/kanal satırları atlanır (kaybolmaz, durdurma kalkınca işlenir; kredi rezerve kalır).
create or replace function asistan_mesaj.mesaj_kuyruktan_al(p_adet integer default 20)
returns table (
  istek_id uuid,
  kanal asistan_mesaj.kanal_tipi,
  mesaj_tipi asistan_mesaj.mesaj_tipi_tipi,
  icerik text,
  sablon_adi text,
  degiskenler jsonb,
  konu text,
  sandbox boolean,
  deneme_sayisi integer,
  gonderen_kimlik_id uuid,
  proje_kullanici_id uuid,
  alici text
)
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
#variable_conflict use_column
begin
  return query
  with secilen as (
    select mi.id
    from asistan_mesaj.mesaj_istekleri mi
    join asistan_mesaj.proje_kullanicilari pk on pk.id = mi.proje_kullanici_id
    where mi.durum = 'queued'
      and coalesce(mi.planlanan_zaman, mi.created_at) <= now()
      and coalesce(mi.sonraki_deneme, mi.created_at) <= now()
      and (mi.kilit_zamani is null or mi.kilit_zamani < now() - interval '5 minutes')
      and asistan_mesaj.gonderim_engeli(pk.proje_id, mi.kanal) is null
    order by mi.oncelik desc, coalesce(mi.planlanan_zaman, mi.created_at)
    limit greatest(p_adet, 1)
    for update of mi skip locked
  ),
  kilitli as (
    update asistan_mesaj.mesaj_istekleri m
    set kilit_zamani = now()
    from secilen s
    where m.id = s.id
    returning m.id, m.kanal, m.mesaj_tipi, m.icerik, m.sablon_adi, m.degiskenler, m.konu,
              m.sandbox, m.deneme_sayisi, m.gonderen_kimlik_id, m.proje_kullanici_id
  )
  select k.id, k.kanal, k.mesaj_tipi, k.icerik, k.sablon_adi, k.degiskenler, k.konu,
         k.sandbox, k.deneme_sayisi, k.gonderen_kimlik_id, k.proje_kullanici_id, a.alici
  from kilitli k
  left join asistan_mesaj.mesaj_alicilari a on a.istek_id = k.id;
end;
$$;

-- Geçici hata: lease'i bırak, deneme sayısını artır, p_saniye sonra tekrar dene.
create or replace function asistan_mesaj.mesaj_ertele(p_istek_id uuid, p_saniye integer, p_hata_kodu text)
returns void
language sql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
  update asistan_mesaj.mesaj_istekleri
  set deneme_sayisi = deneme_sayisi + 1,
      sonraki_deneme = now() + make_interval(secs => greatest(p_saniye, 1)),
      kilit_zamani = null,
      hata_kodu = p_hata_kodu
  where id = p_istek_id and durum = 'queued';
$$;

-- Tek atomik adım: durum + kredi kesinleşme/iade + log + ham alıcının silinmesi.
-- Yalnız 'queued' satırı sonuçlandırır → çift çağrıda çift iade/kesinleşme olmaz (false döner).
create or replace function asistan_mesaj.mesaj_sonuclandir(
  p_istek_id uuid,
  p_basarili boolean,
  p_dis_mesaj_id text,
  p_hata_kodu text
) returns boolean
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_istek asistan_mesaj.mesaj_istekleri%rowtype;
  v_kredi integer := 0;
begin
  select * into v_istek from asistan_mesaj.mesaj_istekleri where id = p_istek_id for update;
  if not found or v_istek.durum <> 'queued' then
    return false;
  end if;

  if p_basarili then
    update asistan_mesaj.mesaj_istekleri
    set durum = 'sent', dis_mesaj_id = p_dis_mesaj_id, hata_kodu = null, kilit_zamani = null
    where id = p_istek_id;
    if not v_istek.sandbox then
      perform asistan_mesaj.kredi_kesinlestir(p_istek_id);
      v_kredi := 1;
    end if;
  else
    update asistan_mesaj.mesaj_istekleri
    set durum = 'failed', hata_kodu = p_hata_kodu, kilit_zamani = null
    where id = p_istek_id;
    if not v_istek.sandbox then
      perform asistan_mesaj.kredi_iade_et(p_istek_id);
    end if;
  end if;

  insert into asistan_mesaj.mesaj_loglari (istek_id, sonuc, dusen_kredi, icerik_hash, icerik_silinme_tarihi)
  values (
    p_istek_id,
    case when p_basarili then 'sent' else coalesce(p_hata_kodu, 'failed') end,
    v_kredi,
    case when v_istek.icerik is not null
         then encode(sha256(convert_to(v_istek.icerik, 'UTF8')), 'hex') end,
    now() + interval '90 days'
  );

  delete from asistan_mesaj.mesaj_alicilari where istek_id = p_istek_id;
  return true;
end;
$$;

-- Sağlayıcı webhook'u: dış mesaj id'sine göre teslim durumunu son log satırına işler.
create or replace function asistan_mesaj.teslim_kaydet(p_dis_mesaj_id text, p_teslim_durumu text, p_zaman timestamptz)
returns boolean
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_log_id uuid;
begin
  select l.id into v_log_id
  from asistan_mesaj.mesaj_istekleri mi
  join asistan_mesaj.mesaj_loglari l on l.istek_id = mi.id
  where mi.dis_mesaj_id = p_dis_mesaj_id
  order by l.created_at desc
  limit 1;

  if v_log_id is null then
    return false;
  end if;

  update asistan_mesaj.mesaj_loglari
  set teslim_durumu = p_teslim_durumu,
      teslim_zamani = case when p_teslim_durumu = 'delivered' then p_zaman else teslim_zamani end
  where id = v_log_id;
  return true;
end;
$$;

-- ── Yetkiler ───────────────────────────────────────────────────────────────

revoke all on function asistan_mesaj.gonderim_durdur(text, text, uuid, text) from public, anon;
revoke all on function asistan_mesaj.gonderim_baslat(uuid) from public, anon;
revoke all on function asistan_mesaj.proje_sandbox_ayarla(uuid, boolean) from public, anon;
grant execute on function asistan_mesaj.gonderim_durdur(text, text, uuid, text) to authenticated;
grant execute on function asistan_mesaj.gonderim_baslat(uuid) to authenticated;
grant execute on function asistan_mesaj.proje_sandbox_ayarla(uuid, boolean) to authenticated;

revoke all on function asistan_mesaj.gonderim_engeli(uuid, asistan_mesaj.kanal_tipi) from public, anon, authenticated;
revoke all on function asistan_mesaj.mesaj_kuyruktan_al(integer) from public, anon, authenticated;
revoke all on function asistan_mesaj.mesaj_ertele(uuid, integer, text) from public, anon, authenticated;
revoke all on function asistan_mesaj.mesaj_sonuclandir(uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function asistan_mesaj.teslim_kaydet(text, text, timestamptz) from public, anon, authenticated;
grant execute on function asistan_mesaj.gonderim_engeli(uuid, asistan_mesaj.kanal_tipi) to service_role;
grant execute on function asistan_mesaj.mesaj_kuyruktan_al(integer) to service_role;
grant execute on function asistan_mesaj.mesaj_ertele(uuid, integer, text) to service_role;
grant execute on function asistan_mesaj.mesaj_sonuclandir(uuid, boolean, text, text) to service_role;
grant execute on function asistan_mesaj.teslim_kaydet(text, text, timestamptz) to service_role;
