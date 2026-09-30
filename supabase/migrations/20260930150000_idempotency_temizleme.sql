-- idempotency_kayitlari temizliği (CLAUDE.md §6.3: kayıtlar 24 saat geçerli).
-- Yalnız TAMAMLANMIŞ (yanit dolu) ve süresi geçmiş kayıtlar silinir. Yanıtsız
-- kayıtlara dokunulmaz: onları uygulama katmanı 5 dk sonra devralır
-- (lib/mesaj/idempotency.ts). Kayıt mali kayıt değildir; kredi_hareketleri etkilenmez.
-- Idempotent: birden fazla kez çalıştırılabilir.
--
-- Zamanlama: pg_cron kullanılmaz (§6.3 — cron merkezdedir). Merkezi zamanlayıcı
-- (planli_gorevler / QStash) günde bir kez service_role ile şunu çağıracak:
--   supabase.schema('asistan_mesaj').rpc('idempotency_temizle')
-- Zamanlayıcı bağlanana kadar elle çağrılabilir:
--   select asistan_mesaj.idempotency_temizle();

-- Temizlik sorgusu created_at'e göre tarar; tablo büyüdükçe seq scan olmasın.
create index if not exists idempotency_kayitlari_created_at_idx
  on asistan_mesaj.idempotency_kayitlari (created_at)
  where yanit is not null;

create or replace function asistan_mesaj.idempotency_temizle(p_saat integer default 24)
returns integer
language plpgsql
security definer
set search_path = asistan_mesaj, pg_temp
as $$
declare
  v_silinen integer;
begin
  if p_saat < 1 then
    raise exception 'p_saat en az 1 olmalı';
  end if;

  delete from asistan_mesaj.idempotency_kayitlari
  where yanit is not null
    and created_at < now() - make_interval(hours => p_saat);

  get diagnostics v_silinen = row_count;
  return v_silinen;
end;
$$;

revoke all on function asistan_mesaj.idempotency_temizle(integer) from public, anon, authenticated;
grant execute on function asistan_mesaj.idempotency_temizle(integer) to service_role;
