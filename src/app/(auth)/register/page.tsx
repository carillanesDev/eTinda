"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Shield, Store, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { registerOwnerAccount } from "@/features/users/userService";
import { ensureLocalDatabaseInitialized } from "@/lib/db/seed-local";

export default function RegisterOwnerAccountPage() {
  const router = useRouter();

  React.useEffect(() => {
    void ensureLocalDatabaseInitialized();
  }, []);

  const [storeName, setStoreName] = React.useState("");
  const [storeAddress, setStoreAddress] = React.useState("");
  const [contactNumber, setContactNumber] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [pinOrPassword, setPinOrPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (confirmPassword && pinOrPassword !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { owner, store } = await registerOwnerAccount({
        storeName: storeName.trim() || "My Sari-Sari Store",
        storeAddress: storeAddress.trim() || "Philippines",
        contactNumber: contactNumber.trim() || "09170000000",
        ownerName: ownerName.trim() || username.trim() || "Store Owner",
        email,
        username,
        pinOrPassword,
      });
      setSuccessMessage(
        `Created Store Owner account @${owner.username} (${owner.email}) for ${store.name}! Redirecting...`
      );
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create Owner account. Check your fields and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-muted px-2.5 py-0.5 text-[11px] font-bold text-primary">
              <Shield className="h-3 w-3" /> Create Owner (ADMIN) Account
            </span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">
                Create Store Owner Account
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Sign up with your Email, Username, and Password to manage your
                tindahan and create Helper accounts
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Owner Sign-Up Credentials (Email, Username & Password)
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Email Address"
                  type="email"
                  data-testid="register-owner-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  placeholder="e.g. rosa@etinda.ph"
                  required
                />
                <Input
                  label="Username"
                  data-testid="register-owner-username-input"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9._-]/g, "")
                    )
                  }
                  placeholder="e.g. rosa.owner"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Password"
                  data-testid="register-owner-pin-input"
                  type="password"
                  value={pinOrPassword}
                  onChange={(e) => setPinOrPassword(e.target.value)}
                  placeholder="Min. 4 characters"
                  required
                />
                <Input
                  label="Confirm Password (Optional)"
                  data-testid="register-owner-confirm-password-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              <Input
                label="Owner Full Name (Optional — defaults to username)"
                data-testid="register-owner-name-input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Rosa Mendoza"
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Sari-Sari Store (Tindahan) Profile
              </p>

              <Input
                label="Store Name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Nanay Rosa's Sari-Sari Store"
                required
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Barangay / Address"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Brgy. San Isidro, QC"
                  required
                />
                <Input
                  label="Store Mobile Number"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="09171234567"
                  required
                />
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                data-testid="register-owner-error"
                className="rounded-lg border border-destructive/30 bg-destructive-muted px-3 py-2 text-xs font-semibold text-destructive"
              >
                {error}
              </p>
            ) : null}

            {successMessage ? (
              <p
                role="status"
                data-testid="register-owner-success"
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {successMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              data-testid="register-owner-submit-btn"
              className="w-full"
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting
                ? "Creating Owner Account..."
                : "Create Owner Account & Enter Store →"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


