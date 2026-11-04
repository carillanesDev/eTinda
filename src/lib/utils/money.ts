/**
 * eTinda Financial & Centavo Arithmetic Utilities
 * AGENTS.md Section 8 & DESIGNS.md Section 13:
 * - Store and calculate money using integer centavos.
 * - Never rely on floating-point arithmetic as the source of financial truth.
 */

const PHP_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats integer centavos (e.g. 1550) into Philippine Peso string (e.g. "₱15.50").
 */
export function formatCentavosToPHP(centavos: number): string {
  if (!Number.isFinite(centavos)) {
    return "₱0.00";
  }
  const roundedCentavos = Math.round(centavos);
  return PHP_FORMATTER.format(roundedCentavos / 100);
}

/**
 * Parses a peso string or decimal input (e.g., "15.50" or "1,250.75") into exact integer centavos (1550, 125075).
 * Uses string-based integer parsing to avoid binary floating-point drift (e.g., 19.99 * 100 = 1998.9999999999998).
 */
export function parsePesoInputToCentavos(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return 0;
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[₱,\s]/g, "").trim();
  if (!cleaned) return 0;

  const isNegative = cleaned.startsWith("-");
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;

  if (!/^\d+(\.\d{0,4})?$/.test(unsigned)) {
    const parsed = Number.parseFloat(unsigned);
    if (Number.isNaN(parsed)) return 0;
    return (isNegative ? -1 : 1) * Math.round(parsed * 100);
  }

  const [wholePart = "0", fractionPart = ""] = unsigned.split(".");
  const paddedFraction = (fractionPart + "00").slice(0, 2);
  const thirdDigit = fractionPart.length >= 3 ? Number(fractionPart[2]) : 0;

  let totalCentavos =
    Number.parseInt(wholePart, 10) * 100 + Number.parseInt(paddedFraction, 10);
  if (thirdDigit >= 5) {
    totalCentavos += 1;
  }

  return isNegative ? -totalCentavos : totalCentavos;
}

/**
 * Converts integer centavos to a plain decimal string for form inputs (e.g., 1550 -> "15.50").
 */
export function centavosToInputString(centavos: number): string {
  const safe = Math.round(centavos);
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const pesos = Math.floor(abs / 100);
  const rem = abs % 100;
  return rem === 0
    ? `${sign}${pesos}`
    : `${sign}${pesos}.${String(rem).padStart(2, "0")}`;
}

/**
 * Calculates line item subtotal in integer centavos from unit price (in centavos) and quantity (integer or up to 3 decimal places).
 * Uses integer scaling (milli-units = 1000) to prevent floating-point errors.
 */
export function calculateLineSubtotalCentavos(
  unitPriceCentavos: number,
  quantity: number
): number {
  const safePrice = Math.round(unitPriceCentavos);
  const milliQuantity = Math.round(quantity * 1000);
  return Math.round((safePrice * milliQuantity) / 1000);
}

/**
 * Sums an array of integer centavo values safely.
 */
export function sumCentavos(values: readonly number[]): number {
  let total = 0;
  for (const val of values) {
    total += Math.round(val);
  }
  return total;
}

/**
 * Computes change and utang amounts for a checkout transaction in integer centavos.
 */
export function calculateCheckoutSettlement(params: {
  totalCentavos: number;
  cashTenderedCentavos: number;
  allowUtang: boolean;
}): {
  changeDueCentavos: number;
  utangChargedCentavos: number;
  cashAppliedCentavos: number;
  isFullyCovered: boolean;
} {
  const total = Math.max(0, Math.round(params.totalCentavos));
  const cashTendered = Math.max(0, Math.round(params.cashTenderedCentavos));

  if (cashTendered >= total) {
    return {
      changeDueCentavos: cashTendered - total,
      utangChargedCentavos: 0,
      cashAppliedCentavos: total,
      isFullyCovered: true,
    };
  }

  const shortfall = total - cashTendered;
  if (params.allowUtang) {
    return {
      changeDueCentavos: 0,
      utangChargedCentavos: shortfall,
      cashAppliedCentavos: cashTendered,
      isFullyCovered: true,
    };
  }

  return {
    changeDueCentavos: 0,
    utangChargedCentavos: shortfall,
    cashAppliedCentavos: cashTendered,
    isFullyCovered: false,
  };
}

