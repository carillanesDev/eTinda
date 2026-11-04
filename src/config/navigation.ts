import type { UserRole } from "@/types/domain";

export interface NavItemConfig {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  iconName:
    | "LayoutDashboard"
    | "ShoppingCart"
    | "Package"
    | "Boxes"
    | "ReceiptText"
    | "Users"
    | "UserPlus"
    | "WalletCards"
    | "BarChart3"
    | "Settings";
  allowedRoles: UserRole[];
  mobilePrimarySlot?: boolean;
  group: "OPERATIONS" | "CATALOG_AND_STOCK" | "CREDIT" | "MANAGEMENT";
  description: string;
}

export const APP_NAVIGATION_ITEMS: readonly NavItemConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    href: "/dashboard",
    iconName: "LayoutDashboard",
    allowedRoles: ["ADMIN", "HELPER"],
    mobilePrimarySlot: true,
    group: "OPERATIONS",
    description: "Store overview, alerts, and sync status",
  },
  {
    id: "pos",
    label: "Point of Sale",
    shortLabel: "POS",
    href: "/pos",
    iconName: "ShoppingCart",
    allowedRoles: ["ADMIN", "HELPER"],
    mobilePrimarySlot: true,
    group: "OPERATIONS",
    description: "Fast counter checkout for cash and utang sales",
  },
  {
    id: "inventory",
    label: "Inventory",
    shortLabel: "Stock",
    href: "/inventory",
    iconName: "Boxes",
    allowedRoles: ["ADMIN", "HELPER"],
    mobilePrimarySlot: true,
    group: "CATALOG_AND_STOCK",
    description: "Current stock levels, receiving, and movement ledger",
  },
  {
    id: "utang",
    label: "Utang Ledger",
    shortLabel: "Utang",
    href: "/utang",
    iconName: "WalletCards",
    allowedRoles: ["ADMIN", "HELPER"],
    mobilePrimarySlot: true,
    group: "CREDIT",
    description: "Customer credit balances, charges, and payments",
  },
  {
    id: "products",
    label: "Products & Units",
    shortLabel: "Products",
    href: "/products",
    iconName: "Package",
    allowedRoles: ["ADMIN", "HELPER"],
    mobilePrimarySlot: false,
    group: "CATALOG_AND_STOCK",
    description: "Product catalog, categories, prices, and selling units",
  },
  {
    id: "sales",
    label: "Sales History",
    shortLabel: "Sales",
    href: "/sales",
    iconName: "ReceiptText",
    allowedRoles: ["ADMIN", "HELPER"],
    mobilePrimarySlot: false,
    group: "OPERATIONS",
    description: "Completed receipts, filterable history, and reversals",
  },
  {
    id: "customers",
    label: "Customers",
    shortLabel: "Customers",
    href: "/customers",
    iconName: "Users",
    allowedRoles: ["ADMIN", "HELPER"],
    mobilePrimarySlot: false,
    group: "CREDIT",
    description: "Customer directory and transaction profiles",
  },
  {
    id: "users",
    label: "Users & Helpers",
    shortLabel: "Users",
    href: "/users",
    iconName: "UserPlus",
    allowedRoles: ["ADMIN"],
    mobilePrimarySlot: false,
    group: "MANAGEMENT",
    description: "Owner user creation page for store helpers and co-owners",
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    shortLabel: "Reports",
    href: "/reports",
    iconName: "BarChart3",
    allowedRoles: ["ADMIN"],
    mobilePrimarySlot: false,
    group: "MANAGEMENT",
    description: "Owner financial summaries, margins, and stock reconciliation",
  },
  {
    id: "settings",
    label: "Settings & Devices",
    shortLabel: "Settings",
    href: "/settings",
    iconName: "Settings",
    allowedRoles: ["ADMIN", "HELPER"],
    mobilePrimarySlot: false,
    group: "MANAGEMENT",
    description: "Store info, helpers, registered devices, and sync audit",
  },
];

export function getNavItemsForRole(role: UserRole): NavItemConfig[] {
  return APP_NAVIGATION_ITEMS.filter((item) =>
    item.allowedRoles.includes(role)
  );
}

