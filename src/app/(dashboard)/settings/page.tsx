"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  Lock,
  Shield,
  ShieldAlert,
  Smartphone,
  Store,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/shared/StateViews";
import {
  createStoreUserAccount,
  toggleStoreUserActiveStatus,
} from "@/features/users/userService";
import { db } from "@/lib/db/dexie";
import { DEFAULT_STORE_ID } from "@/lib/db/seed-local";
import { getRoleDisplayLabel, hasPermission } from "@/lib/permissions";
import { generateUuid } from "@/lib/utils/uuid";
import { useSessionStore } from "@/stores/useSessionStore";
import type { UserRole } from "@/types/domain";

export default function SettingsAndDevicesPage() {
  const router = useRouter();
  const role = useSessionStore((s) => s.role);
  const activeUserId = useSessionStore((s) => s.userId);
  const currentDeviceId = useSessionStore((s) => s.deviceId);
  const setDeviceAuthorization = useSessionStore(
    (s) => s.setDeviceAuthorization
  );
  const canManageDevices = hasPermission(role, "MANAGE_USERS_AND_DEVICES");

  const [isAddUserOpen, setIsAddUserOpen] = React.useState(false);
  const [newUserName, setNewUserName] = React.useState("");
  const [newUserEmail, setNewUserEmail] = React.useState("");
  const [newUsername, setNewUsername] = React.useState("");
  const [newUserRole, setNewUserRole] = React.useState<UserRole>("HELPER");
  const [newUserPin, setNewUserPin] = React.useState("");
  const [confirmUserPin, setConfirmUserPin] = React.useState("");
  const [userFormError, setUserFormError] = React.useState<string | null>(null);
  const [userFormSuccess, setUserFormSuccess] = React.useState<string | null>(
    null
  );
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);

  const stores = useLiveQuery(async () => db.stores.toArray(), []) ?? [];
  const users = useLiveQuery(async () => db.users.toArray(), []) ?? [];
  const devices = useLiveQuery(async () => db.devices.toArray(), []) ?? [];
  const auditLogs =
    useLiveQuery(
      async () => db.audit_logs.orderBy("createdAt").reverse().toArray(),
      []
    ) ?? [];

  const mainStore = stores[0];

  const handleToggleDeviceAuthorization = async (
    deviceId: string,
    currentlyAuthorized: boolean
  ) => {
    if (!canManageDevices) return;
    const nextAuth = !currentlyAuthorized;
    const nowIso = new Date().toISOString();

    await db.transaction("rw", [db.devices, db.audit_logs], async () => {
      await db.devices.update(deviceId, {
        isAuthorized: nextAuth,
        revokedAt: nextAuth ? undefined : nowIso,
      });

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: mainStore?.id ?? DEFAULT_STORE_ID,
        deviceId: currentDeviceId,
        userId: useSessionStore.getState().userId,
        userNameSnapshot: useSessionStore.getState().userName,
        userRole: role,
        action: nextAuth ? "DEVICE_AUTHORIZED" : "DEVICE_REVOKED",
        entityType: "DEVICE",
        entityId: deviceId,
        summary: `${
          nextAuth ? "Re-authorized" : "Revoked"
        } device ${deviceId}`,
        createdAt: nowIso,
      });
    });

    if (deviceId === currentDeviceId) {
      setDeviceAuthorization(nextAuth);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);

    if (newUserPin !== confirmUserPin) {
      setUserFormError("PIN / Password confirmation does not match.");
      return;
    }

    setIsCreatingUser(true);
    try {
      const created = await createStoreUserAccount({
        name: newUserName,
        email: newUserEmail,
        username: newUsername,
        role: newUserRole,
        pinOrPassword: newUserPin,
      });

      setNewUserName("");
      setNewUserEmail("");
      setNewUsername("");
      setNewUserRole("HELPER");
      setNewUserPin("");
      setConfirmUserPin("");
      setIsAddUserOpen(false);
      setUserFormSuccess(
        `Created ${getRoleDisplayLabel(created.role)} account "${created.name}" (@${created.username} • ${created.email}).`
      );
    } catch (err) {
      setUserFormError(
        err instanceof Error
          ? err.message
          : "Unable to create user account."
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (
    targetUserId: string,
    currentlyActive: boolean
  ) => {
    setUserFormError(null);
    setUserFormSuccess(null);
    try {
      await toggleStoreUserActiveStatus(targetUserId, !currentlyActive);
    } catch (err) {
      setUserFormError(
        err instanceof Error
          ? err.message
          : "Unable to update user status."
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Store Profile Card */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-primary" />
              Store Profile & Branch Configuration
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage your Sari-Sari Store identity and primary Owner account.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            data-testid="open-owner-register-link"
            onClick={() => router.push("/register")}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Create Owner Account / Store Setup
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Store Name</p>
            <p className="font-semibold text-foreground">
              {mainStore?.name ?? "Aling Nena's Sari-Sari Store"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Location</p>
            <p className="font-semibold text-foreground">
              {mainStore?.address ?? "Brgy. San Isidro, Quezon City"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Store ID (UUID/Ref)</p>
            <p className="font-mono text-xs text-foreground">
              {mainStore?.id ?? "store-etinda-main-001"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Store Operators (Owner & Helper Account Creation & Management) */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Store Users & Roles ({users.length})
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Create Helper (`HELPER`) cashier accounts or Co-Owner (`ADMIN`)
              accounts with role-based permissions.
            </p>
          </div>

          {canManageDevices ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                data-testid="goto-owner-users-page-btn"
                onClick={() => router.push("/users")}
              >
                <Users className="mr-1.5 h-4 w-4" />
                User Creation Page
              </Button>
              <Button
                size="sm"
                data-testid="open-add-user-modal-btn"
                onClick={() => {
                  setUserFormError(null);
                  setIsAddUserOpen(true);
                }}
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                Quick Add Helper / User
              </Button>
            </div>
          ) : (
            <Badge variant="secondary">
              Owner (`ADMIN`) required to add users
            </Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {userFormSuccess ? (
            <div
              role="status"
              data-testid="user-created-banner"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
            >
              {userFormSuccess}
            </div>
          ) : null}

          {userFormError && !isAddUserOpen ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive"
            >
              {userFormError}
            </div>
          ) : null}

          <div className="divide-y divide-border">
            {users.map((u) => {
              const isCurrent = u.id === activeUserId;
              return (
                <div
                  key={u.id}
                  data-testid={`user-row-${u.username}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {u.name}
                      </p>
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
                    <p className="mt-0.5 text-muted-foreground">
                      Username:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        @{u.username}
                      </span>{" "}
                      • Email:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {u.email || `${u.username}@etinda.ph`}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canManageDevices && !isCurrent ? (
                      <Button
                        size="sm"
                        variant={u.isActive ? "outline" : "default"}
                        data-testid={`toggle-user-active-${u.username}`}
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
          </div>
        </CardContent>
      </Card>

      {/* Registered Devices & Revocation Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4 text-primary" />
            Registered Store Terminals & Sync Authorization ({devices.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Per AGENTS.md §11 & §12, each registered device has an independent
            sync identity and can be revoked by the Store Owner.
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {devices.map((dev) => (
            <div
              key={dev.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {dev.deviceName}
                  </span>
                  <Badge variant="secondary">{dev.deviceType}</Badge>
                  {dev.id === currentDeviceId ? (
                    <Badge variant="info">This Terminal</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-muted-foreground font-mono">
                  ID: {dev.id} • Cursor: #{dev.downloadCursor}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {dev.isAuthorized ? (
                  <Badge variant="default">
                    <CheckCircle2 className="h-3 w-3" /> Authorized
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <ShieldAlert className="h-3 w-3" /> Revoked
                  </Badge>
                )}

                {canManageDevices ? (
                  <Button
                    size="sm"
                    variant={dev.isAuthorized ? "outline" : "default"}
                    data-testid={`toggle-device-auth-${dev.id}`}
                    onClick={() =>
                      void handleToggleDeviceAuthorization(
                        dev.id,
                        dev.isAuthorized
                      )
                    }
                  >
                    {dev.isAuthorized ? "Revoke Device" : "Authorize"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 100% Free-Tier Production Stack Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4 text-primary" />
            Production Architecture — 100% Free Tier ($0 / Month)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Every layer of eTinda runs on perpetual free-tier infrastructure
            with zero paid SaaS dependencies. See{" "}
            <span className="font-mono font-semibold text-foreground">
              PRODUCTION_FREE_TIER_SETUP.md
            </span>{" "}
            for step-by-step deployment.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5 text-primary" />
                Web & API Hosting
              </span>
              <Badge variant="default">$0 / mo</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              <strong>Vercel Hobby Free Tier</strong> — Next.js 16 App Router,
              global CDN, automatic HTTPS, and serverless `/api/sync` &
              `/api/users` endpoints.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-primary" />
                Vercel Prisma Database
              </span>
              <Badge variant="default">$0 / mo</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              <strong>Vercel Prisma Postgres Free Tier</strong> — Provisioned
              directly in Vercel Storage / Marketplace with zero cold starts,
              100k free operations/mo, and automatic{" "}
              <code className="font-mono">DATABASE_URL</code> injection.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Authentication & RBAC
              </span>
              <Badge variant="default">$0 / MAU</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              <strong>Self-Hosted Auth.js v5 (`next-auth`)</strong> + Node{" "}
              <code className="font-mono">crypto.scryptSync</code> password
              hashing & signed JWT cookies. Unlimited Owners & Helpers.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-primary" />
                Offline Engine & PWA
              </span>
              <Badge variant="default">$0 / mo</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              <strong>Browser IndexedDB (`Dexie.js`) + Service Worker</strong>{" "}
              — local-first POS checkout, outbox queue, and zero-cost offline
              caching on mobile phones & tablets.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Trail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Store Security & Operational Audit Logs ({auditLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {auditLogs.slice(0, 12).map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{log.action}</Badge>
                  <span className="font-semibold text-foreground">
                    {log.summary}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  By {log.userNameSnapshot} ({log.userRole}) • Device:{" "}
                  {log.deviceId}
                </p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {new Date(log.createdAt).toLocaleString("en-PH")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modal: Add Helper / User Account */}
      <ResponsiveDialog
        open={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Create Helper or Store User Account"
        description="Add a Store Helper (HELPER) for daily POS & stock-in duties, or a Co-Owner (ADMIN) with full financial & user management permissions."
      >
        <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
          <Input
            label="Full Name"
            placeholder="e.g., Kuya Ben (Cashier)"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            data-testid="new-user-name-input"
            required
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="e.g., ben.helper@etinda.ph"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value.trim())}
            data-testid="new-user-email-input"
            required
          />

          <Input
            label="Username (Lowercase letters, numbers, underscore)"
            placeholder="e.g., helper2"
            value={newUsername}
            onChange={(e) =>
              setNewUsername(
                e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "")
              )
            }
            data-testid="new-user-username-input"
            required
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Assigned Store Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="select-role-helper"
                onClick={() => setNewUserRole("HELPER")}
                className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                  newUserRole === "HELPER"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <p className="text-xs font-bold text-foreground">
                  Store Helper (HELPER)
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  POS sales, stock-in, and utang payments. Cannot view net profit
                  or delete products.
                </p>
              </button>

              <button
                type="button"
                data-testid="select-role-admin"
                onClick={() => setNewUserRole("ADMIN")}
                className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                  newUserRole === "ADMIN"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <p className="text-xs font-bold text-foreground">
                  Store Owner (ADMIN)
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Full access to catalog pricing, financial reports, users, and
                  devices.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="PIN / Password"
              type="password"
              placeholder="Min. 4 characters"
              value={newUserPin}
              onChange={(e) => setNewUserPin(e.target.value)}
              data-testid="new-user-pin-input"
              required
            />
            <Input
              label="Confirm PIN / Password"
              type="password"
              placeholder="Re-enter PIN"
              value={confirmUserPin}
              onChange={(e) => setConfirmUserPin(e.target.value)}
              data-testid="new-user-confirm-pin-input"
              required
            />
          </div>

          {userFormError ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
            >
              {userFormError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddUserOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreatingUser}
              data-testid="submit-create-user-btn"
            >
              {isCreatingUser ? "Creating Account..." : "Create Account"}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
  );
}
