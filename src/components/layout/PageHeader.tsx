"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Shield, ShoppingBasket, UserCheck } from "lucide-react";
import { SyncStatusIndicator } from "@/components/shared/SyncStatusIndicator";
import { APP_NAVIGATION_ITEMS } from "@/config/navigation";
import { getRoleDisplayLabel } from "@/lib/permissions";
import { useSessionStore } from "@/stores/useSessionStore";
import { useUIStore } from "@/stores/useUIStore";

export function PageHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useSessionStore((s) => s.role);
  const storeName = useSessionStore((s) => s.storeName);
  const logout = useSessionStore((s) => s.logout);

  const isMiniPosHiddenByUser = useUIStore((s) => s.isMiniPosHiddenByUser);
  const setMiniPosExpanded = useUIStore((s) => s.setMiniPosExpanded);

  const currentNav = APP_NAVIGATION_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const pageTitle = currentNav?.label ?? "eTinda Store Operations";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3.5 md:h-16 md:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-base font-bold text-foreground md:text-lg">
            {pageTitle}
          </h1>
        </div>
        <p className="truncate text-[11px] font-medium text-muted-foreground md:hidden">
          {storeName}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Restore Mini-POS button if user dismissed the FAB on a non-POS screen */}
        {isMiniPosHiddenByUser && pathname !== "/pos" ? (
          <button
            type="button"
            onClick={() => setMiniPosExpanded(true)}
            aria-label="Restore Quick Mini-POS"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-slate-200 cursor-pointer"
          >
            <ShoppingBasket className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline">Mini-POS</span>
          </button>
        ) : null}

        {/* Active Role Badge (Read-only in production) */}
        <div
          data-testid="header-active-role-badge"
          title={`Signed in as ${getRoleDisplayLabel(role)} (${role})`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
        >
          {role === "ADMIN" ? (
            <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <UserCheck className="h-3.5 w-3.5 text-info shrink-0" />
          )}
          <span className="hidden md:inline">{getRoleDisplayLabel(role)}</span>
          <span className="hidden sm:inline md:hidden">
            {role === "ADMIN" ? "Owner" : "Helper"}
          </span>
        </div>

        {/* Always-Visible Synchronization Status Indicator */}
        <SyncStatusIndicator />

        {/* Log Out User Button */}
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/login");
          }}
          data-testid="header-logout-btn"
          title="Log Out User"
          aria-label="Log Out User"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
}
