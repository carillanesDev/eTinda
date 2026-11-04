/**
 * eTinda Quantity & Unit Precision Utilities
 * AGENTS.md Section 6 & DESIGNS.md Section 13:
 * Respect product unit precision and do not assume every product is sold as a whole number.
 */

export function normalizeQuantity(
  quantity: number,
  allowDecimal: boolean
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }
  if (!allowDecimal) {
    return Math.round(quantity);
  }
  // Support up to 3 decimal places (e.g. 0.125 kg, 0.25 kg, 0.5 kg)
  return Math.round(quantity * 1000) / 1000;
}

export function formatQuantity(
  quantity: number,
  unitLabel?: string
): string {
  if (!Number.isFinite(quantity)) {
    return unitLabel ? `0 ${unitLabel}` : "0";
  }
  const rounded = Math.round(quantity * 1000) / 1000;
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(3).replace(/\.?0+$/, "");
  return unitLabel ? `${formatted} ${unitLabel}` : formatted;
}

export function roundSignedStockQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.round(quantity * 1000) / 1000;
}

export function calculateBaseUnits(
  quantity: number,
  conversionMultiplier: number
): number {
  const milliQty = Math.round(quantity * 1000);
  const milliMult = Math.round(conversionMultiplier * 1000);
  return Math.round((milliQty * milliMult) / 1000) / 1000;
}

