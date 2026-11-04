import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { formatCentavosToPHP } from "@/lib/utils/money";

export interface CurrencyDisplayProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  centavos: number;
  showPlusSign?: boolean;
}

export function CurrencyDisplay({
  centavos,
  showPlusSign = false,
  className,
  ...props
}: CurrencyDisplayProps) {
  const formatted = formatCentavosToPHP(centavos);
  const prefix = showPlusSign && centavos > 0 ? "+" : "";

  return (
    <span className={cn("tabular-money font-semibold", className)} {...props}>
      {prefix}
      {formatted}
    </span>
  );
}

