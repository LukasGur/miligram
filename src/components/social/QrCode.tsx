"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * QR kód jako SVG. Tmavé moduly inkoustem na papíře: kontrast, se kterým
 * si poradí každý foťák, i když je displej ztlumený.
 */
export function QrCode({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(value);
    code.make();
    const count = code.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (code.isDark(row, col)) d += `M${col + 2} ${row + 2}h1v1h-1z`;
      }
    }
    // Dva moduly okraje kolem dokola: tichá zóna, bez které čtečka váhá.
    return { size: count + 4, path: d };
  }, [value]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#0e1116" />
    </svg>
  );
}
