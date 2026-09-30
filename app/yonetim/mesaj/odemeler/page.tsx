import { redirect } from "next/navigation";

// Ödemeler, Finans bölümüne taşındı.
export default function OdemelerSayfasi() {
  redirect("/yonetim/mesaj/finans/odemeler");
}
