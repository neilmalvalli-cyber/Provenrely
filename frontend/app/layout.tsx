import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/config/brand";
import { ToastProvider } from "@/components/ui/toast";
import { INTRO_BOOT_SCRIPT } from "@/lib/intro-boot";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`, template: `%s · ${PRODUCT_NAME}` },
  description: "Trace on-chain activity, seal what you find, and give anyone a way to check it.",
};

export const viewport: Viewport = {
  themeColor: "#030409",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Plain inline script: runs before first paint to decide whether the landing intro
            plays (see lib/intro-boot.ts). next/script's beforeInteractive runs too late. */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh overflow-x-clip">
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
