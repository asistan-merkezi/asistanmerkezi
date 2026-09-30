-- Kanal (SMS / WhatsApp / E-posta / Telegram / Ödeme) sağlayıcı bağlantı ayarları.
-- Düz metin sır TUTULMAZ: token/key/şifre Supabase Vault'ta, tabloda yalnız Vault id'si (CLAUDE.md §2).
-- Panel sırrı asla geri okumaz; yalnız "kayıtlı" bilgisini görür. Yazma: super_admin, RPC ile.

create extension if not exists supabase_vault;

create table if not exists asistan_mesaj.saglayici_ayarlari (
  id uuid primary key default gen_random_uuid(),
  kanal text not null unique
    check (kanal in ('sms', 'whatsapp', 'eposta', 'telegram', 'odeme')),
  saglayici text,
  aktif boolean not null default false,
  api_url text,
  api_versiyonu text,
  -- gizli olmayan sağlayıcıya özel alanlar (kullanıcı kodu, SMS başlığı, app id, gönderen adres ...)
  ayarlar jsonb not null default '{}'::jsonb,
  -- { "anahtar": "<vault secret uuid>" }
  gizli_referanslari jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on asistan_mesaj.saglayici_ayarlari;
create trigger set_updated_at
  before update on asistan_mesaj.saglayici_ayarlari
  for each row execute function asistan_mesaj.set_updated_at();

alter table asistan_mesaj.saglayici_ayarlari enable row level security;

drop policy if exists "personel_select" on asistan_mesaj.saglayici_ayarlari;
create policy "personel_select" on asistan_mesaj.saglayici_ayarlari
  for select to authenticated using (asistan_mesaj.is_personel());

grant select on asistan_mesaj.saglayici_ayarlari to authenticated;
grant all on asistan_mesaj.saglayici_ayarlari to service_role;

-- Tek noktadan kayıt: ayar + Vault + audit. Boş gelen sır alanı mevcut değeri korur.
create or replace function asistan_mesaj.kanal_ayari_kaydet(
  p_kanal text,
  p_saglayici text,
  p_aktif boolean,
  p_api_url text,
  p_api_versiyonu text,
  p_ayarlar jsonb,
  p_gizliler jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refs jsonb;
  v_anahtar text;
  v_deger text;
  v_id uuid;
  v_guncellenen text[] := '{}';
begin
  if not asistan_mesaj.is_super_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  insert into asistan_mesaj.saglayici_ayarlari
    (kanal, saglayici, aktif, api_url, api_versiyonu, ayarlar, updated_by)
  values
    (p_kanal, p_saglayici, p_aktif, p_api_url, p_api_versiyonu, coalesce(p_ayarlar, '{}'), auth.uid())
  on conflict (kanal) do update set
    saglayici = excluded.saglayici,
    aktif = excluded.aktif,
    api_url = excluded.api_url,
    api_versiyonu = excluded.api_versiyonu,
    ayarlar = excluded.ayarlar,
    updated_by = excluded.updated_by;

  select gizli_referanslari into v_refs
  from asistan_mesaj.saglayici_ayarlari where kanal = p_kanal;

  for v_anahtar, v_deger in select * from jsonb_each_text(coalesce(p_gizliler, '{}'::jsonb)) loop
    if v_deger is null or v_deger = '' then
      continue;
    end if;
    if v_refs ? v_anahtar then
      perform vault.update_secret((v_refs ->> v_anahtar)::uuid, v_deger);
    else
      v_id := vault.create_secret(v_deger, 'kanal_' || p_kanal || '_' || v_anahtar);
      v_refs := v_refs || jsonb_build_object(v_anahtar, v_id);
    end if;
    v_guncellenen := v_guncellenen || v_anahtar;
  end loop;

  update asistan_mesaj.saglayici_ayarlari set gizli_referanslari = v_refs where kanal = p_kanal;

  -- audit: yalnız hangi alanların değiştiği, değerler asla
  insert into asistan_mesaj.audit_log (admin_id, eylem, hedef_tablo, hedef_id, detay)
  values (auth.uid(), 'kanal_ayari_guncelle', 'saglayici_ayarlari', p_kanal,
          jsonb_build_object('saglayici', p_saglayici, 'aktif', p_aktif, 'gizli_guncellenen', v_guncellenen));
end;
$$;

revoke all on function asistan_mesaj.kanal_ayari_kaydet(text, text, boolean, text, text, jsonb, jsonb) from public, anon;
grant execute on function asistan_mesaj.kanal_ayari_kaydet(text, text, boolean, text, text, jsonb, jsonb) to authenticated;

-- Worker/webhook için sır okuma: yalnız service_role.
create or replace function asistan_mesaj.kanal_gizli_oku(p_kanal text, p_anahtar text)
returns text
language sql
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from asistan_mesaj.saglayici_ayarlari sa
  join vault.decrypted_secrets ds on ds.id = (sa.gizli_referanslari ->> p_anahtar)::uuid
  where sa.kanal = p_kanal;
$$;

revoke all on function asistan_mesaj.kanal_gizli_oku(text, text) from public, anon, authenticated;
grant execute on function asistan_mesaj.kanal_gizli_oku(text, text) to service_role;
