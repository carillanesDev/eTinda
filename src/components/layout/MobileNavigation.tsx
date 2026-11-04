"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Shield, UserCheck } from "lucide-react";
import { getNavItemsForRole } from "@/config/navigation";
import { NavIcon } from "@/components/layout/NavIcon";
import { ResponsiveDialog } from "@/components/shared/StateViews";
import { getRoleDisplayLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";
import { useCartStore } from "@/stores/useCartStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useUIStore } from "@/stores/useUIStore";

export function MobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useSessionStore((s) => s.role);
  const userName = useSessionStore((s) => s.userName);
  const username = useSessionStore((s) => s.username);
  const logout = useSessionStore((s) => s.logout);
  const cartItemCount = useCartStore((s) => s.items.length);

  const isMoreOpen = useUIStore((s) => s.isMoreNavOpen);
  const setMoreOpen = useUIStore((s) => s.setMoreNavOpen);

  const allowedItems = getNavItemsForRole(role);
  const primarySlots = allowedItems.filter((item) => item.mobilePrimarySlot);
  const secondarySlots = allowedItems.filter((item) => !item.mobilePrimarySlot);

  const isSecondaryRouteActive = secondarySlots.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch border-t border-border bg-card/95 backdrop-blur-md md:hidden"
      >
        <div className="grid w-full grid-cols-5">
          {primarySlots.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "relative flex h-7 w-11 items-center justify-center rounded-full transition-colors",
                    isActive && "bg-primary-muted text-primary"
                  )}
                >
                  <NavIcon name={item.iconName} className="h-5 w-5" />
                  {item.id === "pos" && cartItemCount > 0 ? (
                    <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {cartItemCount}
                    </span>
                  ) : null}
                </div>
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            );
          })}

          {/* 5th Tab: More Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            data-testid="mobile-nav-more-btn"
            aria-label="More store sections and settings"
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition-colors cursor-pointer",
              isSecondaryRouteActive || isMoreOpen
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "flex h-7 w-11 items-center justify-center rounded-full",
                (isSecondaryRouteActive || isMoreOpen) &&
                  "bg-primary-muted text-primary"
              )}
            >
              <Menu className="h-5 w-5" />
            </div>
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Slide-up More Navigation Sheet */}
      <ResponsiveDialog
        open={isMoreOpen}
        onClose={() => setMoreOpen(false)}
        title="Store Sections & Role Access"
        description={`Signed in as ${userName} (${getRoleDisplayLabel(role)})`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {secondarySlots.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex min-h-13 items-center gap-3.5 rounded-xl border p-3 transition-colors",
                    isActive
                      ? "border-primary bg-primary-muted/60 text-primary-muted-foreground"
                      : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <NavIcon name={item.iconName} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Mobile Session & Logout Section */}
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-foreground">
                  {userName || "Store Operator"}
                  {username ? ` (@${username})` : ""}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-primary">
                  {role === "ADMIN" ? (
                    <Shield className="h-3.5 w-3.5" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  {getRoleDisplayLabel(role)} ({role})
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="mobile-logout-btn"
              onClick={() => {
                setMoreOpen(false);
                logout();
                router.push("/login");
              }}
              className="mt-2.5 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Log Out User
            </button>
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
}

