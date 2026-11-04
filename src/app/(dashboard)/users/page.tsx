"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CheckCircle2,
  Lock,
  Mail,
  Shield,
  Sparkles,
  Store,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createStoreUserAccount,
  toggleStoreUserActiveStatus,
} from "@/features/users/userService";
import { db } from "@/lib/db/dexie";
import { getRoleDisplayLabel, hasPermission } from "@/lib/permissions";
import { useSessionStore } from "@/stores/useSessionStore";
import type { UserRole } from "@/types/domain";

export default function OwnerUserCreationPage() {
  const router = useRouter();
  const role = useSessionStore((s) => s.role);
  const activeUserId = useSessionStore((s) => s.userId);
  const storeName = useSessionStore((s) => s.storeName);

  const canManageUsers = hasPermission(role, "MANAGE_USERS_AND_DEVICES");

  const stores = useLiveQuery(async () => db.stores.toArray(), []) ?? [];
  const users = useLiveQuery(async () => db.users.toArray(), []) ?? [];
  const mainStore = stores[0];

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [selectedRole, setSelectedRole] = React.useState<UserRole>("HELPER");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!canManageUsers) {
    return (
      <Card
        data-testid="users-permission-denied"
        className="border-red-300 bg-destructive-muted/40"
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Lock className="h-8 w-8 text-destructive" />
          <h2 className="mt-3 text-lg font-bold text-foreground">
            Owner Permission Required
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Creating and managing Store Helper (HELPER) or Co-Owner (ADMIN)
            accounts is restricted to the Store Owner (ADMIN).
          </p>
          <Link
            href="/pos"
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Return to Point of Sale
          </Link>
        </CardContent>
      </Card>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (confirmPassword && password !== confirmPassword) {
      setFormError("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createStoreUserAccount({
        name: fullName.trim() || username.trim(),
        email,
        username,
        role: selectedRole,
        pinOrPassword: password,
      });

      setFullName("");
      setEmail("");
      setUsername("");
      setSelectedRole("HELPER");
      setPassword("");
      setConfirmPassword("");
      setFormSuccess(
        `Created ${getRoleDisplayLabel(created.role)} account "${created.name}" (@${created.username} • ${created.email}).`
      );
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Unable to create user account. Check your fields and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (
    targetUserId: string,
    currentlyActive: boolean
  ) => {
    setFormError(null);
    setFormSuccess(null);
    try {
      const updated = await toggleStoreUserActiveStatus(
        targetUserId,
        !currentlyActive
      );
      setFormSuccess(
        `${updated.isActive ? "Activated" : "Deactivated"} account @${updated.username}.`
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to update user status."
      );
    }
  };

  const ownerCount = users.filter((u) => u.role === "ADMIN").length;
  const helperCount = users.filter((u) => u.role === "HELPER").length;

  return (
    <div className="space-y-5">
      {/* Top Summary Banner */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-primary" />
              {mainStore?.name ?? storeName} — Tindahan User & Helper Creation
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              As the Store Owner (ADMIN), create accounts for your Store Helpers
              (cashiers/tindera) or Co-Owners using an Email, Username, and
              Password.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">
              <Shield className="mr-1 h-3 w-3" /> {ownerCount} Owner(s)
            </Badge>
            <Badge variant="info">
              <UserCheck className="mr-1 h-3 w-3" /> {helperCount} Helper(s)
            </Badge>
            <Button
              size="sm"
              variant="outline"
              data-testid="goto-create-owner-page-btn"
              onClick={() => router.push("/register")}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Create Owner Account Page
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Owner User Creation Form */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary" />
              Create Helper or Store User Account
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Register a new operator for the tindahan web app. Passwords are
              hashed with Node <code className="font-mono">scrypt</code> and
              never stored raw in IndexedDB.
            </p>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={(e) => void handleCreateUser(e)}
              className="space-y-4"
            >
              <Input
                label="Full Name (Optional — defaults to username)"
                placeholder="e.g., Ate Lorna Cruz (Store Helper)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="owner-create-user-name-input"
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="e.g., lorna.helper@etinda.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                data-testid="owner-create-user-email-input"
                required
              />

              <Input
                label="Username"
                placeholder="e.g., lorna_helper"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "")
                  )
                }
                data-testid="owner-create-user-username-input"
                required
              />

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Assigned Store Role
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="owner-select-role-helper"
                    onClick={() => setSelectedRole("HELPER")}
                    className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      selectedRole === "HELPER"
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-info" />
                      <p className="text-xs font-bold text-foreground">
                        Store Helper (HELPER)
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      POS sales, stock-in receiving, and utang payment
                      collection. Restricted from financial margins & user
                      management.
                    </p>
                  </button>

                  <button
                    type="button"
                    data-testid="owner-select-role-admin"
                    onClick={() => setSelectedRole("ADMIN")}
                    className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      selectedRole === "ADMIN"
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-primary" />
                      <p className="text-xs font-bold text-foreground">
                        Store Owner (ADMIN)
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Full administrative access to product pricing, financial
                      reports, users, and devices.
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min. 4 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="owner-create-user-password-input"
                  required
                />
                <Input
                  label="Confirm Password (Optional)"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="owner-create-user-confirm-password-input"
                />
              </div>

              {formError ? (
                <div
                  role="alert"
                  data-testid="owner-create-user-error"
                  className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive"
                >
                  {formError}
                </div>
              ) : null}

              {formSuccess ? (
                <div
                  role="status"
                  data-testid="owner-create-user-success"
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                data-testid="owner-create-user-submit-btn"
                className="w-full"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                {isSubmitting
                  ? "Creating Store Account..."
                  : `Create ${
                      selectedRole === "HELPER"
                        ? "Store Helper"
                        : "Store Owner"
                    } Account`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right Column: Registered Store Users & Helpers Directory */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Registered Store Team Accounts ({users.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              All Owner and Helper accounts registered for this tindahan.
              Operators can sign in at <code className="font-mono">/login</code>{" "}
              using their Email or Username and Password.
            </p>
          </CardHeader>

          <CardContent className="divide-y divide-border">
            {users.map((u) => {
              const isCurrent = u.id === activeUserId;
              const userEmail = u.email || `${u.username}@etinda.ph`;
              return (
                <div
                  key={u.id}
                  data-testid={`team-user-row-${u.username}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {u.name}
                      </span>
                      <Badge variant={u.role === "ADMIN" ? "default" : "info"}>
                        <Shield className="mr-1 h-3 w-3" />
                        {getRoleDisplayLabel(u.role)} ({u.role})
                      </Badge>
                      {u.isActive ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Deactivated</Badge>
                      )}
                      {isCurrent ? (
                        <Badge variant="default">Current Operator</Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                      <span>
                        Username:{" "}
                        <strong className="font-mono text-foreground">
                          @{u.username}
                        </strong>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <strong className="font-mono text-foreground">
                          {userEmail}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isCurrent ? (
                      <Button
                        size="sm"
                        variant={u.isActive ? "outline" : "default"}
                        data-testid={`team-toggle-active-${u.username}`}
                        onClick={() =>
                          void handleToggleUserStatus(u.id, u.isActive)
                        }
                      >
                        {u.isActive ? (
                          <>
                            <UserX className="mr-1 h-3.5 w-3.5" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-1 h-3.5 w-3.5" />
                            Activate
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

