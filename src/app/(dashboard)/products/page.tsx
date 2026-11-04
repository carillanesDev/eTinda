"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Copy,
  Edit3,
  FolderPlus,
  Layers,
  Lock,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import {
  EmptyState,
  ResponsiveDialog,
  SearchInput,
} from "@/components/shared/StateViews";
import {
  RecordSyncBadge,
  StockStatusBadge,
} from "@/components/shared/StatusBadges";
import {
  deleteProduct,
  duplicateProduct,
  upsertCategory,
  upsertProduct,
  upsertProductVariant,
} from "@/features/inventory/inventoryService";
import { db } from "@/lib/db/dexie";
import { SEED_CATEGORY_IDS } from "@/lib/db/seed-local";
import { hasPermission } from "@/lib/permissions";
import {
  centavosToInputString,
  parsePesoInputToCentavos,
} from "@/lib/utils/money";
import { generateDuplicateProductName } from "@/lib/utils/product";
import { useSessionStore } from "@/stores/useSessionStore";
import type { ProductEntity } from "@/types/domain";

export default function ProductsCatalogPage() {
  const role = useSessionStore((s) => s.role);
  const canManageProducts = hasPermission(role, "MANAGE_PRODUCTS");

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("ALL");

  // Product Create/Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] =
    React.useState<ProductEntity | null>(null);
  const [prodName, setProdName] = React.useState("");
  const [prodCategoryId, setProdCategoryId] = React.useState("");
  const [prodBaseUnit, setProdBaseUnit] = React.useState("pc");
  const [prodSellingPriceStr, setProdSellingPriceStr] = React.useState("");
  const [prodCostStr, setProdCostStr] = React.useState("");
  const [prodThresholdStr, setProdThresholdStr] = React.useState("10");
  const [prodInitialStockStr, setProdInitialStockStr] = React.useState("0");
  const [prodAllowDecimal, setProdAllowDecimal] = React.useState(false);
  const [prodIsFrequent, setProdIsFrequent] = React.useState(false);
  const [prodIsActive, setProdIsActive] = React.useState(true);
  const [formError, setFormError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successNotice, setSuccessNotice] = React.useState<string | null>(null);
  const [deleteConfirmationProduct, setDeleteConfirmationProduct] =
    React.useState<ProductEntity | null>(null);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");

  // Variant Modal State
  const [variantTargetProduct, setVariantTargetProduct] =
    React.useState<ProductEntity | null>(null);
  const [varName, setVarName] = React.useState("");
  const [varUnitLabel, setVarUnitLabel] = React.useState("tie (6s)");
  const [varMultiplierStr, setVarMultiplierStr] = React.useState("6");
  const [varPriceStr, setVarPriceStr] = React.useState("");

  const categoriesQuery = useLiveQuery(async () => {
    return db.categories.orderBy("sortOrder").toArray();
  }, []);
  const categories = React.useMemo(
    () => categoriesQuery ?? [],
    [categoriesQuery]
  );

  const products =
    useLiveQuery(async () => {
      return db.products.orderBy("name").toArray();
    }, []) ?? [];

  const variantsQuery = useLiveQuery(async () => {
    return db.product_variants.toArray();
  }, []);

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const variantsByProduct = React.useMemo(() => {
    const allVariants = variantsQuery ?? [];
    const map = new Map<string, typeof allVariants>();
    for (const v of allVariants) {
      const arr = map.get(v.productId) ?? [];
      arr.push(v);
      map.set(v.productId, arr);
    }
    return map;
  }, [variantsQuery]);

  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "ALL" && p.categoryId !== selectedCategory) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    return p.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProdName("");
    setProdCategoryId(categories[0]?.id ?? SEED_CATEGORY_IDS.NOODLES_CANNED);
    setProdBaseUnit("pc");
    setProdSellingPriceStr("");
    setProdCostStr("");
    setProdThresholdStr("10");
    setProdInitialStockStr("0");
    setProdAllowDecimal(false);
    setProdIsFrequent(false);
    setProdIsActive(true);
    setFormError("");
    setSuccessNotice(null);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: ProductEntity) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdCategoryId(product.categoryId);
    setProdBaseUnit(product.baseUnit);
    setProdSellingPriceStr(centavosToInputString(product.sellingPriceCentavos));
    setProdCostStr(centavosToInputString(product.latestCostCentavos));
    setProdThresholdStr(String(product.lowStockThreshold));
    setProdInitialStockStr(String(product.cachedStock));
    setProdAllowDecimal(product.allowDecimalQuantity);
    setProdIsFrequent(product.isFrequent);
    setProdIsActive(product.isActive);
    setFormError("");
    setSuccessNotice(null);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    try {
      await upsertProduct(
        {
          name: prodName,
          categoryId: prodCategoryId,
          baseUnit: prodBaseUnit,
          sellingPriceCentavos: parsePesoInputToCentavos(prodSellingPriceStr),
          latestCostCentavos: parsePesoInputToCentavos(prodCostStr),
          lowStockThreshold: Number.parseFloat(prodThresholdStr) || 0,
          allowDecimalQuantity: prodAllowDecimal,
          isFrequent: prodIsFrequent,
          isActive: prodIsActive,
        },
        editingProduct?.id,
        Number.parseFloat(prodInitialStockStr) || 0
      );
      setIsProductModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save product"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateProduct = async () => {
    if (!editingProduct) return;
    setFormError("");
    setIsSubmitting(true);
    try {
      const allProductNames = products.map((p) => p.name);
      const duplicateName = generateDuplicateProductName(
        prodName.trim() || editingProduct.name,
        allProductNames
      );

      const duplicated = await duplicateProduct(editingProduct.id, {
        name: duplicateName,
        categoryId: prodCategoryId,
        baseUnit: prodBaseUnit,
        sellingPriceCentavos: parsePesoInputToCentavos(prodSellingPriceStr),
        latestCostCentavos: parsePesoInputToCentavos(prodCostStr),
        lowStockThreshold: Number.parseFloat(prodThresholdStr) || 0,
        allowDecimalQuantity: prodAllowDecimal,
        isFrequent: prodIsFrequent,
        isActive: prodIsActive,
      });

      setIsProductModalOpen(false);
      setSuccessNotice(`Product successfully duplicated as "${duplicated.name}".`);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to duplicate product"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deleteConfirmationProduct) return;
    setFormError("");
    setIsSubmitting(true);
    try {
      const res = await deleteProduct(deleteConfirmationProduct.id);
      setDeleteConfirmationProduct(null);
      setIsProductModalOpen(false);
      if (res.deleted) {
        setSuccessNotice(`Product "${res.productName}" was deleted.`);
      } else {
        setSuccessNotice(
          `Product "${res.productName}" has existing transaction history, so it was archived and removed from POS.`
        );
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to delete product"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    await upsertCategory({
      name: newCategoryName,
      sortOrder: categories.length + 1,
    });
    setNewCategoryName("");
    setIsCategoryModalOpen(false);
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantTargetProduct) return;
    await upsertProductVariant({
      productId: variantTargetProduct.id,
      name: varName,
      unitLabel: varUnitLabel,
      conversionMultiplier: Number.parseFloat(varMultiplierStr) || 1,
      sellingPriceCentavos: parsePesoInputToCentavos(varPriceStr),
      allowDecimalQuantity: false,
      isActive: true,
    });
    setVarName("");
    setVarPriceStr("");
    setVariantTargetProduct(null);
  };

  return (
    <div className="space-y-4">
      {successNotice ? (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-800 dark:text-emerald-300"
          data-testid="duplicate-success-banner"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Link
            href="/inventory"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Boxes className="h-4 w-4 text-primary" />
            Switch to Stock & Movements Ledger
          </Link>
        </div>

        {canManageProducts ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCategoryModalOpen(true)}
            >
              <FolderPlus className="h-4 w-4" />
              Categories ({categories.length})
            </Button>
            <Button
              size="sm"
              onClick={openCreateProductModal}
              data-testid="create-product-btn"
            >
              <Plus className="h-4 w-4" />
              New Product
            </Button>
          </div>
        ) : (
          <Badge variant="secondary" data-testid="helper-readonly-catalog-badge">
            <Lock className="h-3.5 w-3.5" />
            Helper Read-Only Catalog Mode
          </Badge>
        )}
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search products by name..."
          className="flex-1"
        />
        <select
          aria-label="Filter by category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="min-h-11 rounded-xl border border-input bg-card px-3.5 py-2 text-sm font-medium text-foreground"
        >
          <option value="ALL">All Categories ({products.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Product Cards Grid */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          title="No products match your filter"
          description="Try clearing the search query or adding a new product."
          actionLabel={canManageProducts ? "Add New Product" : undefined}
          onAction={canManageProducts ? openCreateProductModal : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const productVariants = variantsByProduct.get(product.id) ?? [];

            return (
              <Card
                key={product.id}
                className={!product.isActive ? "opacity-60" : ""}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {product.isFrequent ? (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
                        ) : null}
                        <Link
                          href={`/products/${product.id}`}
                          className="truncate text-sm font-bold text-foreground hover:text-primary hover:underline"
                        >
                          {product.name}
                        </Link>
                        {!product.isActive ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Archived
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {categoryMap.get(product.categoryId) ?? "General"} •
                        Base Unit: <strong>{product.baseUnit}</strong>
                      </p>
                    </div>
                    <RecordSyncBadge status={product.syncStatus} compact />
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">
                        Selling Price:
                      </span>
                      <div className="text-base font-bold text-primary">
                        <CurrencyDisplay
                          centavos={product.sellingPriceCentavos}
                        />{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          / {product.baseUnit}
                        </span>
                      </div>
                    </div>

                    {canManageProducts ? (
                      <div className="text-right">
                        <span className="text-muted-foreground">
                          Latest Cost:
                        </span>
                        <div className="text-sm font-semibold text-foreground">
                          <CurrencyDisplay
                            centavos={product.latestCostCentavos}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <StockStatusBadge
                      stock={product.cachedStock}
                      lowStockThreshold={product.lowStockThreshold}
                      unitLabel={product.baseUnit}
                      hasOversellConflict={product.hasOversellConflict}
                    />
                    <span className="text-xs text-muted-foreground">
                      Alert ≤ {product.lowStockThreshold} {product.baseUnit}
                    </span>
                  </div>

                  {/* Variants List */}
                  {productVariants.length > 0 ? (
                    <div className="space-y-1 border-t border-border pt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Selling Unit Conversions ({productVariants.length})
                      </p>
                      {productVariants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-foreground">
                            {v.name} ({v.conversionMultiplier}{" "}
                            {product.baseUnit})
                          </span>
                          <CurrencyDisplay
                            centavos={v.sellingPriceCentavos}
                            className="text-primary"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Actions */}
                  {canManageProducts ? (
                    <div className="flex items-center justify-end gap-2 border-t border-border pt-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVariantTargetProduct(product)}
                      >
                        <Layers className="h-3.5 w-3.5" />+ Unit/Pack
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEditProductModal(product)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                        onClick={() => setDeleteConfirmationProduct(product)}
                        data-testid={`delete-product-card-btn-${product.id}`}
                        title={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Product Modal */}
      <ResponsiveDialog
        open={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? "Edit Store Product" : "Add New Store Product"}
        description="Configure product details, base unit, and integer-centavo pricing."
      >
        <form onSubmit={handleSaveProduct} className="space-y-3.5">
          <div>
            <label
              htmlFor="prod-name-input"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Product Name
            </label>
            <Input
              id="prod-name-input"
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              placeholder="e.g., Century Tuna Flakes in Oil 155g"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="prod-cat-select"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Category
              </label>
              <select
                id="prod-cat-select"
                value={prodCategoryId}
                onChange={(e) => setProdCategoryId(e.target.value)}
                className="flex min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="prod-unit-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Base Selling Unit
              </label>
              <Input
                id="prod-unit-input"
                value={prodBaseUnit}
                onChange={(e) => setProdBaseUnit(e.target.value)}
                placeholder="pc, pack, can, sachet, kg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="prod-price-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Selling Price (₱)
              </label>
              <Input
                id="prod-price-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={prodSellingPriceStr}
                onChange={(e) => setProdSellingPriceStr(e.target.value)}
                placeholder="25.00"
                required
              />
            </div>
            <div>
              <label
                htmlFor="prod-cost-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Purchase Cost (₱)
              </label>
              <Input
                id="prod-cost-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={prodCostStr}
                onChange={(e) => setProdCostStr(e.target.value)}
                placeholder="20.50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="prod-threshold-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Low-Stock Alert Threshold
              </label>
              <Input
                id="prod-threshold-input"
                type="number"
                step="1"
                min="0"
                value={prodThresholdStr}
                onChange={(e) => setProdThresholdStr(e.target.value)}
              />
            </div>
            {!editingProduct ? (
              <div>
                <label
                  htmlFor="prod-init-stock-input"
                  className="mb-1 block text-xs font-semibold text-foreground"
                >
                  Opening Stock ({prodBaseUnit})
                </label>
                <Input
                  id="prod-init-stock-input"
                  type="number"
                  step="any"
                  min="0"
                  value={prodInitialStockStr}
                  onChange={(e) => setProdInitialStockStr(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
            <label className="flex items-center gap-2 font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={prodIsFrequent}
                onChange={(e) => setProdIsFrequent(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              Pin to POS &ldquo;Frequent Items&rdquo; for 1-tap access
            </label>
            <label className="flex items-center gap-2 font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={prodAllowDecimal}
                onChange={(e) => setProdAllowDecimal(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              Allow fractional/decimal quantities (e.g., 0.25 kg rice or sugar)
            </label>
            <label className="flex items-center gap-2 font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={prodIsActive}
                onChange={(e) => setProdIsActive(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              Product is Active in POS
            </label>
          </div>

          {formError ? (
            <p className="text-xs font-semibold text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
            {editingProduct && canManageProducts ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirmationProduct(editingProduct)}
                  disabled={isSubmitting}
                  data-testid="delete-product-btn"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicateProduct}
                  disabled={isSubmitting}
                  data-testid="duplicate-product-btn"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {isSubmitting ? "Duplicating..." : "Duplicate"}
                </Button>
              </div>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProductModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingProduct
                    ? "Update Product"
                    : "Save Product"}
              </Button>
            </div>
          </div>
        </form>
      </ResponsiveDialog>

      {/* Category Manager Dialog */}
      <ResponsiveDialog
        open={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Manage Store Categories"
      >
        <div className="space-y-4">
          <form onSubmit={handleSaveCategory} className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name (e.g., Frozen & Ice)"
              required
            />
            <Button type="submit">Add</Button>
          </form>
          <div className="divide-y divide-border rounded-xl border border-border">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-3.5 py-2.5 text-sm"
              >
                <span className="font-medium text-foreground">{cat.name}</span>
                <RecordSyncBadge status={cat.syncStatus} compact />
              </div>
            ))}
          </div>
        </div>
      </ResponsiveDialog>

      {/* Add Variant / Unit Conversion Modal */}
      <ResponsiveDialog
        open={Boolean(variantTargetProduct)}
        onClose={() => setVariantTargetProduct(null)}
        title={`Add Selling Unit for ${variantTargetProduct?.name ?? ""}`}
        description="Define a pack, tie, or case conversion multiplier in base units."
      >
        <form onSubmit={handleSaveVariant} className="space-y-3.5">
          <div>
            <label
              htmlFor="var-name-input"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Variant / Pack Label
            </label>
            <Input
              id="var-name-input"
              value={varName}
              onChange={(e) => setVarName(e.target.value)}
              placeholder="e.g., Half-Dozen Tie (6 Packs)"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="var-unit-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Short Unit Label
              </label>
              <Input
                id="var-unit-input"
                value={varUnitLabel}
                onChange={(e) => setVarUnitLabel(e.target.value)}
                placeholder="tie (6s)"
                required
              />
            </div>
            <div>
              <label
                htmlFor="var-mult-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Base Unit Multiplier ({variantTargetProduct?.baseUnit})
              </label>
              <Input
                id="var-mult-input"
                type="number"
                step="any"
                min="0.1"
                value={varMultiplierStr}
                onChange={(e) => setVarMultiplierStr(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="var-price-input"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Variant Selling Price (₱)
            </label>
            <Input
              id="var-price-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={varPriceStr}
              onChange={(e) => setVarPriceStr(e.target.value)}
              placeholder="e.g., 102.00"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setVariantTargetProduct(null)}
            >
              Cancel
            </Button>
            <Button type="submit">Save Unit Conversion</Button>
          </div>
        </form>
      </ResponsiveDialog>

      {/* Delete Product Confirmation Dialog */}
      <ResponsiveDialog
        open={Boolean(deleteConfirmationProduct)}
        onClose={() => setDeleteConfirmationProduct(null)}
        title="Delete Product"
        description="Are you sure you want to delete this product?"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">
                  {deleteConfirmationProduct?.name}
                </p>
                <p className="text-muted-foreground">
                  Current stock:{" "}
                  <strong>
                    {deleteConfirmationProduct?.cachedStock}{" "}
                    {deleteConfirmationProduct?.baseUnit}
                  </strong>{" "}
                  • Selling Price:{" "}
                  <strong>
                    ₱
                    {(
                      (deleteConfirmationProduct?.sellingPriceCentavos ?? 0) /
                      100
                    ).toFixed(2)}
                  </strong>
                </p>
                <p className="text-[11px] text-muted-foreground pt-1">
                  If this product has existing sales or inventory transaction
                  history, it will be safely deactivated and archived from POS
                  to preserve store financial audit history.
                </p>
              </div>
            </div>
          </div>

          {formError ? (
            <p className="text-xs font-semibold text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmationProduct(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDeleteProduct}
              disabled={isSubmitting}
              data-testid="confirm-delete-product-btn"
            >
              {isSubmitting ? "Deleting..." : "Delete Product"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
