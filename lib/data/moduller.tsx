import type { SVGProps } from "react";

export type Modul = {
  ad: string;
  aciklama: string;
  ikon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
};

// Tüm modüller şu an geliştirme aşamasında; hiçbiri henüz canlıya
// alınmadı, bu yüzden burada domain/kayıt bilgisi gösterilmiyor.
export const MODULLER: Modul[] = [
  {
    ad: "Muayene & Sağlık — Klinik Asistanı",
    aciklama:
      "Randevu, hasta takibi ve oda yönetimini yapay zekâ destekli tek panelde toplayın.",
    ikon: IkonKlinik,
  },
  {
    ad: "Okul & Kreş Yönetim",
    aciklama:
      "Kayıttan devam takibine, veli iletişiminden tahsilata kadar eğitim kurumunuzun idari akışını otomatize edin.",
    ikon: IkonOkul,
  },
  {
    ad: "Catering & Yeme-İçme",
    aciklama:
      "Davet ve etkinlik teklifleri, menü maliyeti ve tedarik sürecini tek ekrandan yönetin.",
    ikon: IkonCatering,
  },
  {
    ad: "Otel & Konaklama",
    aciklama:
      "Rezervasyon ve misafir iletişimini merkezi asistanla yürütün.",
    ikon: IkonOtel,
  },
  {
    ad: "Market & Tekel",
    aciklama:
      "Market ve tekel işletmeleri için stok ve müşteri bildirimlerini tek yerden yönetin.",
    ikon: IkonMarket,
  },
  {
    ad: "Mağaza & Butik",
    aciklama:
      "Butik ve mağazalar için stok, sipariş ve müşteri iletişimini tek ekrandan yönetin.",
    ikon: IkonButik,
  },
  {
    ad: "Sekreterya / Arama / Randevu Takip",
    aciklama:
      "Gelen aramaları ve randevuları asistan desteğiyle takip edin.",
    ikon: IkonSekreterya,
  },
  {
    ad: "Borsa & Piyasa Asistanı",
    aciklama:
      "Portföyünüzü ve piyasa hareketlerini yapay zekâ yorumuyla izleyin.",
    ikon: IkonBorsa,
  },
  {
    ad: "Ev Ekonomisi",
    aciklama:
      "Hane bütçenizi ve harcamalarınızı tek yerden takip edin, tasarruf önerileri alın.",
    ikon: IkonEv,
  },
  {
    ad: "Sosyal Medya & Dijital Pazarlama",
    aciklama:
      "İçerik takvimi ve paylaşımlarınızı asistan desteğiyle planlayın.",
    ikon: IkonSosyalMedya,
  },
];

export function IkonKlinik(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function IkonOkul(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4 L21 8.5 L12 13 L3 8.5 Z" />
      <path d="M7 10.5 V15 C7 16.5 9.2 18 12 18 C14.8 18 17 16.5 17 15 V10.5" />
    </svg>
  );
}

export function IkonCatering(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12 a8 6 0 0 0 16 0 Z" />
      <line x1="12" y1="4" x2="12" y2="7" />
      <line x1="8.5" y1="5" x2="8.5" y2="8" />
      <line x1="15.5" y1="5" x2="15.5" y2="8" />
    </svg>
  );
}

export function IkonOtel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <rect x="7" y="6" width="2" height="2" />
      <rect x="11" y="6" width="2" height="2" />
      <rect x="15" y="6" width="2" height="2" />
      <rect x="7" y="10" width="2" height="2" />
      <rect x="11" y="10" width="2" height="2" />
      <rect x="15" y="10" width="2" height="2" />
      <rect x="9" y="15" width="6" height="6" />
    </svg>
  );
}

export function IkonMarket(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8 h12 l-1 12 h-10 Z" />
      <path d="M9 8 v-2 a3 3 0 0 1 6 0 v2" />
    </svg>
  );
}

export function IkonButik(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="4.3" r="1.3" />
      <path d="M12 5.6 L4 12.5 H20 Z" />
      <line x1="5" y1="16.5" x2="19" y2="16.5" />
    </svg>
  );
}

export function IkonSekreterya(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

export function IkonBorsa(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="3,17 9,11 13,15 21,6" />
      <polyline points="15,6 21,6 21,12" />
    </svg>
  );
}

export function IkonEv(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 11 L12 4 L20 11" />
      <path d="M6 10 V20 H18 V10" />
      <line x1="10" y1="20" x2="10" y2="15" />
      <line x1="14" y1="20" x2="14" y2="15" />
      <line x1="10" y1="15" x2="14" y2="15" />
    </svg>
  );
}

export function IkonSosyalMedya(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5 h13 a2 2 0 0 1 2 2 v6 a2 2 0 0 1 -2 2 h-8 l-4 4 v-4 h-1 a2 2 0 0 1 -2 -2 v-6 a2 2 0 0 1 2 -2 Z" />
    </svg>
  );
}
