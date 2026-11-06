"use client";

import * as React from "react";
import {
  CheckCircle2,
  Copy,
  CopyCheck,
  Laptop,
  Loader2,
  QrCode,
  Smartphone,
  Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/shared/StateViews";
import { QrCodeSvg } from "@/components/shared/QrCodeSvg";
import {
  checkDevicePairingStatus,
  requestDevicePairingCode,
  type PairingCodeInfo,
} from "@/features/devices/deviceService";

export function PairNewDeviceModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [step, setStep] = React.useState<"FORM" | "CODE" | "SUCCESS">("FORM");
  const [deviceName, setDeviceName] = React.useState("Helper Phone");
  const [deviceType, setDeviceType] = React.useState<
    "MOBILE" | "TABLET" | "DESKTOP"
  >("MOBILE");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [pairingInfo, setPairingInfo] = React.useState<PairingCodeInfo | null>(
    null
  );
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [secondsRemaining, setSecondsRemaining] = React.useState(900); // 15 mins

  const handleClose = () => {
    setStep("FORM");
    setError(null);
    setPairingInfo(null);
    setCopiedCode(false);
    setCopiedLink(false);
    onClose();
  };

  // Expiration countdown
  React.useEffect(() => {
    if (step !== "CODE" || !pairingInfo) return;
    const expiresMs = new Date(pairingInfo.expiresAt).getTime();

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setSecondsRemaining(diff);
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, pairingInfo]);

  // Live polling: auto-detects when the new device claims the code
  React.useEffect(() => {
    if (step !== "CODE" || !pairingInfo) return;

    const interval = setInterval(async () => {
      try {
        const status = await checkDevicePairingStatus(pairingInfo.code);
        if (status.isClaimed) {
          setStep("SUCCESS");
          onSuccess?.();
        }
      } catch {
        // Ignore polling network glitches
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [step, pairingInfo, onSuccess]);

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      setError("Please specify a descriptive device name.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const info = await requestDevicePairingCode({
        deviceName: deviceName.trim(),
        deviceType,
      });
      setPairingInfo(info);
      setSecondsRemaining(900);
      setStep("CODE");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate pairing code."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const pairingUrl = React.useMemo(() => {
    if (typeof window === "undefined" || !pairingInfo) return "";
    const url = new URL("/login", window.location.origin);
    url.searchParams.set("pairCode", pairingInfo.code);
    return url.toString();
  }, [pairingInfo]);

  const handleCopyCode = async () => {
    if (!pairingInfo) return;
    try {
      await navigator.clipboard.writeText(pairingInfo.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    if (!pairingUrl) return;
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={handleClose}
      title={
        step === "SUCCESS"
          ? "Terminal Paired Successfully!"
          : step === "CODE"
            ? "Connect Secondary Device"
            : "Pair a New Store Terminal"
      }
      description={
        step === "SUCCESS"
          ? "The secondary device is now connected to your store and authorized to operate."
          : step === "CODE"
            ? "Enter this 6-digit code or scan the QR code on the secondary device to connect it to this store."
            : "Generate a secure, single-use 6-digit pairing code to connect another phone, tablet, or PC."
      }
      maxWidthClass="md:max-w-md"
    >
      {step === "FORM" ? (
        <form onSubmit={(e) => void handleGenerateCode(e)} className="space-y-4 pt-2">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="pairing-device-name"
              className="mb-1.5 block text-xs font-semibold text-foreground"
            >
              Device Label / Terminal Name
            </label>
            <Input
              id="pairing-device-name"
              data-testid="pairing-device-name-input"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Counter Tablet 2, Jomar's Phone"
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              A recognizable name to distinguish sales and inventory movements made from this terminal.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Device Form Factor
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDeviceType("MOBILE")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center text-xs transition-colors cursor-pointer ${
                  deviceType === "MOBILE"
                    ? "border-primary bg-primary-muted text-primary-muted-foreground font-bold"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <Smartphone className="h-5 w-5" />
                <span>Mobile</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceType("TABLET")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center text-xs transition-colors cursor-pointer ${
                  deviceType === "TABLET"
                    ? "border-primary bg-primary-muted text-primary-muted-foreground font-bold"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <Tablet className="h-5 w-5" />
                <span>Tablet</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceType("DESKTOP")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center text-xs transition-colors cursor-pointer ${
                  deviceType === "DESKTOP"
                    ? "border-primary bg-primary-muted text-primary-muted-foreground font-bold"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <Laptop className="h-5 w-5" />
                <span>Desktop / PC</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="generate-pairing-code-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Generating Code...
                </>
              ) : (
                "Generate 6-Digit Code →"
              )}
            </Button>
          </div>
        </form>
      ) : step === "CODE" && pairingInfo ? (
        <div className="space-y-4 pt-1 text-center">
          {/* Large formatted 6-digit Code banner */}
          <div className="rounded-2xl border-2 border-primary/40 bg-primary-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              6-Digit Pairing Code
            </p>
            <div className="my-2 flex items-center justify-center gap-2">
              <span className="font-mono text-3xl font-extrabold tracking-widest text-primary sm:text-4xl">
                {pairingInfo.formattedCode}
              </span>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                title="Copy Code"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                {copiedCode ? (
                  <CopyCheck className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires in{" "}
              <span className="font-semibold text-foreground">
                {formatTimer(secondsRemaining)}
              </span>{" "}
              • Single-use authorization
            </p>
          </div>

          {/* QR Code and Direct Link Option */}
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <QrCode className="h-4 w-4 text-primary" />
              <span>Or scan with phone camera to connect:</span>
            </div>
            <QrCodeSvg value={pairingUrl} size={160} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopyLink()}
              className="mt-1 w-full text-xs"
            >
              {copiedLink ? (
                <>
                  <CopyCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                  Pairing Link Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy Direct Pairing Link
                </>
              )}
            </Button>
          </div>

          {/* Live waiting indicator */}
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Waiting for &quot;{pairingInfo.deviceName}&quot; to connect...</span>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Done / Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              Device Connected!
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Terminal <strong>&quot;{pairingInfo?.deviceName}&quot;</strong> is now linked to this store with an independent sync identity.
            </p>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              onSuccess?.();
              onClose();
            }}
          >
            Return to Devices List
          </Button>
        </div>
      )}
    </ResponsiveDialog>
  );
}
