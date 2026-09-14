import { createMesajClient } from "@/lib/supabase/mesaj-server";
import { baglantiDurumuRozeti } from "../_bilesenler/rozetler";

export default async function KullanicilarSayfasi() {
  const supabase = await createMesajClient();

  const [{ data: kullanicilar }, { data: projeler }, { data: cuzdanlar }, { data: kimlikler }] =
    await Promise.all([
      supabase
        .from("proje_kullanicilari_maskeli")
        .select("id, proje_id, dis_kullanici_id, ad, eposta, telefon_maskeli, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("projeler").select("id, ad"),
      supabase.from("kredi_cuzdanlari").select("proje_kullanici_id, kanal, bakiye"),
      supabase
        .from("gonderen_kimlikleri")
        .select("proje_kullanici_id, kanal, baglanti_durumu")
        .eq("kanal", "whatsapp"),
    ]);

  const projeAdi = new Map((projeler ?? []).map((p) => [p.id, p.ad]));
  const bakiyeToplami = new Map<string, number>();
  for (const c of cuzdanlar ?? []) {
    bakiyeToplami.set(
      c.proje_kullanici_id,
      (bakiyeToplami.get(c.proje_kullanici_id) ?? 0) + c.bakiye,
    );
  }
  const whatsappDurumu = new Map((kimlikler ?? []).map((k) => [k.proje_kullanici_id, k.baglanti_durumu]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-panel-text-secondary">
          <span>Operasyon Konsolu</span>
          <span>/</span>
          <span className="font-semibold text-panel-primary">Kullanıcılar</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-panel-text">
          Kullanıcı &amp; Kiracı Yönetimi
        </h1>
        <p className="mt-1 text-sm text-panel-text-secondary">
          {kullanicilar?.length ?? 0} kayıtlı hesap · telefon numaraları
          maskeli gösterilir
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-panel-border bg-panel-surface shadow-sm">
        {!kullanicilar || kullanicilar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined mb-2 text-[28px] text-panel-text-disabled">
              group_off
            </span>
            <p className="text-sm font-medium text-panel-text">
              Henüz kayıtlı kullanıcı yok
            </p>
            <p className="mt-1 max-w-sm text-xs text-panel-text-secondary">
              Bir alt proje ilk kez{" "}
              <code className="rounded bg-panel-canvas px-1">
                /api/v1/kullanici/senkron
              </code>{" "}
              çağırdığında kullanıcılar burada görünecek.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border bg-panel-canvas text-xs uppercase text-panel-text-secondary">
                <th className="px-4 py-2 font-medium">Kullanıcı</th>
                <th className="px-4 py-2 font-medium">Proje</th>
                <th className="px-4 py-2 font-medium">Telefon (maskeli)</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium">Toplam Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {kullanicilar.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-2.5 text-panel-text">
                    {k.ad ?? k.dis_kullanici_id}
                    {k.eposta && (
                      <span className="block text-xs text-panel-text-secondary">
                        {k.eposta}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-panel-text-secondary">
                    {projeAdi.get(k.proje_id) ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-panel-text">
                    {k.telefon_maskeli ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {baglantiDurumuRozeti(whatsappDurumu.get(k.id) ?? "pending")}
                  </td>
                  <td className="px-4 py-2.5 text-panel-text">
                    {(bakiyeToplami.get(k.id) ?? 0).toLocaleString("tr-TR")} adet
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
