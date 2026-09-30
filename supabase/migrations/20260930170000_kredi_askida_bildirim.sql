-- Kredi azalma bildirimi + kredi bitince askıda bekleyen mesajlar (CLAUDE.md §6.3 "Kredi").
--
-- 1) Bildirim: kredi_cuzdanlari bakiyesi eşiğin altına indiği anda (kredi.esik_alti) ve
--    sıfıra düştüğü anda (kredi.tukendi) kredi_bildirimleri'ne bir satır açılır. Tetik
--    veritabanında — bakiye hangi yoldan düşerse düşsün kaçmaz. Aynı olay aynı cüzdan için
--    24 saatte bir kez (iade/rezervasyon eşik çevresinde gidip gelirse spam olmasın).
--    Teslim (alt projenin webhook_url'i + kullanıcının e-postası) uygulamada:
--    lib/mesaj/kredi-bildirim.ts, kredi_bildirimi_al ile lease'li alınır.
-- 2) Askıda: yetersiz kredide mesaj 'failed' olmaz; durum 'pending' kalır, askiya_alinma
--    dolar, ham alıcı mesaj_alicilari'nda bekler. Bakiye artınca (yükleme, iade, elle
--    düzeltme — hangi yoldan olursa) cüzdan tetikleyicisi askıdakileri geliş sırasıyla,
--    bakiye yettiği kadar rezerve edip kuyruğa ('queued') alır: kaldığı yerden devam.
--    Askıda 30 günü aşan mesaj 'failed/askida_zaman_asimi' olur ve ham alıcı silinir (KVKK).
-- Yeni enum değeri EKLENMEZ (transaction içinde kullanılamazdı). Idempotent.

begin;

-- ── Kolonlar / tablolar ────────────────────────────────────────────────────

alter table asistan_mesaj.mesaj_istekleri
  add column if not exists askiya_alinma timestamptz;  -- dolu + durum 'pending' = kredi bekliyor

create index if not exists mesaj_istekleri_askida_idx
  on asistan_mesaj.mesaj_istekleri (proje_kullanici_id, kanal, created_at)
  where askiya_alinma is not null;

create table if not exists asistan_mesaj.kredi_bildirimleri (
  id uuid primary key default gen_random_uuid(),
  proje_kullanici_id uuid not null references asistan_mesaj.proje_kullanicilari (id) on delete cascade,
  kanal asistan_mesaj.kanal_tipi not null,
  olay text not null check (olay in ('kredi.esik_alti', 'kredi.tukendi')),
  bakiye integer not null,
  esik integer not null,
  -- bekliyor: denenecek | gonderildi | yok: hedef tanımsız (webhook_url / e-posta yok) | hata: denemeler tükendi
  webhook_durumu text not null default 'bekliyor'
    check (webhook_durumu in ('bekliyor', 'gonderildi', 'yok', 'hata')),
  eposta_durumu text not null default 'bekliyor'
    check (eposta_durumu in ('bekliyor', 'gonderildi', 'yok', 'hata')),
  deneme_sayisi integer not null default 0,
  sonraki_deneme timestamptz,
  kilit_zamani timestamptz,
  son_hata text,
  islendi_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists kredi_bildirimleri_bekleyen_idx
  on asistan_mesaj.kredi_bildirimleri (created_at) where islendi_at is null;
create index if not exists kredi_bildirimleri_cuzdan_idx
  on asistan_mesaj.kredi_bildirimleri (proje_kullanici_id, kanal, olay, created_at);

alter table asistan_mesaj.kredi_bildirimleri enable row level security;
drop policy if exists "personel_select" on asistan_mesaj.kredi_bildirimleri;
create policy "personel_select" on asistan_mesaj.kredi_bildirimleri
  for select to authenticated using (asistan_mesaj.is_personel());
grant select on asistan_mesaj.kredi_bildirimleri to authenticated;
grant all on asistan_mesaj.kredi_bildirimleri to service_role;

-- ── Sessiz saat (21:00–08:00 TRT, sabit UTC+3 — lib/zaman.ts ile aynı kural) ──
-- Verilen an sessiz saatteyse sonraki 08:00 TRT'yi, değilse kendisini döndürür.
create or replace function asistan_mesaj.sessiz_saat_sonrasi(p_an timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  with t as (select (p_an at time zone 'UTC') + interval '3 hours' as yerel)
  select case
    when extract(hour from t.yerel) >= 21
      then (date_trunc('day', t.yerel) + interval '1 day 8 hours' - interval '3 hours') at time zone 'UTC'
    when extract(hour from t.yerel) < 8
      then (date_trunc('day', t.yerel) + interval '8 hours' - interval '3 hours') at time zone 'UTC'
    else p_an
  end
  from t;
$$;

-- ── Askıdakileri devam ettir ───────────────────────────────────────────────
-- Cüzdanı kilitler (eşzamanlı yükleme/askıya alma yarışında son sözü kilidi alan söyler),
-- askıdaki istekleri geliş sırasıyla bakiye yettiği kadar rezerve edip 'queued' yapar.
-- Rezervasyon her istek için kredi_rezerve_et ile yapılır → defterde istek başına
-- 'rezervasyon' hareketi olur, sonradan kesinleşme/iade normal yoldan çalışır.
-- Geçmişte kalmış planlanan zaman "şimdi"ye çekilir; şimdi sessiz saatse 08:00 TRT'ye.
create or replace function asistan_mesaj.askidaki_mesajlari_devam_ettir(
  p_proje_kullanici_id uuid,
  p_kanal asistan_mesaj.kanal_tipi
) returns integer
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_bakiye integer;
  v_istek record;
  v_adet integer := 0;
  v_plan timestamptz := asistan_mesaj.sessiz_saat_sonrasi(now());
begin
  select kc.bakiye into v_bakiye
  from asistan_mesaj.kredi_cuzdanlari kc
  where kc.proje_kullanici_id = p_proje_kullanici_id and kc.kanal = p_kanal
  for update;

  if not found or v_bakiye <= 0 then
    return 0;
  end if;

  for v_istek in
    select mi.id
    from asistan_mesaj.mesaj_istekleri mi
    where mi.proje_kullanici_id = p_proje_kullanici_id
      and mi.kanal = p_kanal
      and mi.durum = 'pending'
      and mi.askiya_alinma is not null
    order by mi.created_at
    limit v_bakiye
    for update of mi skip locked
  loop
    perform 1 from asistan_mesaj.kredi_rezerve_et(p_proje_kullanici_id, p_kanal, 1, v_istek.id);
    exit when not found;

    update asistan_mesaj.mesaj_istekleri
    set durum = 'queued',
        askiya_alinma = null,
        hata_kodu = null,
        planlanan_zaman = case when planlanan_zaman > now() then planlanan_zaman else v_plan end
    where id = v_istek.id;
    v_adet := v_adet + 1;
  end loop;

  return v_adet;
end;
$$;

-- Yetersiz kredide API'nin çağırdığı adım: istek 'pending' + askıda işaretlenir; hemen
-- ardından devam denemesi yapılır (rezervasyon başarısız olduktan sonra, bu çağrıdan önce
-- kredi yüklenmişse mesaj askıda unutulmasın). Dönen durum: 'askida' | 'queued'.
create or replace function asistan_mesaj.mesaj_askiya_al(p_istek_id uuid)
returns table (durum text, bakiye integer, versiyon integer)
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
#variable_conflict use_column
declare
  v_pk uuid;
  v_kanal asistan_mesaj.kanal_tipi;
begin
  update asistan_mesaj.mesaj_istekleri mi
  set askiya_alinma = now(), hata_kodu = 'yetersiz_kredi'
  where mi.id = p_istek_id and mi.durum = 'pending' and not mi.sandbox
  returning mi.proje_kullanici_id, mi.kanal into v_pk, v_kanal;

  if v_pk is null then
    return;
  end if;

  perform asistan_mesaj.askidaki_mesajlari_devam_ettir(v_pk, v_kanal);

  return query
  select case when mi.durum = 'queued' then 'queued' else 'askida' end,
         coalesce(kc.bakiye, 0),
         coalesce(kc.bakiye_versiyonu, 0)
  from asistan_mesaj.mesaj_istekleri mi
  left join asistan_mesaj.kredi_cuzdanlari kc
    on kc.proje_kullanici_id = mi.proje_kullanici_id and kc.kanal = mi.kanal
  where mi.id = p_istek_id;
end;
$$;

-- ── Cüzdan tetikleyicisi: düşüşte bildirim, artışta devam ─────────────────
create or replace function asistan_mesaj.kredi_cuzdani_degisti()
returns trigger
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_olay text;
begin
  if tg_op = 'UPDATE' and new.bakiye < old.bakiye then
    v_olay := case
      when old.bakiye > 0 and new.bakiye = 0 then 'kredi.tukendi'
      when old.bakiye >= old.esik and new.bakiye < new.esik then 'kredi.esik_alti'
    end;

    if v_olay is not null and not exists (
      select 1 from asistan_mesaj.kredi_bildirimleri b
      where b.proje_kullanici_id = new.proje_kullanici_id
        and b.kanal = new.kanal
        and b.olay = v_olay
        and b.created_at > now() - interval '1 day'
    ) then
      insert into asistan_mesaj.kredi_bildirimleri (proje_kullanici_id, kanal, olay, bakiye, esik)
      values (new.proje_kullanici_id, new.kanal, v_olay, new.bakiye, new.esik);
    end if;
  elsif (tg_op = 'INSERT' and new.bakiye > 0) or (tg_op = 'UPDATE' and new.bakiye > old.bakiye) then
    perform asistan_mesaj.askidaki_mesajlari_devam_ettir(new.proje_kullanici_id, new.kanal);
  end if;
  return null;
end;
$$;

drop trigger if exists kredi_cuzdani_degisti on asistan_mesaj.kredi_cuzdanlari;
create trigger kredi_cuzdani_degisti
  after insert or update of bakiye on asistan_mesaj.kredi_cuzdanlari
  for each row
  execute function asistan_mesaj.kredi_cuzdani_degisti();

-- ── Zamanlayıcı yardımcıları (kuyruk-isle turunda çağrılır) ─────────────────

-- Güvenlik ağı: tetikleyicinin göremediği yarış (cüzdan hiç yokken askıya alınıp aynı anda
-- ilk yükleme yapılması) için bakiyesi olan her cüzdanın askıdakilerini dener.
create or replace function asistan_mesaj.askidakileri_tara()
returns integer
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_c record;
  v_toplam integer := 0;
begin
  for v_c in
    select distinct mi.proje_kullanici_id, mi.kanal
    from asistan_mesaj.mesaj_istekleri mi
    join asistan_mesaj.kredi_cuzdanlari kc
      on kc.proje_kullanici_id = mi.proje_kullanici_id and kc.kanal = mi.kanal
    where mi.askiya_alinma is not null and mi.durum = 'pending' and kc.bakiye > 0
  loop
    v_toplam := v_toplam + asistan_mesaj.askidaki_mesajlari_devam_ettir(v_c.proje_kullanici_id, v_c.kanal);
  end loop;
  return v_toplam;
end;
$$;

-- Askıda p_gun günü aşan mesajlar kapatılır: kredi rezerve edilmemişti (iade yok),
-- ham alıcı silinir (KVKK: uçuştaki alıcı süresiz tutulmaz), log'a sonuç yazılır.
create or replace function asistan_mesaj.askidaki_zaman_asimi(p_gun integer default 30)
returns integer
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_adet integer;
begin
  with kapanan as (
    update asistan_mesaj.mesaj_istekleri mi
    set durum = 'failed', hata_kodu = 'askida_zaman_asimi', askiya_alinma = null
    where mi.durum = 'pending'
      and mi.askiya_alinma is not null
      and mi.askiya_alinma < now() - make_interval(days => greatest(p_gun, 1))
    returning mi.id, mi.icerik
  ),
  loglanan as (
    insert into asistan_mesaj.mesaj_loglari (istek_id, sonuc, dusen_kredi, icerik_hash, icerik_silinme_tarihi)
    select k.id, 'askida_zaman_asimi', 0,
           case when k.icerik is not null then encode(sha256(convert_to(k.icerik, 'UTF8')), 'hex') end,
           now() + interval '90 days'
    from kapanan k
    returning istek_id
  ),
  silinen as (
    delete from asistan_mesaj.mesaj_alicilari a using kapanan k where a.istek_id = k.id
  )
  select count(*) into v_adet from loglanan;
  return v_adet;
end;
$$;

-- Teslim edilecek bildirimleri 5 dk lease'le alır (eşzamanlı iki tur aynı bildirimi göndermez).
create or replace function asistan_mesaj.kredi_bildirimi_al(p_adet integer default 20)
returns table (
  id uuid,
  olay text,
  kanal asistan_mesaj.kanal_tipi,
  bakiye integer,
  esik integer,
  deneme_sayisi integer,
  webhook_durumu text,
  eposta_durumu text,
  created_at timestamptz,
  dis_kullanici_id text,
  kullanici_ad text,
  kullanici_eposta text,
  webhook_url text
)
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
#variable_conflict use_column
begin
  return query
  with secilen as (
    select b.id
    from asistan_mesaj.kredi_bildirimleri b
    where b.islendi_at is null
      and coalesce(b.sonraki_deneme, b.created_at) <= now()
      and (b.kilit_zamani is null or b.kilit_zamani < now() - interval '5 minutes')
    order by b.created_at
    limit greatest(p_adet, 1)
    for update of b skip locked
  ),
  kilitli as (
    update asistan_mesaj.kredi_bildirimleri b
    set kilit_zamani = now()
    from secilen s
    where b.id = s.id
    returning b.*
  )
  select k.id, k.olay, k.kanal, k.bakiye, k.esik, k.deneme_sayisi, k.webhook_durumu,
         k.eposta_durumu, k.created_at, pk.dis_kullanici_id, pk.ad, pk.eposta,
         case when p.aktif then nullif(btrim(p.webhook_url), '') end
  from kilitli k
  join asistan_mesaj.proje_kullanicilari pk on pk.id = k.proje_kullanici_id
  join asistan_mesaj.projeler p on p.id = pk.proje_id;
end;
$$;

-- ── Yetkiler ───────────────────────────────────────────────────────────────

revoke all on function asistan_mesaj.askidaki_mesajlari_devam_ettir(uuid, asistan_mesaj.kanal_tipi) from public, anon, authenticated;
revoke all on function asistan_mesaj.mesaj_askiya_al(uuid) from public, anon, authenticated;
revoke all on function asistan_mesaj.askidakileri_tara() from public, anon, authenticated;
revoke all on function asistan_mesaj.askidaki_zaman_asimi(integer) from public, anon, authenticated;
revoke all on function asistan_mesaj.kredi_bildirimi_al(integer) from public, anon, authenticated;
revoke all on function asistan_mesaj.kredi_cuzdani_degisti() from public, anon, authenticated;
grant execute on function asistan_mesaj.askidaki_mesajlari_devam_ettir(uuid, asistan_mesaj.kanal_tipi) to service_role;
grant execute on function asistan_mesaj.mesaj_askiya_al(uuid) to service_role;
grant execute on function asistan_mesaj.askidakileri_tara() to service_role;
grant execute on function asistan_mesaj.askidaki_zaman_asimi(integer) to service_role;
grant execute on function asistan_mesaj.kredi_bildirimi_al(integer) to service_role;
grant execute on function asistan_mesaj.sessiz_saat_sonrasi(timestamptz) to service_role;

commit;
