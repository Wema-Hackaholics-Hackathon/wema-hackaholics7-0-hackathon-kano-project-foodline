"use client";

import QRCode from "react-qr-code";

/**
 * The redeem QR on the card face: espresso on cream inside a light tile so it
 * scans reliably against the dark card.
 */
export function CardQr({ value, size = 84 }: { value: string; size?: number }) {
  return (
    <QRCode
      value={value}
      size={size}
      bgColor="#FFF9F1"
      fgColor="#211512"
      aria-label="QR code the retailer scans to honour this card"
    />
  );
}
