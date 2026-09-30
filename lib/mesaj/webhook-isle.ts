import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// Sağlayıcı webhook olaylarını işler (CLAUDE.md §6.3 "Güvenlik": ham kayıt + hızlı 200,
// işleme asenkron). Ham olay webhook_olaylari'na yazılır; burada teslim durumuna çevrilir.

const RESEND_DURUMLARI: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
};

type ResendGovde = { type?: string; created_at?: string; data?: { email_id?: string } };

// true → olay artık işlenmiş sayılır (eşleşti ya da ilgisiz). false → mesaj henüz eşleşmedi
// (webhook, worker'ın dis_mesaj_id'yi yazmasından önce gelmiş olabilir); sonra tekrar denenir.
async function resendOlayiniIsle(admin: AdminClient, govde: ResendGovde): Promise<boolean> {
  const durum = govde.type ? RESEND_DURUMLARI[govde.type] : undefined;
  const emailId = govde.data?.email_id;
  if (!durum || !emailId) return true; // ilgilenmediğimiz olay türü

  const { data } = await admin.rpc("teslim_kaydet", {
    p_dis_mesaj_id: emailId,
    p_teslim_durumu: durum,
    p_zaman: govde.created_at ?? new Date().toISOString(),
  });
  return data === true;
}

export async function webhookOlayiniIsle(admin: AdminClient, saglayici: string, disOlayId: string, govde: unknown) {
  let islendi = true;
  if (saglayici === "resend") {
    islendi = await resendOlayiniIsle(admin, (govde ?? {}) as ResendGovde);
  }
  if (islendi) {
    await admin
      .from("webhook_olaylari")
      .update({ islendi_mi: true })
      .eq("saglayici", saglayici)
      .eq("dis_olay_id", disOlayId);
  }
  return islendi;
}

const BEKLEME_SINIRI_MS = 48 * 60 * 60 * 1000;

// Worker turunda çağrılır: eşleşmemiş (yarış) ya da işlenememiş olayları yeniden dener;
// 48 saati aşanlar eşleşmese de kapatılır (sonsuz döngü olmasın).
export async function bekleyenWebhooklariIsle(admin: AdminClient, adet = 50): Promise<number> {
  const { data } = await admin
    .from("webhook_olaylari")
    .select("saglayici, dis_olay_id, govde, created_at")
    .eq("islendi_mi", false)
    .order("created_at")
    .limit(adet);

  let islenen = 0;
  for (const olay of data ?? []) {
    const islendi = await webhookOlayiniIsle(admin, olay.saglayici, olay.dis_olay_id, olay.govde);
    if (!islendi && Date.now() - new Date(olay.created_at).getTime() > BEKLEME_SINIRI_MS) {
      await admin
        .from("webhook_olaylari")
        .update({ islendi_mi: true })
        .eq("saglayici", olay.saglayici)
        .eq("dis_olay_id", olay.dis_olay_id);
    }
    if (islendi) islenen++;
  }
  return islenen;
}
