"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UIState {
  isSidebarCollapsed: boolean;
  isSyncSheetOpen: boolean;
  isMoreNavOpen: boolean;
  isMobileCartOpen: boolean;

  // Floating Mini-POS state (AGENTS.md §14 & DESIGNS.md §11)
  isMiniPosExpanded: boolean;
  isMiniPosHiddenByUser: boolean;
  miniPosCorner: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  miniPosOffset: { x: number; y: number };

  // Network / Sync testing controls
  simulatedOffline: boolean;
  simulateServerSyncFailure: boolean;
  isSyncingNow: boolean;
  lastSyncError: string | null;

  toggleSidebar: () => void;
  setSyncSheetOpen: (open: boolean) => void;
  setMoreNavOpen: (open: boolean) => void;
  setMobileCartOpen: (open: boolean) => void;
  setMiniPosExpanded: (expanded: boolean) => void;
  setMiniPosHiddenByUser: (hidden: boolean) => void;
  setMiniPosCorner: (
    corner: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  ) => void;
  setMiniPosOffset: (offset: { x: number; y: number }) => void;
  setSimulatedOffline: (offline: boolean) => void;
  setSimulateServerSyncFailure: (fail: boolean) => void;
  setSyncingState: (isSyncing: boolean, error?: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      isSyncSheetOpen: false,
      isMoreNavOpen: false,
      isMobileCartOpen: false,

      isMiniPosExpanded: false,
      isMiniPosHiddenByUser: false,
      miniPosCorner: "bottom-right",
      miniPosOffset: { x: 0, y: 0 },

      simulatedOffline: false,
      simulateServerSyncFailure: false,
      isSyncingNow: false,
      lastSyncError: null,

      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSyncSheetOpen: (isSyncSheetOpen) => set({ isSyncSheetOpen }),
      setMoreNavOpen: (isMoreNavOpen) => set({ isMoreNavOpen }),
      setMobileCartOpen: (isMobileCartOpen) => set({ isMobileCartOpen }),
      setMiniPosExpanded: (isMiniPosExpanded) =>
        set({ isMiniPosExpanded, isMiniPosHiddenByUser: false }),
      setMiniPosHiddenByUser: (isMiniPosHiddenByUser) =>
        set({ isMiniPosHiddenByUser, isMiniPosExpanded: false }),
      setMiniPosCorner: (miniPosCorner) => set({ miniPosCorner }),
      setMiniPosOffset: (miniPosOffset) => set({ miniPosOffset }),
      setSimulatedOffline: (simulatedOffline) => set({ simulatedOffline }),
      setSimulateServerSyncFailure: (simulateServerSyncFailure) =>
        set({ simulateServerSyncFailure }),
      setSyncingState: (isSyncingNow, lastSyncError = null) =>
        set({ isSyncingNow, lastSyncError }),
    }),
    {
      name: "etinda-ui-preferences-v1",
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        miniPosCorner: state.miniPosCorner,
        simulatedOffline: state.simulatedOffline,
      }),
    }
  )
);

