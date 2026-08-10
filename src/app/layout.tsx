import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell/AppShell";

export const metadata: Metadata = {
  title: "Platform Studio",
  description: "A React prototyping environment for a new Salesforce vision.",
};

/**
 * Follow the OS light/dark preference. This emits <meta name="color-scheme">,
 * which tells the browser to render its own chrome (root background, scrollbars,
 * form controls) and the very first paint in the user's preferred scheme — so
 * there's no light flash on a dark-mode machine. The matching
 * `slds-color-scheme_system` class on <body> drives SLDS's own theming.
 */
export const viewport: Viewport = {
  colorScheme: "light dark",
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
      {/*
       * `slds-color-scheme_system` sets CSS `color-scheme: light dark` on the
       * document, so every SLDS color token — each defined with the native
       * `light-dark()` function — resolves to the user's OS preference. No JS,
       * no flash, and it re-resolves live when the OS theme changes. (SLDS also
       * ships `slds-color-scheme_light` / `_dark` for a future manual override.)
       */}
      <body className="slds-color-scheme_system">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
