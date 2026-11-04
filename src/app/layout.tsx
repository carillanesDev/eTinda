import type { Metadata, Viewport } from "next";
import { RootProviders } from "@/components/layout/RootProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "eTinda — Offline-First Sari-Sari Store POS & Inventory",
  description:
    "Mobile-first, offline-first Point of Sale, Inventory Ledger, and Utang Management System for Sari-Sari Stores.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
