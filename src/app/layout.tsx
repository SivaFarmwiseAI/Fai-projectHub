import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { MenuAccessProvider } from "@/contexts/menu-access-context";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { MobileNav } from "@/components/mobile-nav";
import { KeyboardShortcutsOverlay } from "@/components/keyboard-shortcuts";
import "./globals.css";

/* ── Premium font stack ──────────────────────────────────── */
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProjectHub — CEO Command Center",
  description: "AI-powered project management for small tech teams",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ProjectHub",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#3b82f6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex bg-slate-50/60">
        <AuthProvider>
          <MenuAccessProvider>
          <CommandPalette />
          <KeyboardShortcutsOverlay />
          <AppShell>{children}</AppShell>
          <MobileNav />
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            duration={4000}
            toastOptions={{
              style: {
                fontFamily: "var(--font-sans)",
                fontSize: "0.875rem",
              },
            }}
          />
          </MenuAccessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
