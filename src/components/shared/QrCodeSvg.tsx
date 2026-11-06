"use client";

import * as React from "react";
import { generateQrMatrix } from "@/lib/utils/qrcode";

export function QrCodeSvg({
  value,
  size = 180,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const matrix = React.useMemo(() => {
    try {
      return generateQrMatrix(value);
    } catch (e) {
      console.warn("QR code generation failed, returning fallback empty matrix:", e);
      return [];
    }
  }, [value]);

  if (matrix.length === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted p-2 text-center text-[11px] text-muted-foreground"
      >
        QR Preview Unavailable
      </div>
    );
  }

  const moduleCount = matrix.length;
  const padding = 3; // Quiet zone border modules
  const totalDim = moduleCount + padding * 2;

  return (
    <svg
      viewBox={`0 0 ${totalDim} ${totalDim}`}
      width={size}
      height={size}
      className={`rounded-xl bg-white p-1.5 shadow-xs ${className}`}
      shapeRendering="crispEdges"
      aria-label="QR Code to pair device"
    >
      <rect width={totalDim} height={totalDim} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((isDark, c) =>
          isDark ? (
            <rect
              key={`${r}-${c}`}
              x={c + padding}
              y={r + padding}
              width={1}
              height={1}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
}
