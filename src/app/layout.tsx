import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell/AppShell";
import { ProfileProvider } from "@/components/profile/ProfileProvider";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Salesforce Front Door",
  description:
    "An agent-first entry point to purpose-built Salesforce applications.",
};

/**
 * Follow the OS preference until the user chooses an appearance. The inline
 * bootstrap applies saved choices before paint, including browser controls.
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/*
         * SLDS 2 — Salesforce Cosmos theme. Served as a static stylesheet from
         * public/vendor/slds (synced by scripts/copy-slds.mjs on predev/prebuild).
         * Apply slds-* blueprint classes in your JSX to inherit the look.
         */}
        <link rel="stylesheet" href="/vendor/slds/slds2.cosmos.css" />
      </head>
      {/* SLDS tokens inherit the root's system or explicitly selected scheme. */}
      <body className="slds-color-scheme_system">
        <ProfileProvider>
          <AppShell>{children}</AppShell>
        </ProfileProvider>
      </body>
    </html>
  );
}
