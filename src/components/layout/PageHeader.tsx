"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Maximize,
  Menu,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  ShoppingBasket,
  UserCheck,
} from "lucide-react";
import { SyncStatusIndicator } from "@/components/shared/SyncStatusIndicator";
import { APP_NAVIGATION_ITEMS } from "@/config/navigation";
import { getRoleDisplayLabel } from "@/lib/permissions";
import { useSessionStore } from "@/stores/useSessionStore";
import { useUIStore } from "@/stores/useUIStore";

export function PageHeader() {
  const pathname = usePathname();
  const role = useSessionStore((s) => s.role);
  const storeName = useSessionStore((s) => s.storeName);

  const isMiniPosHiddenByUser = useUIStore((s) => s.isMiniPosHiddenByUser);
  const setMiniPosExpanded = useUIStore((s) => s.setMiniPosExpanded);
  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setMoreNavOpen = useUIStore((s) => s.setMoreNavOpen);

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [statusNotice, setStatusNotice] = React.useState<string | null>(null);
  const isKioskActiveRef = React.useRef(false);

  const exitKioskMode = React.useCallback(() => {
    isKioskActiveRef.current = false;
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("etinda-kiosk-fullscreen");
      document.body.classList.remove("etinda-kiosk-fullscreen");
    }
    setIsFullscreen(false);
    setStatusNotice(null);
  }, []);

  const enterKioskMode = React.useCallback((customNotice?: string) => {
    isKioskActiveRef.current = true;
    setIsFullscreen(true);
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("etinda-kiosk-fullscreen");
      document.body.classList.add("etinda-kiosk-fullscreen");
    }

    const isAppleMobile =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const notice =
      customNotice ??
      (isAppleMobile
        ? "Kiosk full screen active. Tip: Tap Share ⎋ → 'Add to Home Screen' for borderless app."
        : "Kiosk full screen active. Press ESC or click button to exit.");

    setStatusNotice(notice);
  }, []);

  // Sync isKioskActiveRef and clean up kiosk class on unmount
  React.useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("etinda-kiosk-fullscreen");
        document.body.classList.remove("etinda-kiosk-fullscreen");
      }
    };
  }, []);

  // Listen to native fullscreen changes (via Escape or browser controls)
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      const isNative = Boolean(
        doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
      );

      if (isNative) {
        setIsFullscreen(true);
      } else if (!isKioskActiveRef.current) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, []);

  // Exit kiosk mode on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isKioskActiveRef.current) {
        exitKioskMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exitKioskMode]);

  // Auto-dismiss notice banner
  React.useEffect(() => {
    if (!statusNotice) return;
    const timer = setTimeout(() => {
      setStatusNotice(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [statusNotice]);

  const toggleFullscreen = async () => {
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };

      const isNativeActive = Boolean(
        doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
      );

      // 1. If currently in fullscreen (either native or kiosk mode), exit
      if (isNativeActive || isKioskActiveRef.current || isFullscreen) {
        if (isNativeActive) {
          if (doc.exitFullscreen) {
            await doc.exitFullscreen();
          } else if (doc.webkitExitFullscreen) {
            await doc.webkitExitFullscreen();
          } else if (doc.mozCancelFullScreen) {
            await doc.mozCancelFullScreen();
          } else if (doc.msExitFullscreen) {
            await doc.msExitFullscreen();
          }
        }
        exitKioskMode();
        return;
      }

      // 2. Otherwise, attempt native fullscreen
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      const hasNativeApi = Boolean(
        docEl.requestFullscreen ||
          docEl.webkitRequestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.msRequestFullscreen
      );

      if (hasNativeApi) {
        try {
          const reqPromise = docEl.requestFullscreen
            ? docEl.requestFullscreen()
            : docEl.webkitRequestFullscreen
            ? docEl.webkitRequestFullscreen()
            : docEl.mozRequestFullScreen
            ? docEl.mozRequestFullScreen()
            : docEl.msRequestFullscreen?.();

          if (reqPromise && typeof reqPromise.then === "function") {
            await reqPromise;
            setIsFullscreen(true);
            setStatusNotice(null);
            return;
          }
        } catch (err) {
          console.warn(
            "Native fullscreen request rejected; falling back to in-app kiosk mode:",
            err
          );
        }
      }

      // 3. Fallback: activate In-App Kiosk Fullscreen
      enterKioskMode();
    } catch (err) {
      console.warn("Fullscreen toggle fallback encountered error:", err);
      enterKioskMode();
    }
  };

  const currentNav = APP_NAVIGATION_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const pageTitle = currentNav?.label ?? "eTinda Store Operations";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3.5 md:h-16 md:px-6">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Mobile: open navigation drawer */}
        <button
          type="button"
          onClick={() => setMoreNavOpen(true)}
          data-testid="header-mobile-sidebar-toggle-btn"
          title="Open Menu"
          aria-label="Open Menu"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted cursor-pointer transition-colors md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Tablet / Desktop: collapse or expand sidebar */}
        <button
          type="button"
          onClick={toggleSidebar}
          data-testid="header-sidebar-toggle-btn"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted cursor-pointer transition-colors"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

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

        {/* Active Role Badge */}
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

        {/* Open Full Screen Button (replaces Log Out) */}
        <button
          type="button"
          onClick={toggleFullscreen}
          data-testid="header-fullscreen-btn"
          title={isFullscreen ? "Exit Full Screen" : "Open Full Screen"}
          aria-label={isFullscreen ? "Exit Full Screen" : "Open Full Screen"}
          className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition-colors sm:min-w-0"
        >
          {isFullscreen ? (
            <Minimize className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <Maximize className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? "Exit Full Screen" : "Open Full Screen"}
          </span>
        </button>
      </div>

      {/* Fullscreen Feedback Notice Banner */}
      {statusNotice && (
        <div
          role="status"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex max-w-[92vw] items-center gap-2 rounded-full border border-primary/30 bg-card/95 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm sm:max-w-md"
        >
          <Maximize className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            aria-label="Dismiss message"
            className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
}
