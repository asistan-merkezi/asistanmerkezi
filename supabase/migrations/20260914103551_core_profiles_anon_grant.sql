-- core.profiles: anon rolüne şema erişimi + SELECT grant'i.
-- RLS zaten "to authenticated" olarak scoped (profiles_select_own,
-- 20260914095651_core_profiles.sql), bu yüzden anon (oturum açmamış)
-- istekler bu grant sayesinde "permission denied for schema" (42501)
-- yerine normal PostgREST 200 + boş sonuç alır; RLS satır bazında hâlâ
-- her şeyi engellediği için anon hiçbir profile verisi göremez.
-- Idempotent: tekrar çalıştırılabilir.

begin;

grant usage on schema core to anon;
grant select on core.profiles to anon;

commit;
