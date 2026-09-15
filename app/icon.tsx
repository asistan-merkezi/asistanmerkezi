import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#115e59",
          borderRadius: 7,
        }}
      >
        {/* Mesaj Merkezi paneli sidebar'ındaki "hub" ikonuyla aynı marka işareti */}
        <svg width="20" height="20" viewBox="0 0 24 24">
          <line x1="12" y1="9.5" x2="12" y2="7" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="10" y1="13.5" x2="6.5" y2="16.5" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="14" y1="13.5" x2="17.5" y2="16.5" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="12" r="2.5" fill="#2DD4BF" />
          <circle cx="12" cy="4.5" r="2" fill="#2DD4BF" />
          <circle cx="5" cy="18" r="2" fill="#2DD4BF" />
          <circle cx="19" cy="18" r="2" fill="#2DD4BF" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
