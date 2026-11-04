"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_DEVICE_ID,
  DEFAULT_OWNER_ID,
  DEFAULT_STORE_ID,
} from "@/lib/db/seed-local";
import type { UserRole } from "@/types/domain";

export interface SessionState {
  isAuthenticated: boolean;
  storeId: string;
  storeName: string;
  userId: string;
  userName: string;
  email: string;
  username: string;
  role: UserRole;
  deviceId: string;
  deviceName: string;
  isDeviceAuthorized: boolean;
  loginAsUser: (params: {
    userId: string;
    userName: string;
    email?: string;
    username: string;
    role: UserRole;
    storeId?: string;
    storeName?: string;
  }) => void;
  setDeviceAuthorization: (authorized: boolean) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      storeId: DEFAULT_STORE_ID,
      storeName: "My Sari-Sari Store",
      userId: DEFAULT_OWNER_ID,
      userName: "",
      email: "",
      username: "",
      role: "ADMIN",
      deviceId: DEFAULT_DEVICE_ID,
      deviceName: "Primary Store Terminal",
      isDeviceAuthorized: true,

      loginAsUser: (params) =>
        set((state) => ({
          isAuthenticated: true,
          userId: params.userId,
          userName: params.userName,
          email: params.email ?? `${params.username}@etinda.ph`,
          username: params.username,
          role: params.role,
          storeId: params.storeId ?? state.storeId,
          storeName: params.storeName ?? state.storeName,
        })),

      setDeviceAuthorization: (authorized) =>
        set({ isDeviceAuthorized: authorized }),

      logout: () =>
        set({
          isAuthenticated: false,
          userName: "",
          email: "",
          username: "",
        }),
    }),
    {
      name: "etinda-session-v3",
    }
  )
);

