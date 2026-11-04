import type { UserRole } from "@/types/domain";

export type PermissionAction =
  | "VIEW_DASHBOARD"
  | "VIEW_FINANCIAL_MARGINS"
  | "OPERATE_POS"
  | "VIEW_PRODUCTS"
  | "MANAGE_PRODUCTS"
  | "VIEW_INVENTORY"
  | "RECEIVE_PURCHASE_STOCK"
  | "ADJUST_INVENTORY"
  | "VIEW_SALES_HISTORY"
  | "VOID_SALE_TRANSACTION"
  | "VIEW_CUSTOMERS_AND_UTANG"
  | "RECORD_UTANG_CHARGE_OR_PAYMENT"
  | "ADJUST_UTANG_BALANCE"
  | "VIEW_OWNER_REPORTS"
  | "MANAGE_USERS_AND_DEVICES"
  | "RESOLVE_SYNC_CONFLICTS";

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<PermissionAction>> = {
  ADMIN: new Set<PermissionAction>([
    "VIEW_DASHBOARD",
    "VIEW_FINANCIAL_MARGINS",
    "OPERATE_POS",
    "VIEW_PRODUCTS",
    "MANAGE_PRODUCTS",
    "VIEW_INVENTORY",
    "RECEIVE_PURCHASE_STOCK",
    "ADJUST_INVENTORY",
    "VIEW_SALES_HISTORY",
    "VOID_SALE_TRANSACTION",
    "VIEW_CUSTOMERS_AND_UTANG",
    "RECORD_UTANG_CHARGE_OR_PAYMENT",
    "ADJUST_UTANG_BALANCE",
    "VIEW_OWNER_REPORTS",
    "MANAGE_USERS_AND_DEVICES",
    "RESOLVE_SYNC_CONFLICTS",
  ]),
  HELPER: new Set<PermissionAction>([
    "VIEW_DASHBOARD",
    "OPERATE_POS",
    "VIEW_PRODUCTS",
    "VIEW_INVENTORY",
    "VIEW_SALES_HISTORY",
    "VIEW_CUSTOMERS_AND_UTANG",
    "RECORD_UTANG_CHARGE_OR_PAYMENT",
  ]),
};

export function hasPermission(
  role: UserRole,
  action: PermissionAction
): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

export function getRoleDisplayLabel(role: UserRole): string {
  return role === "ADMIN" ? "Owner" : "Helper";
}

