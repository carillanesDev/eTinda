import { z } from "zod";

/**
 * Shared Zod Validation Schemas
 * AGENTS.md Section 10 & 15, DESIGNS.md Section 13
 */

export const centavosSchema = z
  .number()
  .int("Monetary amount must be stored in integer centavos")
  .nonnegative("Monetary amount cannot be negative");

export const signedCentavosSchema = z
  .number()
  .int("Monetary amount must be stored in integer centavos");

export const positiveQuantitySchema = z
  .number()
  .positive("Quantity must be greater than zero")
  .refine((val) => Number.isFinite(val), "Invalid quantity value");

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(120, "Product name is too long"),
  categoryId: z.string().min(1, "Please select a category"),
  baseUnit: z
    .string()
    .trim()
    .min(1, "Base unit is required (e.g., pc, pack, kg, sachet)")
    .max(24, "Unit label is too long"),
  sellingPriceCentavos: z
    .number()
    .int()
    .positive("Selling price must be greater than ₱0.00"),
  latestCostCentavos: z
    .number()
    .int()
    .nonnegative("Purchase cost cannot be negative"),
  lowStockThreshold: z
    .number()
    .nonnegative("Low-stock threshold cannot be negative"),
  allowDecimalQuantity: z.boolean(),
  isFrequent: z.boolean(),
  isActive: z.boolean(),
});

export const productVariantSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1, "Variant name is required").max(80),
  unitLabel: z.string().trim().min(1, "Unit label is required").max(24),
  conversionMultiplier: z
    .number()
    .positive("Conversion multiplier must be greater than 0"),
  sellingPriceCentavos: z
    .number()
    .int()
    .positive("Selling price must be greater than ₱0.00"),
  barcodeOrSku: z.string().trim().max(64).optional(),
  allowDecimalQuantity: z.boolean(),
  isActive: z.boolean(),
});

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(60, "Category name is too long"),
  sortOrder: z.number().int().nonnegative(),
});

export const customerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Customer name must be at least 2 characters")
    .max(100, "Customer name is too long"),
  contactNumber: z
    .string()
    .trim()
    .regex(
      /^(09\d{9}|\+639\d{9}|\d{7,15})$/,
      "Enter a valid Philippine mobile number (e.g., 09171234567)"
    ),
});

export const stockAdjustmentFormSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  movementType: z.enum([
    "STOCK_ADDITION",
    "STOCK_DEDUCTION",
    "STOCK_ADJUSTMENT",
  ]),
  quantityChange: z
    .number()
    .refine((val) => val !== 0 && Number.isFinite(val), {
      message: "Quantity change cannot be zero",
    }),
  reasonOrNotes: z
    .string()
    .trim()
    .min(3, "Provide a brief reason for audit trail")
    .max(240),
});

export const purchaseReceivingFormSchema = z.object({
  supplierName: z
    .string()
    .trim()
    .min(2, "Supplier or market source is required")
    .max(120),
  referenceNote: z.string().trim().max(160).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantityAdded: z.number().positive("Quantity must be > 0"),
        unitCostCentavos: z
          .number()
          .int()
          .nonnegative("Unit cost cannot be negative"),
      })
    )
    .min(1, "Add at least one received item"),
});

export const checkoutSubmissionSchema = z
  .object({
    paymentMethod: z.enum(["CASH", "UTANG", "PARTIAL_CASH_UTANG"]),
    cashTenderedCentavos: z.number().int().nonnegative(),
    totalCentavos: z.number().int().positive("Cart total must be > ₱0.00"),
    customerId: z.string().optional(),
    notes: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.paymentMethod === "CASH" &&
      data.cashTenderedCentavos < data.totalCentavos
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashTenderedCentavos"],
        message:
          "Cash tendered is less than the total amount. Switch to Utang / Partial Cash if recording credit.",
      });
    }
    if (
      (data.paymentMethod === "UTANG" ||
        data.paymentMethod === "PARTIAL_CASH_UTANG") &&
      !data.customerId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerId"],
        message: "Please select or add a customer for Utang transactions.",
      });
    }
  });

export const utangPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  amountCentavos: z
    .number()
    .int()
    .positive("Payment amount must be greater than ₱0.00"),
  notes: z.string().trim().max(200).optional(),
});

export const utangAdjustmentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  signedAmountCentavos: z
    .number()
    .int()
    .refine((val) => val !== 0, "Adjustment amount cannot be ₱0.00"),
  notes: z
    .string()
    .trim()
    .min(4, "Provide an explanation for the ledger adjustment")
    .max(240),
});

export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "Identifier must be a valid RFC 4122 UUID"
  );

export const syncEventSchema = z.object({
  eventId: uuidSchema,
  storeId: uuidSchema,
  deviceId: uuidSchema,
  userId: uuidSchema,
  eventType: z.enum([
    "SALE_CREATED",
    "SALE_VOIDED",
    "PRODUCT_UPSERTED",
    "CATEGORY_UPSERTED",
    "INVENTORY_MOVEMENT_RECORDED",
    "PURCHASE_RECORDED",
    "CUSTOMER_UPSERTED",
    "UTANG_LEDGER_RECORDED",
    "DEVICE_STATUS_UPDATED",
  ]),
  entityId: uuidSchema,
  schemaVersion: z.number().int().positive(),
  createdAt: z.string().min(1),
  payload: z.unknown(),
});

export const ownerRegistrationSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "Store name must be at least 2 characters")
    .max(120, "Store name is too long"),
  storeAddress: z
    .string()
    .trim()
    .min(3, "Store address or barangay is required")
    .max(200),
  contactNumber: z
    .string()
    .trim()
    .min(7, "Enter a valid contact number (e.g., 09171234567)")
    .max(20),
  ownerName: z
    .string()
    .trim()
    .min(2, "Owner full name must be at least 2 characters")
    .max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address (e.g., owner@etinda.ph)")
    .max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(40)
    .regex(
      /^[a-z0-9._-]+$/,
      "Username can only contain letters, numbers, dots, underscores, or hyphens"
    ),
  pinOrPassword: z
    .string()
    .trim()
    .min(4, "Password must be at least 4 characters")
    .max(64),
});

export const createStoreUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address (e.g., helper@etinda.ph)")
    .max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(40)
    .regex(
      /^[a-z0-9._-]+$/,
      "Username can only contain letters, numbers, dots, underscores, or hyphens"
    ),
  role: z.enum(["ADMIN", "HELPER"]),
  pinOrPassword: z
    .string()
    .trim()
    .min(4, "Operator password must be at least 4 characters")
    .max(64),
});

export const updateStoreUserStatusSchema = z.object({
  userId: uuidSchema,
  isActive: z.boolean(),
});


