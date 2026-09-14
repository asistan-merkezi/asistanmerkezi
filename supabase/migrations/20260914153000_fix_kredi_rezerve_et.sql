-- kredi_rezerve_et düzeltmesi: RETURNS TABLE (bakiye, versiyon) çıktı
-- parametreleri UPDATE içindeki "bakiye"/"kanal" kolon adlarıyla çakışıp
-- "column reference is ambiguous" (42702) hatası veriyordu. Tablo takma
-- adıyla (kc) tüm kolon referansları netleştirildi.

begin;

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
  update asistan_mesaj.kredi_cuzdanlari as kc
  set bakiye = kc.bakiye - p_adet,
      bakiye_versiyonu = kc.bakiye_versiyonu + 1
  where kc.proje_kullanici_id = p_proje_kullanici_id
    and kc.kanal = p_kanal
    and kc.bakiye >= p_adet
  returning kc.id, kc.bakiye, kc.bakiye_versiyonu
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

commit;
