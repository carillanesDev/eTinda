"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Store,
  UserCheck,
} from "lucide-react";
import { getNavItemsForRole } from "@/config/navigation";
import { NavIcon } from "@/components/layout/NavIcon";
import { getRoleDisplayLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";
import { useCartStore } from "@/stores/useCartStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useUIStore } from "@/stores/useUIStore";

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useSessionStore((s) => s.role);
  const userName = useSessionStore((s) => s.userName);
  const username = useSessionStore((s) => s.username);
  const storeName = useSessionStore((s) => s.storeName);
  const logout = useSessionStore((s) => s.logout);
  const cartItemCount = useCartStore((s) => s.items.length);

  const isCollapsed = useUIStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const navItems = getNavItemsForRole(role);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside
      aria-label="Primary Store Navigation"
      className={cn(
        "hidden md:sticky md:top-0 md:z-30 md:flex md:h-dvh md:shrink-0 md:flex-col md:border-r md:border-border md:bg-card md:transition-all md:duration-200",
        isCollapsed ? "md:w-[76px]" : "md:w-[244px]"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "relative z-40 flex h-16 shrink-0 items-center border-b border-border px-3.5",
          isCollapsed ? "justify-center" : "justify-start"
        )}
      >
        <div className="group/brand relative flex min-w-0 items-center gap-2.5">
          {/* Logo slot: swaps to the sidebar toggle button on hover of Logo or eTinda POS */}
          <div className="relative h-9 w-9 shrink-0">
            <Link
              href="/dashboard"
              aria-label="eTinda POS Dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-transform duration-150 group-hover/brand:scale-90 group-hover/brand:opacity-0"
            >
              <Store className="h-5 w-5" />
            </Link>

            <button
              type="button"
              onClick={toggleSidebar}
              data-testid="sidebar-hover-toggle-btn"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="pointer-events-none absolute inset-0 flex h-9 w-9 scale-90 items-center justify-center rounded-xl bg-primary text-primary-foreground opacity-0 shadow-md ring-2 ring-primary/25 transition-all duration-150 group-hover/brand:pointer-events-auto group-hover/brand:scale-100 group-hover/brand:opacity-100 cursor-pointer"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>
          </div>

          {!isCollapsed ? (
            <Link href="/dashboard" className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-foreground">
                eTinda POS
              </p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {storeName}
              </p>
            </Link>
          ) : null}

          {/* Pop-up tooltip badge on hover */}
          <div
            role="tooltip"
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 scale-95 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-150 group-hover/brand:scale-100 group-hover/brand:opacity-100"
          >
            {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.id}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center px-2"
              )}
            >
              <div className="relative shrink-0">
                <NavIcon name={item.iconName} className="h-5 w-5" />
                {item.id === "pos" && cartItemCount > 0 ? (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      isActive
                        ? "bg-white text-primary"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {cartItemCount}
                  </span>
                ) : null}
              </div>

              {!isCollapsed ? (
                <span className="truncate">{item.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Active Operator & Session Footer */}
      <div className="shrink-0 border-t border-border p-2.5">
        {!isCollapsed ? (
          <div className="rounded-xl border border-border bg-muted/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {userName || "Store Operator"}
                </p>
                {username ? (
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    @{username}
                  </p>
                ) : null}
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  {role === "ADMIN" ? (
                    <Shield className="h-3 w-3 text-primary" />
                  ) : (
                    <UserCheck className="h-3 w-3 text-info" />
                  )}
                  <span className="font-semibold text-primary">
                    {getRoleDisplayLabel(role)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                data-testid="sidebar-logout-icon-btn"
                title="Sign Out"
                aria-label="Sign Out"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              data-testid="sidebar-logout-btn"
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log Out User
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div
              title={`Signed in as ${getRoleDisplayLabel(role)}`}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-border bg-muted/50 text-xs font-bold text-primary"
            >
              {role === "ADMIN" ? "OWN" : "HLP"}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Log Out User"
              aria-label="Log Out User"
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

