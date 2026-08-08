import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell/AppShell";

export const metadata: Metadata = {
  title: "Platform Studio",
  description: "A React prototyping environment for a new Salesforce vision.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/*
         * SLDS 2 — Salesforce Cosmos theme. Served as a static stylesheet from
         * public/vendor/slds (synced by scripts/copy-slds.mjs on predev/prebuild).
         * Apply slds-* blueprint classes in your JSX to inherit the look.
         */}
        <link rel="stylesheet" href="/vendor/slds/slds2.cosmos.css" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
