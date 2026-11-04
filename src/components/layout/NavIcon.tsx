import * as React from "react";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import type { NavItemConfig } from "@/config/navigation";

export function NavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: NavItemConfig["iconName"];
  className?: string;
}) {
  switch (name) {
    case "LayoutDashboard":
      return <LayoutDashboard className={className} aria-hidden="true" />;
    case "ShoppingCart":
      return <ShoppingCart className={className} aria-hidden="true" />;
    case "Package":
      return <Package className={className} aria-hidden="true" />;
    case "Boxes":
      return <Boxes className={className} aria-hidden="true" />;
    case "ReceiptText":
      return <ReceiptText className={className} aria-hidden="true" />;
    case "Users":
      return <Users className={className} aria-hidden="true" />;
    case "UserPlus":
      return <UserPlus className={className} aria-hidden="true" />;
    case "WalletCards":
      return <WalletCards className={className} aria-hidden="true" />;
    case "BarChart3":
      return <BarChart3 className={className} aria-hidden="true" />;
    case "Settings":
      return <Settings className={className} aria-hidden="true" />;
  }
}

