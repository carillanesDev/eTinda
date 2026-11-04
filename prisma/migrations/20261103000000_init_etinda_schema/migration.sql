-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HELPER');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UTANG', 'PARTIAL_CASH_UTANG');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SALE_CASH', 'UTANG_PAYMENT');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('SALE_DEDUCTION', 'PURCHASE_RECEIPT', 'STOCK_ADDITION', 'STOCK_DEDUCTION', 'STOCK_ADJUSTMENT', 'SALE_VOID_REVERSAL');

-- CreateEnum
CREATE TYPE "UtangLedgerEntryType" AS ENUM ('CHARGE', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SyncEventProcessingStatus" AS ENUM ('ACKNOWLEDGED', 'CONFLICT', 'REJECTED');

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HELPER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "device_name" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL DEFAULT 'TABLET',
    "registered_by_user_id" UUID NOT NULL,
    "is_authorized" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMPTZ(3),
    "last_sync_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_unit" TEXT NOT NULL,
    "selling_price_centavos" INTEGER NOT NULL,
    "latest_cost_centavos" INTEGER NOT NULL,
    "low_stock_threshold" DECIMAL(12,3) NOT NULL,
    "allow_decimal_quantity" BOOLEAN NOT NULL DEFAULT false,
    "is_frequent" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "cached_stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "has_oversell_conflict" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit_label" TEXT NOT NULL,
    "conversion_multiplier" DECIMAL(12,3) NOT NULL,
    "selling_price_centavos" INTEGER NOT NULL,
    "barcode_or_sku" TEXT,
    "allow_decimal_quantity" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_records" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "reference_note" TEXT,
    "total_cost_centavos" INTEGER NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_name_snapshot" TEXT NOT NULL,
    "sync_event_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL,
    "purchase_record_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "quantity_added" DECIMAL(12,3) NOT NULL,
    "unit_cost_centavos" INTEGER NOT NULL,
    "subtotal_cost_centavos" INTEGER NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "payment_method" "PaymentMethod" NOT NULL,
    "subtotal_centavos" INTEGER NOT NULL,
    "total_centavos" INTEGER NOT NULL,
    "cash_tendered_centavos" INTEGER NOT NULL,
    "change_given_centavos" INTEGER NOT NULL,
    "utang_charged_centavos" INTEGER NOT NULL,
    "customer_id" UUID,
    "customer_name_snapshot" TEXT,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_name_snapshot" TEXT NOT NULL,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,
    "voided_by_user_id" UUID,
    "sync_event_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "product_name_snapshot" TEXT NOT NULL,
    "unit_label_snapshot" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "base_unit_multiplier" DECIMAL(12,3) NOT NULL,
    "unit_selling_price_centavos" INTEGER NOT NULL,
    "unit_cost_snapshot_centavos" INTEGER NOT NULL,
    "subtotal_centavos" INTEGER NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "sale_id" UUID,
    "customer_id" UUID,
    "customer_name_snapshot" TEXT,
    "amount_centavos" INTEGER NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "notes" TEXT,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_name_snapshot" TEXT NOT NULL,
    "sync_event_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utang_accounts" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_name_snapshot" TEXT NOT NULL,
    "contact_number_snapshot" TEXT NOT NULL,
    "cached_balance_centavos" INTEGER NOT NULL DEFAULT 0,
    "needs_reconciliation" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "utang_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utang_ledger" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "utang_account_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_name_snapshot" TEXT NOT NULL,
    "entry_type" "UtangLedgerEntryType" NOT NULL,
    "signed_amount_centavos" INTEGER NOT NULL,
    "running_balance_snapshot_centavos" INTEGER NOT NULL,
    "reference_sale_id" UUID,
    "reference_payment_id" UUID,
    "reversal_of_entry_id" UUID,
    "notes" TEXT NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_name_snapshot" TEXT NOT NULL,
    "sync_event_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utang_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_id" UUID,
    "movement_type" "InventoryMovementType" NOT NULL,
    "quantity_change" DECIMAL(12,3) NOT NULL,
    "unit_cost_centavos" INTEGER,
    "reason_or_notes" TEXT NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_name_snapshot" TEXT NOT NULL,
    "sale_id" UUID,
    "purchase_record_id" UUID,
    "reversal_of_movement_id" UUID,
    "conflict_note" TEXT,
    "sync_event_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
    "event_id" UUID NOT NULL,
    "sequence_number" BIGSERIAL NOT NULL,
    "store_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "status" "SyncEventProcessingStatus" NOT NULL DEFAULT 'ACKNOWLEDGED',
    "conflict_reason" TEXT,
    "client_created_at" TIMESTAMPTZ(3) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "sync_checkpoints" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "last_sequence_number" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_name_snapshot" TEXT NOT NULL,
    "user_role" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_store_id_role_is_active_idx" ON "users"("store_id", "role", "is_active");

-- CreateIndex
CREATE INDEX "devices_store_id_is_authorized_idx" ON "devices"("store_id", "is_authorized");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "categories_store_id_sort_order_idx" ON "categories"("store_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "categories_store_id_name_key" ON "categories"("store_id", "name");

-- CreateIndex
CREATE INDEX "products_store_id_is_active_category_id_idx" ON "products"("store_id", "is_active", "category_id");

-- CreateIndex
CREATE INDEX "products_store_id_updated_at_idx" ON "products"("store_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "products_store_id_name_key" ON "products"("store_id", "name");

-- CreateIndex
CREATE INDEX "product_variants_store_id_product_id_is_active_idx" ON "product_variants"("store_id", "product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_name_key" ON "product_variants"("product_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_records_sync_event_id_key" ON "purchase_records"("sync_event_id");

-- CreateIndex
CREATE INDEX "purchase_records_store_id_created_at_idx" ON "purchase_records"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "purchase_items_purchase_record_id_idx" ON "purchase_items"("purchase_record_id");

-- CreateIndex
CREATE INDEX "purchase_items_store_id_product_id_idx" ON "purchase_items"("store_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_sync_event_id_key" ON "sales"("sync_event_id");

-- CreateIndex
CREATE INDEX "sales_store_id_created_at_idx" ON "sales"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sales_store_id_status_created_at_idx" ON "sales"("store_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sales_store_id_customer_id_created_at_idx" ON "sales"("store_id", "customer_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sales_store_id_receipt_number_key" ON "sales"("store_id", "receipt_number");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_store_id_product_id_idx" ON "sale_items"("store_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_sync_event_id_key" ON "payments"("sync_event_id");

-- CreateIndex
CREATE INDEX "payments_store_id_created_at_idx" ON "payments"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_store_id_customer_id_created_at_idx" ON "payments"("store_id", "customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "customers_store_id_name_idx" ON "customers"("store_id", "name");

-- CreateIndex
CREATE INDEX "customers_store_id_contact_number_idx" ON "customers"("store_id", "contact_number");

-- CreateIndex
CREATE UNIQUE INDEX "utang_accounts_customer_id_key" ON "utang_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "utang_accounts_store_id_cached_balance_centavos_idx" ON "utang_accounts"("store_id", "cached_balance_centavos" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "utang_accounts_store_id_customer_id_key" ON "utang_accounts"("store_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "utang_ledger_reference_payment_id_key" ON "utang_ledger"("reference_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "utang_ledger_sync_event_id_key" ON "utang_ledger"("sync_event_id");

-- CreateIndex
CREATE INDEX "utang_ledger_utang_account_id_created_at_idx" ON "utang_ledger"("utang_account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "utang_ledger_store_id_customer_id_created_at_idx" ON "utang_ledger"("store_id", "customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_movements_store_id_product_id_created_at_idx" ON "inventory_movements"("store_id", "product_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_movements_sale_id_idx" ON "inventory_movements"("sale_id");

-- CreateIndex
CREATE INDEX "inventory_movements_purchase_record_id_idx" ON "inventory_movements"("purchase_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_events_sequence_number_key" ON "sync_events"("sequence_number");

-- CreateIndex
CREATE INDEX "sync_events_store_id_sequence_number_idx" ON "sync_events"("store_id", "sequence_number" ASC);

-- CreateIndex
CREATE INDEX "sync_events_store_id_device_id_acknowledged_at_idx" ON "sync_events"("store_id", "device_id", "acknowledged_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sync_checkpoints_device_id_key" ON "sync_checkpoints"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_checkpoints_store_id_device_id_key" ON "sync_checkpoints"("store_id", "device_id");

-- CreateIndex
CREATE INDEX "audit_logs_store_id_created_at_idx" ON "audit_logs"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_store_id_entity_type_entity_id_idx" ON "audit_logs"("store_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_registered_by_user_id_fkey" FOREIGN KEY ("registered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_record_id_fkey" FOREIGN KEY ("purchase_record_id") REFERENCES "purchase_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_accounts" ADD CONSTRAINT "utang_accounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_accounts" ADD CONSTRAINT "utang_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_ledger" ADD CONSTRAINT "utang_ledger_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_ledger" ADD CONSTRAINT "utang_ledger_utang_account_id_fkey" FOREIGN KEY ("utang_account_id") REFERENCES "utang_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_ledger" ADD CONSTRAINT "utang_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_ledger" ADD CONSTRAINT "utang_ledger_reference_sale_id_fkey" FOREIGN KEY ("reference_sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_ledger" ADD CONSTRAINT "utang_ledger_reference_payment_id_fkey" FOREIGN KEY ("reference_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_ledger" ADD CONSTRAINT "utang_ledger_reversal_of_entry_id_fkey" FOREIGN KEY ("reversal_of_entry_id") REFERENCES "utang_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_ledger" ADD CONSTRAINT "utang_ledger_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utang_ledger" ADD CONSTRAINT "utang_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_purchase_record_id_fkey" FOREIGN KEY ("purchase_record_id") REFERENCES "purchase_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reversal_of_movement_id_fkey" FOREIGN KEY ("reversal_of_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- Custom SQL CHECK Constraints enforcing financial & append-only ledger invariants
-- Aligned with AGENTS.md Sections 6, 7, 8, and 9.
-- ============================================================================

-- 1. Products & Variants Pricing & Multiplier Invariants
ALTER TABLE "products" ADD CONSTRAINT "chk_products_positive_price"
  CHECK ("selling_price_centavos" > 0 AND "latest_cost_centavos" >= 0 AND "low_stock_threshold" >= 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variants_positive_multiplier"
  CHECK ("conversion_multiplier" > 0 AND "selling_price_centavos" > 0);

-- 2. Sales Financial Settlement Invariants
ALTER TABLE "sales" ADD CONSTRAINT "chk_sales_nonnegative_amounts"
  CHECK ("subtotal_centavos" >= 0 AND "total_centavos" >= 0 AND "cash_tendered_centavos" >= 0 AND "change_given_centavos" >= 0 AND "utang_charged_centavos" >= 0);
ALTER TABLE "sales" ADD CONSTRAINT "chk_sales_settlement_balance"
  CHECK (("cash_tendered_centavos" - "change_given_centavos") + "utang_charged_centavos" = "total_centavos");
ALTER TABLE "sales" ADD CONSTRAINT "chk_sales_utang_requires_customer"
  CHECK ("utang_charged_centavos" = 0 OR "customer_id" IS NOT NULL);

-- 3. Sale Items Snapshot Invariants
ALTER TABLE "sale_items" ADD CONSTRAINT "chk_sale_items_positive"
  CHECK ("quantity" > 0 AND "base_unit_multiplier" > 0 AND "unit_selling_price_centavos" >= 0 AND "unit_cost_snapshot_centavos" >= 0 AND "subtotal_centavos" >= 0);

-- 4. Payments Invariants
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_positive_amount"
  CHECK ("amount_centavos" > 0 AND ("sale_id" IS NOT NULL OR "customer_id" IS NOT NULL));

-- 5. Utang Ledger Sign Convention Invariant (AGENTS.md Section 9: CHARGE > 0, PAYMENT < 0, ADJUSTMENT <> 0)
ALTER TABLE "utang_ledger" ADD CONSTRAINT "chk_utang_ledger_sign_convention"
  CHECK (
    ("entry_type" = 'CHARGE' AND "signed_amount_centavos" > 0) OR
    ("entry_type" = 'PAYMENT' AND "signed_amount_centavos" < 0) OR
    ("entry_type" = 'ADJUSTMENT' AND "signed_amount_centavos" <> 0)
  );

-- 6. Inventory Movements Sign Convention Invariant (AGENTS.md Section 7)
ALTER TABLE "inventory_movements" ADD CONSTRAINT "chk_inventory_movements_sign_convention"
  CHECK (
    "quantity_change" <> 0 AND (
      ("movement_type" IN ('PURCHASE_RECEIPT', 'STOCK_ADDITION', 'SALE_VOID_REVERSAL') AND "quantity_change" > 0) OR
      ("movement_type" IN ('SALE_DEDUCTION', 'STOCK_DEDUCTION') AND "quantity_change" < 0) OR
      ("movement_type" = 'STOCK_ADJUSTMENT')
    )
  );
