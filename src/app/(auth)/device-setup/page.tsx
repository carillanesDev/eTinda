"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw, ShieldAlert, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClaimDevicePairingModal } from "@/components/devices/ClaimDevicePairingModal";
import { ensureLocalDatabaseInitialized } from "@/lib/db/seed-local";
import { useSessionStore } from "@/stores/useSessionStore";

export default function DeviceSetupPage() {
  const router = useRouter();
  const deviceId = useSessionStore((s) => s.deviceId);
  const deviceName = useSessionStore((s) => s.deviceName);
  const isDeviceAuthorized = useSessionStore((s) => s.isDeviceAuthorized);
  const setDeviceAuthorization = useSessionStore(
    (s) => s.setDeviceAuthorization
  );

  const [isInitializing, setIsInitializing] = React.useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = React.useState(false);

  const handleRunInitialSync = async () => {
    setIsInitializing(true);
    try {
      await ensureLocalDatabaseInitialized();
      setDeviceAuthorization(true);
      router.push("/pos");
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <Smartphone className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">
            Terminal Registration & Offline Setup
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Each device maintains an independent synchronization cursor and
            persistent local outbox.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Device Name:</span>
              <span className="font-semibold text-foreground">{deviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Device Identity:</span>
              <span className="font-mono text-foreground">{deviceId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Authorization:</span>
              {isDeviceAuthorized ? (
                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Authorized
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                  <ShieldAlert className="h-3.5 w-3.5" /> Revoked
                </span>
              )}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={isInitializing}
            onClick={() => void handleRunInitialSync()}
          >
            <RefreshCw
              className={`h-4 w-4 ${isInitializing ? "animate-spin" : ""}`}
            />
            {isInitializing
              ? "Seeding Local IndexedDB Catalog..."
              : "Authorize Terminal & Open POS"}
          </Button>

          <div className="relative my-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Or Connect to Main Terminal
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setIsPairModalOpen(true)}
          >
            <Smartphone className="mr-1.5 h-4 w-4 text-primary" />
            Pair with Existing Store (6-Digit Code)
          </Button>
        </CardContent>
      </Card>

      <ClaimDevicePairingModal
        open={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
      />
    </div>
  );
}

