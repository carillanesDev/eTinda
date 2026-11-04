"use client";

import Link from "next/link";
import { ShoppingCart, WifiOff, Boxes, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflineFallbackPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-amber-300">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning-muted text-warning">
            <WifiOff className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">You Are Currently Offline</CardTitle>
          <p className="text-sm text-muted-foreground">
            eTinda operates offline-first. Your local IndexedDB database is
            ready to record sales, check stock, and log customer utang.
          </p>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <Link
            href="/pos"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <ShoppingCart className="h-4 w-4" />
            Open Offline Point of Sale (POS)
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/inventory"
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Boxes className="h-4 w-4 text-primary" />
              Check Stock
            </Link>
            <Link
              href="/utang"
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <WalletCards className="h-4 w-4 text-primary" />
              Utang Ledger
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

