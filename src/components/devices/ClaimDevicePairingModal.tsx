"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/shared/StateViews";
import { claimDevicePairingCode } from "@/features/devices/deviceService";

export function ClaimDevicePairingModal({
  open,
  onClose,
  initialCode = "",
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  initialCode?: string;
  onSuccess?: () => void;
}) {
  const [code, setCode] = React.useState(initialCode);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{
    storeName: string;
    deviceName: string;
  } | null>(null);

  const handleClose = () => {
    setError(null);
    setSuccessInfo(null);
    onClose();
  };

  const handleFormatCode = (input: string) => {
    const raw = input.replace(/[^0-9]/g, "").slice(0, 6);
    if (raw.length > 3) {
      return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    }
    return raw;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(handleFormatCode(e.target.value));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/[^0-9]/g, "");
    if (clean.length < 5) {
      setError("Please enter the complete 6-digit pairing code.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await claimDevicePairingCode(clean);
      setSuccessInfo({
        storeName: result.store.name,
        deviceName: result.device.deviceName,
      });
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect to store."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={handleClose}
      title={
        successInfo ? "Connected to Store!" : "Connect to Existing Store"
      }
      description={
        successInfo
          ? `This terminal is now paired to ${successInfo.storeName}.`
          : "Enter the 6-digit code shown on your main device's Settings page."
      }
      maxWidthClass="md:max-w-md"
    >
      {successInfo ? (
        <div className="space-y-4 pt-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h4 className="text-base font-bold text-foreground">
              {successInfo.storeName}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Registered as <strong>&quot;{successInfo.deviceName}&quot;</strong>. Store products and accounts have been synchronized to this device.
            </p>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              handleClose();
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          >
            Open Store Sign In →
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pt-2">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive"
            >
              {error}
            </div>
          )}

          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Smartphone className="h-4 w-4 text-primary" />
              How to find your 6-digit code:
            </p>
            <p className="mt-1">
              On your main store device, go to <strong>Settings & Devices</strong> → click <strong>Pair New Terminal</strong>.
            </p>
          </div>

          <div>
            <label
              htmlFor="pairing-code-input"
              className="mb-1.5 block text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              6-Digit Pairing Code
            </label>
            <Input
              id="pairing-code-input"
              data-testid="claim-pairing-code-input"
              type="text"
              inputMode="numeric"
              maxLength={7} // "XXX-XXX"
              value={code}
              onChange={handleInputChange}
              placeholder="e.g. 582-914"
              className="text-center font-mono text-2xl font-bold tracking-widest sm:text-3xl"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="submit-claim-pairing-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Connecting to Store...
                </>
              ) : (
                "Connect & Sync Store →"
              )}
            </Button>
          </div>
        </form>
      )}
    </ResponsiveDialog>
  );
}
