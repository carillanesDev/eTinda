"use client";

import * as React from "react";
import {
  AlertTriangle,
  Inbox,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/70 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {actionLabel && onAction ? (
        <Button onClick={onAction} className="mt-4" size="default">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({
  label = "Loading store records from local database...",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Unable to complete operation",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-red-300 bg-destructive-muted/50 px-6 py-8 text-center"
      role="alert"
    >
      <AlertTriangle
        className="h-7 w-7 text-destructive"
        aria-hidden="true"
      />
      <h3 className="mt-2 text-base font-semibold text-destructive-muted-foreground">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-sm text-destructive-muted-foreground/90">
        {message}
      </p>
      {onRetry ? (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-4"
        >
          Try Again
        </Button>
      ) : null}
    </div>
  );
}

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search products, categories, or records...",
  className,
  ariaLabel = "Search",
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex min-h-11 w-full rounded-xl border border-input bg-card pl-10 pr-10 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

/**
 * Renders an accessible bottom-sheet drawer on mobile viewports (< 768px)
 * and a centered modal dialog on tablet/desktop viewports (>= 768px).
 */
export function ResponsiveDialog({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = "md:max-w-lg",
}: ResponsiveDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-[1px] md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl md:max-h-[85dvh] md:rounded-2xl",
          maxWidthClass
        )}
      >
        {/* Mobile grab handle - tap to close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tap to close"
          className="flex w-full justify-center pt-2.5 pb-1 md:hidden cursor-pointer"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300 hover:bg-slate-400" />
        </button>

        <div className="flex items-start justify-between border-b border-border px-4 py-3 md:px-5">
          <div className="min-w-0 flex-1 pr-3">
            <h2
              id="dialog-title"
              className="text-base font-bold text-foreground md:text-lg"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="dialog-close-btn"
            aria-label="Close dialog"
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/60 px-2.5 text-xs font-semibold text-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span className="text-xs">Close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: ConfirmationDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      maxWidthClass="md:max-w-md"
    >
      <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}

