-- Panelden proje oluşturma / API anahtarı yenileme / güncelleme (yalnız super_admin, audit'li).
-- API anahtarının düz hâli DB'ye HİÇ gelmez: uygulama SHA-256 hash'ini hesaplayıp gönderir.

create or replace function asistan_mesaj.proje_olustur(
  p_kategori_id uuid,
  p_ad text,
  p_slug text,
  p_domain text,
  p_webhook_url text,
  p_api_key_hash text
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

  insert into asistan_mesaj.projeler (kategori_id, ad, slug, domain, webhook_url, api_key_hash)
  values (p_kategori_id, p_ad, p_slug, nullif(p_domain, ''), nullif(p_webhook_url, ''), p_api_key_hash)
  returning id into v_id;

  insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id, detay)
  values (auth.uid(), 'proje_olustur', 'projeler', v_id::text,
          jsonb_build_object('slug', p_slug, 'kategori_id', p_kategori_id));
  return v_id;
end;
$$;

create or replace function asistan_mesaj.proje_anahtar_yenile(p_proje_id uuid, p_api_key_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not asistan_mesaj.is_super_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  update asistan_mesaj.projeler set api_key_hash = p_api_key_hash where id = p_proje_id;
  if not found then
    raise exception 'proje yok';
  end if;

  insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id)
  values (auth.uid(), 'proje_api_anahtari_yenile', 'projeler', p_proje_id::text);
end;
$$;

create or replace function asistan_mesaj.proje_guncelle(
  p_proje_id uuid,
  p_domain text,
  p_webhook_url text,
  p_aktif boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not asistan_mesaj.is_super_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  update asistan_mesaj.projeler
  set domain = nullif(p_domain, ''), webhook_url = nullif(p_webhook_url, ''), aktif = p_aktif
  where id = p_proje_id;

  insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id, detay)
  values (auth.uid(), 'proje_guncelle', 'projeler', p_proje_id::text, jsonb_build_object('aktif', p_aktif));
end;
$$;

revoke all on function asistan_mesaj.proje_olustur(uuid, text, text, text, text, text) from public, anon;
revoke all on function asistan_mesaj.proje_anahtar_yenile(uuid, text) from public, anon;
revoke all on function asistan_mesaj.proje_guncelle(uuid, text, text, boolean) from public, anon;
grant execute on function asistan_mesaj.proje_olustur(uuid, text, text, text, text, text) to authenticated;
grant execute on function asistan_mesaj.proje_anahtar_yenile(uuid, text) to authenticated;
grant execute on function asistan_mesaj.proje_guncelle(uuid, text, text, boolean) to authenticated;
