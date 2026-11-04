"use client";

import { useEffect, useState } from "react";
import { synchronizePendingOutbox } from "@/features/sync/syncEngine";
import { useUIStore } from "@/stores/useUIStore";

export function useOnlineStatus(): {
  isOnline: boolean;
  isBrowserOnline: boolean;
  isSimulatedOffline: boolean;
} {
  const simulatedOffline = useUIStore((s) => s.simulatedOffline);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateStatus = () => {
      const online = navigator.onLine;
      setIsBrowserOnline(online);
      if (online && !useUIStore.getState().simulatedOffline) {
        void synchronizePendingOutbox();
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        !useUIStore.getState().simulatedOffline
      ) {
        void synchronizePendingOutbox();
      }
    };

    updateStatus();

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Also trigger sync when user turns off simulated offline mode
  useEffect(() => {
    if (!simulatedOffline && isBrowserOnline) {
      void synchronizePendingOutbox();
    }
  }, [simulatedOffline, isBrowserOnline]);

  return {
    isOnline: isBrowserOnline && !simulatedOffline,
    isBrowserOnline,
    isSimulatedOffline: simulatedOffline,
  };
}

