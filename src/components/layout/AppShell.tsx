"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { FloatingMiniPos } from "@/components/floating-pos/FloatingMiniPos";
import { LoadingState } from "@/components/shared/StateViews";
import { ensureLocalDatabaseInitialized } from "@/lib/db/seed-local";
import { useSessionStore } from "@/stores/useSessionStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  React.useEffect(() => {
    void ensureLocalDatabaseInitialized().catch((err) => {
      console.error("Failed to initialize IndexedDB:", err);
    });
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      <React.Suspense
        fallback={
          <aside className="hidden md:sticky md:top-0 md:z-40 md:flex md:h-dvh md:w-[244px] md:shrink-0 md:flex-col md:border-r md:border-border md:bg-card" />
        }
      >
        <DesktopSidebar />
      </React.Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        <React.Suspense
          fallback={
            <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-3.5 md:h-16 md:px-6" />
          }
        >
          <PageHeader />
        </React.Suspense>

        <main className="mx-auto w-full max-w-7xl flex-1 p-3.5 pb-20 sm:p-4 md:p-6 md:pb-6">
          <React.Suspense
            fallback={
              <LoadingState label="Loading screen from local cache..." />
            }
          >
            {children}
          </React.Suspense>
        </main>
      </div>

      <React.Suspense fallback={null}>
        <FloatingMiniPos />
      </React.Suspense>
      <React.Suspense fallback={null}>
        <MobileNavigation />
      </React.Suspense>
    </div>
  );
}
