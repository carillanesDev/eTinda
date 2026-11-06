"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Shield,
  Store,
  UserCheck,
  UserPlus,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ClaimDevicePairingModal } from "@/components/devices/ClaimDevicePairingModal";
import { authenticateStoreOperator } from "@/features/users/userService";
import { db } from "@/lib/db/dexie";
import { ensureLocalDatabaseInitialized } from "@/lib/db/seed-local";
import { useSessionStore } from "@/stores/useSessionStore";
import type { UserEntity } from "@/types/domain";

export default function LoginPage() {
  const router = useRouter();
  const deviceName = useSessionStore((s) => s.deviceName);

  React.useEffect(() => {
    void ensureLocalDatabaseInitialized();
  }, []);

  const stores = useLiveQuery(async () => db.stores.toArray(), []) ?? [];
  const activeUsers =
    useLiveQuery(
      async () => db.users.filter((u) => u.isActive).toArray(),
      []
    ) ?? [];

  const mainStore = stores[0];

  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [identifierInput, setIdentifierInput] = React.useState("");
  const [pinCode, setPinCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [initialPairCode] = React.useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("pairCode") || params.get("code") || "";
    }
    return "";
  });
  const [isClaimModalOpen, setIsClaimModalOpen] = React.useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get("pairCode") || params.get("code"));
    }
    return false;
  });

  const matchedUserByIdentifier = identifierInput.trim()
    ? activeUsers.find(
        (u) =>
          u.username.toLowerCase() === identifierInput.trim().toLowerCase() ||
          (u.email ?? "").toLowerCase() === identifierInput.trim().toLowerCase()
      )
    : undefined;

  const selectedUser: UserEntity | undefined =
    matchedUserByIdentifier ??
    activeUsers.find((u) => u.id === selectedUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const effectiveIdentifier =
      identifierInput.trim() ||
      selectedUser?.username ||
      selectedUser?.email ||
      "";

    if (!effectiveIdentifier) {
      setError("Please enter your Email or Username to sign in.");
      return;
    }

    if (pinCode.trim().length < 4) {
      setError("Please enter your password (minimum 4 characters).");
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await authenticateStoreOperator({
        identifier: effectiveIdentifier,
        pinOrPassword: pinCode,
      });
      router.push(user.role === "ADMIN" ? "/dashboard" : "/pos");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Check your credentials and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Store className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold">
            eTinda Store Sign In
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {mainStore?.name || "Sari-Sari Store POS"} • Offline-First Terminal
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {activeUsers.length === 0 ? (
            <div className="rounded-xl border border-primary/30 bg-primary-muted/40 p-3.5 text-center">
              <p className="text-xs font-bold text-foreground">
                New Store Setup — No Accounts Registered Yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create the primary Store Owner (ADMIN) account first using your
                Email, Username, and Password, or sign in below if your store is
                already registered on the cloud server.
              </p>
              <Button
                type="button"
                size="sm"
                data-testid="goto-register-owner-banner-btn"
                onClick={() => router.push("/register")}
                className="mt-2.5 w-full"
              >
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Create Store Owner Account →
              </Button>

              <div className="relative my-2.5 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <span className="relative bg-primary-muted px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Or
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="open-pair-device-banner-btn"
                onClick={() => setIsClaimModalOpen(true)}
                className="w-full bg-card"
              >
                <Smartphone className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Already have a store? Pair with 6-Digit Code →
              </Button>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Registered Store Accounts ({activeUsers.length})
              </label>
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {activeUsers.map((user) => {
                  const isSelected = selectedUser?.id === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setIdentifierInput(user.username);
                        setError("");
                      }}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary-muted text-primary-muted-foreground ring-2 ring-primary"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {user.role === "ADMIN" ? (
                        <Shield className="h-5 w-5 text-primary" />
                      ) : (
                        <UserCheck className="h-5 w-5 text-info" />
                      )}
                      <span className="line-clamp-1 text-sm font-bold">
                        {user.name}
                      </span>
                      <span className="text-[11px] opacity-80">
                        @{user.username} (
                        {user.role === "ADMIN" ? "Owner" : "Helper"})
                      </span>
                      <span className="line-clamp-1 text-[10px] opacity-70">
                        {user.email ?? `${user.username}@etinda.ph`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label
                htmlFor="operator-identifier"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Email or Username
              </label>
              <Input
                id="operator-identifier"
                data-testid="login-identifier-input"
                type="text"
                value={identifierInput}
                onChange={(e) => {
                  setIdentifierInput(e.target.value);
                  setError("");
                }}
                placeholder={
                  selectedUser
                    ? `${selectedUser.email || selectedUser.username}`
                    : "Enter email or username"
                }
                required={!selectedUser}
              />
            </div>

            <div>
              <label
                htmlFor="operator-pin"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Password
              </label>
              <Input
                id="operator-pin"
                data-testid="login-password-input"
                type="password"
                value={pinCode}
                onChange={(e) => {
                  setPinCode(e.target.value);
                  setError("");
                }}
                placeholder="Enter account password"
                error={error}
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-primary" />
                Registered Terminal:
              </span>
              <span className="font-semibold text-foreground">{deviceName}</span>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              data-testid="login-submit-btn"
              className="w-full"
            >
              {isSubmitting
                ? "Verifying Credentials..."
                : selectedUser
                  ? `Sign In as ${selectedUser.name} →`
                  : "Sign In to Store →"}
            </Button>
          </form>

          <div className="space-y-2 border-t border-border pt-3 text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="open-pair-device-footer-btn"
              onClick={() => setIsClaimModalOpen(true)}
              className="w-full"
            >
              <Smartphone className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Pair This Device to an Existing Store (6-Digit Code)
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="goto-register-owner-link"
              onClick={() => router.push("/register")}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Setup Brand New Store / Register Owner
            </Button>
          </div>
        </CardContent>
      </Card>

      <ClaimDevicePairingModal
        open={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        initialCode={initialPairCode}
      />
    </div>
  );
}
