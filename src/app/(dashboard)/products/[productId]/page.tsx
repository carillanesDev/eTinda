"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ArrowLeft, Layers, History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ResponsiveDialog } from "@/components/shared/StateViews";
import {
  RecordSyncBadge,
  StockStatusBadge,
} from "@/components/shared/StatusBadges";
import { deleteProduct } from "@/features/inventory/inventoryService";
import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import { useSessionStore } from "@/stores/useSessionStore";

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const productId = params.productId;
  const role = useSessionStore((s) => s.role);
  const canViewCost = hasPermission(role, "VIEW_FINANCIAL_MARGINS");
  const canManageProducts = hasPermission(role, "MANAGE_PRODUCTS");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");

  const product = useLiveQuery(
    async () => db.products.get(productId),
    [productId]
  );

  const handleDeleteProduct = async () => {
    if (!product) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteProduct(product.id);
      setIsDeleteDialogOpen(false);
      router.push("/products");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete product"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const variants =
    useLiveQuery(
      async () =>
        db.product_variants.where("productId").equals(productId).toArray(),
      [productId]
    ) ?? [];

  const movements =
    useLiveQuery(
      async () =>
        db.inventory_movements
          .where("productId")
          .equals(productId)
          .reverse()
          .toArray(),
      [productId]
    ) ?? [];

  if (!product) {
    return (
      <div className="space-y-4">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Link>
        <p className="text-sm text-muted-foreground">Product not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Product Catalog
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{product.name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Base Selling Unit: <strong>{product.baseUnit}</strong> • Low-Stock
              Alert: ≤ {product.lowStockThreshold} {product.baseUnit}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RecordSyncBadge status={product.syncStatus} />
            {canManageProducts ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                onClick={() => setIsDeleteDialogOpen(true)}
                data-testid="delete-product-detail-btn"
              >
                <Trash2 className="h-4 w-4" />
                Delete Product
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Selling Price</p>
            <p className="mt-1 text-xl font-bold text-primary">
              <CurrencyDisplay centavos={product.sellingPriceCentavos} /> /{" "}
              {product.baseUnit}
            </p>
          </div>

          {canViewCost ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Latest Purchase Cost (Owner)
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">
                <CurrencyDisplay centavos={product.latestCostCentavos} /> /{" "}
                {product.baseUnit}
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Current Derived Stock
            </p>
            <div className="mt-1.5">
              <StockStatusBadge
                stock={product.cachedStock}
                lowStockThreshold={product.lowStockThreshold}
                unitLabel={product.baseUnit}
                hasOversellConflict={product.hasOversellConflict}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Configured Selling Units & Pack Conversions ({variants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sold only by base unit ({product.baseUnit}).
            </p>
          ) : (
            <div className="divide-y divide-border">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div>
                    <p className="font-semibold text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">
                      1 {v.unitLabel} = {v.conversionMultiplier}{" "}
                      {product.baseUnit}
                    </p>
                  </div>
                  <CurrencyDisplay
                    centavos={v.sellingPriceCentavos}
                    className="text-base font-bold text-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Stock Movement Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Append-Only Inventory Movement History ({movements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {movements.map((mov) => (
              <div
                key={mov.id}
                className="flex items-center justify-between py-2.5 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={mov.quantityChange >= 0 ? "default" : "secondary"}
                    >
                      {mov.movementType}
                    </Badge>
                    <span className="font-medium text-foreground">
                      {mov.reasonOrNotes}
                    </span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {new Date(mov.createdAt).toLocaleString("en-PH")} • By{" "}
                    {mov.userNameSnapshot}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-mono text-sm font-bold ${
                      mov.quantityChange >= 0
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {mov.quantityChange > 0
                      ? `+${mov.quantityChange}`
                      : mov.quantityChange}{" "}
                    {product.baseUnit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete Product Confirmation Dialog */}
      <ResponsiveDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Delete Product"
        description="Are you sure you want to delete this product?"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">
                  {product.name}
                </p>
                <p className="text-muted-foreground">
                  Current stock:{" "}
                  <strong>
                    {product.cachedStock} {product.baseUnit}
                  </strong>{" "}
                  • Selling Price:{" "}
                  <strong>
                    ₱{(product.sellingPriceCentavos / 100).toFixed(2)}
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

          {deleteError ? (
            <p className="text-xs font-semibold text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
              data-testid="confirm-delete-product-detail-btn"
            >
              {isDeleting ? "Deleting..." : "Delete Product"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

