import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCheckoutSettlement,
  calculateLineSubtotalCentavos,
  centavosToInputString,
  formatCentavosToPHP,
  parsePesoInputToCentavos,
  sumCentavos,
} from "../src/lib/utils/money.ts";
import {
  calculateBaseUnits,
  formatQuantity,
  normalizeQuantity,
} from "../src/lib/utils/quantity.ts";
import { generateDuplicateProductName } from "../src/lib/utils/product.ts";
import {
  checkoutSubmissionSchema,
  productFormSchema,
  utangPaymentSchema,
} from "../src/lib/validation/schemas.ts";
import {
  SEED_CATEGORY_IDS,
  SEED_CUSTOMER_IDS,
} from "../src/lib/db/seed-local.ts";

describe("eTinda Financial Centavo Arithmetic & Validation", () => {
  it("avoids binary floating-point drift when parsing PHP amounts to integer centavos", () => {
    assert.equal(parsePesoInputToCentavos("19.99"), 1999);
    assert.equal(parsePesoInputToCentavos("₱1,250.75"), 125075);
    assert.equal(parsePesoInputToCentavos("0.05"), 5);
    assert.equal(centavosToInputString(1850), "18.50");
    assert.equal(formatCentavosToPHP(1850), "₱18.50");
  });

  it("calculates exact line subtotals for integer and fractional quantities (e.g. 0.25 kg rice)", () => {
    // 0.25 kg of Sinandomeng Rice @ ₱56.00/kg (5600 centavos) = ₱14.00 (1400 centavos)
    assert.equal(calculateLineSubtotalCentavos(5600, 0.25), 1400);
    // 0.75 kg of Sinandomeng Rice @ ₱56.00/kg = ₱42.00 (4200 centavos)
    assert.equal(calculateLineSubtotalCentavos(5600, 0.75), 4200);
    // 3 packs of Pancit Canton @ ₱18.00 = ₱54.00 (5400 centavos)
    assert.equal(calculateLineSubtotalCentavos(1800, 3), 5400);
    assert.equal(sumCentavos([1400, 4200, 5400]), 11000);
  });

  it("computes Cash change due and Utang partial/full settlement accurately", () => {
    const cashSale = calculateCheckoutSettlement({
      totalCentavos: 9300,
      cashTenderedCentavos: 10000,
      allowUtang: false,
    });
    assert.equal(cashSale.changeDueCentavos, 700);
    assert.equal(cashSale.utangChargedCentavos, 0);
    assert.equal(cashSale.isFullyCovered, true);

    const partialUtangSale = calculateCheckoutSettlement({
      totalCentavos: 19300,
      cashTenderedCentavos: 800,
      allowUtang: true,
    });
    assert.equal(partialUtangSale.changeDueCentavos, 0);
    assert.equal(partialUtangSale.cashAppliedCentavos, 800);
    assert.equal(partialUtangSale.utangChargedCentavos, 18500);
    assert.equal(partialUtangSale.isFullyCovered, true);
  });

  it("normalizes quantities and unit conversion multipliers accurately", () => {
    assert.equal(normalizeQuantity(2.7, false), 3);
    assert.equal(normalizeQuantity(0.25, true), 0.25);
    assert.equal(calculateBaseUnits(2, 6), 12); // 2 ties of 6 sachets = 12 sachets
    assert.equal(formatQuantity(0.75, "kg"), "0.75 kg");
  });

  it("validates checkout rules and rejects Utang without a customer", () => {
    const invalidUtang = checkoutSubmissionSchema.safeParse({
      paymentMethod: "UTANG",
      cashTenderedCentavos: 0,
      totalCentavos: 4500,
    });
    assert.equal(invalidUtang.success, false);

    const validUtang = checkoutSubmissionSchema.safeParse({
      paymentMethod: "UTANG",
      cashTenderedCentavos: 0,
      totalCentavos: 4500,
      customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
    });
    assert.equal(validUtang.success, true);

    const validProduct = productFormSchema.safeParse({
      name: "Lucky Me Pancit Canton",
      categoryId: SEED_CATEGORY_IDS.NOODLES_CANNED,
      baseUnit: "pack",
      sellingPriceCentavos: 1800,
      latestCostCentavos: 1450,
      lowStockThreshold: 12,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
    });
    assert.equal(validProduct.success, true);

    const validPayment = utangPaymentSchema.safeParse({
      customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
      amountCentavos: 5000,
    });
    assert.equal(validPayment.success, true);
  });

  it("duplicates product name by adding (2) and avoids catalog collisions", () => {
    // Basic duplication: adds (2)
    assert.equal(
      generateDuplicateProductName("Century Tuna Flakes in Oil 155g", [
        "Century Tuna Flakes in Oil 155g",
      ]),
      "Century Tuna Flakes in Oil 155g (2)"
    );

    // If (2) already exists, increments to (3)
    assert.equal(
      generateDuplicateProductName("Century Tuna Flakes in Oil 155g", [
        "Century Tuna Flakes in Oil 155g",
        "Century Tuna Flakes in Oil 155g (2)",
      ]),
      "Century Tuna Flakes in Oil 155g (3)"
    );

    // Duplicating a product that already ends in (2) increments to (3)
    assert.equal(
      generateDuplicateProductName("Century Tuna Flakes in Oil 155g (2)", [
        "Century Tuna Flakes in Oil 155g (2)",
      ]),
      "Century Tuna Flakes in Oil 155g (3)"
    );

    // Names with parentheses that are not numbers preserve inner label and append (2)
    assert.equal(
      generateDuplicateProductName("Lucky Me (Sweet & Spicy)", [
        "Lucky Me (Sweet & Spicy)",
      ]),
      "Lucky Me (Sweet & Spicy) (2)"
    );

    // Trims whitespace
    assert.equal(
      generateDuplicateProductName("  Safeguard Pure White 60g  "),
      "Safeguard Pure White 60g (2)"
    );
  });
});

