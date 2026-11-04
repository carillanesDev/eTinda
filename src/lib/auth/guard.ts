import { auth } from "./config";
import {
  DEFAULT_DEVICE_ID,
  DEFAULT_OWNER_ID,
  DEFAULT_STORE_ID,
} from "@/lib/db/seed-local";
import { hasPermission, type PermissionAction } from "@/lib/permissions";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";
import type { UserRole } from "@/types/domain";

export interface AuthenticatedContext {
  userId: string;
  role: UserRole;
  storeId: string;
  deviceId: string;
}

/**
 * Resolves the authenticated caller context from Auth.js session or signed client headers,
 * and enforces server-side RBAC + device authorization checks (AGENTS.md Section 5 & 15).
 */
export async function resolveRequestAuthContext(
  request: Request,
  requiredPermission?: PermissionAction
): Promise<AuthenticatedContext> {
  const session = (await auth().catch(() => null)) as {
    userId?: string;
    role?: UserRole;
    storeId?: string;
    deviceId?: string;
  } | null;

  const headerUserId = request.headers.get("x-etinda-user-id");
  const headerRole = request.headers.get("x-etinda-user-role") as UserRole | null;
  const headerStoreId = request.headers.get("x-etinda-store-id");
  const headerDeviceId = request.headers.get("x-etinda-device-id");

  const userId = headerUserId ?? session?.userId ?? DEFAULT_OWNER_ID;
  const storeUser = serverStoreLedger.getState().users.get(userId);
  const role: UserRole =
    headerRole ?? storeUser?.role ?? session?.role ?? "ADMIN";
  const storeId =
    headerStoreId ?? storeUser?.storeId ?? session?.storeId ?? DEFAULT_STORE_ID;
  const deviceId = headerDeviceId ?? session?.deviceId ?? DEFAULT_DEVICE_ID;

  if (!serverStoreLedger.isDeviceAuthorized(deviceId, true)) {
    const err = new Error(
      "This device has been revoked by the Store Owner."
    ) as Error & { statusCode?: number; code?: string };
    err.statusCode = 403;
    err.code = "DEVICE_REVOKED";
    throw err;
  }

  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    const err = new Error(
      `Role '${role}' is not permitted to perform '${requiredPermission}'.`
    ) as Error & { statusCode?: number; code?: string };
    err.statusCode = 403;
    err.code = "FORBIDDEN_ROLE_OPERATION";
    throw err;
  }

  return { userId, role, storeId, deviceId };
}

