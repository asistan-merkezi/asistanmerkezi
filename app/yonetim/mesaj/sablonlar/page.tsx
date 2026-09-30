import { redirect } from "next/navigation";

// Şablonlar, Sistem bölümüne taşındı.
export default function Sayfa() {
  redirect("/yonetim/mesaj/sistem/sablonlar");
}
