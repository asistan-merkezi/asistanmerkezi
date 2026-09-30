import { redirect } from "next/navigation";

// Zamanlayıcı, Sistem bölümüne taşındı.
export default function Sayfa() {
  redirect("/yonetim/mesaj/sistem/zamanlayici");
}
