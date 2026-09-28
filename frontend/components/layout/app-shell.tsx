"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flag, Keyboard, LayoutGrid, Menu, ScanSearch, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { CommandPaletteProvider, Kbd, useCommandPalette } from "@/components/navigation/command-palette";
import { NotificationsMenu } from "@/components/navigation/notifications-menu";
import { DemoBadge } from "@/components/ui/badges";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NetworkGuard } from "@/components/wallet/network-guard";
import { NetworkStatus } from "@/components/wallet/network-status";
import { mstTestnet } from "@/lib/chain/mst";
import { env } from "@/lib/config/env";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import "./marble-background.css";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, keys: "G D" },
  { href: "/scan", label: "Scan", icon: ScanSearch, keys: "G S" },
  { href: "/verify", label: "Verify", icon: ShieldCheck, keys: "G V" },
  { href: "/shield", label: "Shield", icon: ShieldAlert, keys: "G H" },
  { href: "/issuer", label: "Issuer", icon: Flag, keys: "G I" },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon, keys }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              className={cn(
                "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors",
                active ? "text-fg" : "text-fg-2 hover:bg-white/[0.03] hover:text-fg",
              )}
            >
              {active && <motion.span layoutId="nav-active" transition={SPRING} className="absolute inset-0 rounded-lg bg-white/[0.06]" />}
              {active && (
                <motion.span layoutId="nav-bar" transition={SPRING} className="absolute inset-y-2.5 left-0 w-[2px] rounded-full bg-violet shadow-[0_0_10px_rgba(139,108,248,0.9)]" />
              )}
              <Icon className={cn("relative size-4", active ? "text-violet-300" : "text-muted group-hover:text-fg-2")} />
              <span className="relative flex-1">{label}</span>
              <span className="relative hidden font-mono text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 lg:inline">{keys}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** No accounts: the wallet is the identity. The footer only states which data mode is active. */
function SidebarFooter() {
  return (
    <div className="rounded-lg px-3 py-2 text-[12.5px] leading-relaxed text-muted">
      {env.useMocks ? (
        <>
          <span className="text-amber-200">Sample data mode.</span> API responses are simulated; on-chain reads are live.
        </>
      ) : (
        <>Live API · {mstTestnet.name}</>
      )}
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { open, openShortcuts } = useCommandPalette();
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-base/75 px-4 backdrop-blur-2xl backdrop-saturate-150 sm:px-6">
      <button onClick={onMenu} className="-ml-1 rounded-md p-1.5 text-fg-2 lg:hidden" aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <Link href="/dashboard" className="lg:hidden" aria-label="Overview">
        <LogoMark className="h-7" />
      </Link>

      <button
        onClick={open}
        className="hidden h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 text-left text-[13.5px] text-muted transition-colors hover:border-line-strong hover:text-fg-2 md:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1">Search addresses, certificates, tx hashes</span>
        <span className="flex gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button onClick={open} className="rounded-md p-2 text-fg-2 hover:bg-white/5 md:hidden" aria-label="Search">
          <Search className="size-4" />
        </button>
        <NetworkStatus className="hidden sm:flex" />
        {env.useMocks && <DemoBadge className="hidden xl:inline-flex" />}
        <button onClick={openShortcuts} className="hidden rounded-md p-2 text-fg-2 hover:bg-white/5 hover:text-fg lg:block" aria-label="Keyboard shortcuts">
          <Keyboard className="size-4" />
        </button>
        <NotificationsMenu />
        <ConnectButton />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  useEffect(() => setDrawer(false), [pathname]);

  return (
    <CommandPaletteProvider>
      <div className="marble-console relative isolate min-h-dvh">
        <div className="marble-background marble-background--still no-print" aria-hidden="true" />

        <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-void/80 px-3 py-4 backdrop-blur-xl lg:flex">
          <Link href="/" className="mb-7 px-2">
            <Logo />
          </Link>
          <NavList />
          <div className="mt-auto">
            <SidebarFooter />
          </div>
        </aside>

        <AnimatePresence>
          {drawer && (
            <>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawer(false)}
              />
              <motion.aside
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-void px-3 py-4 lg:hidden"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={SPRING}
              >
                <div className="mb-7 flex items-center justify-between px-2">
                  <Logo />
                  <button onClick={() => setDrawer(false)} className="rounded-md p-1.5 text-fg-2" aria-label="Close menu">
                    <X className="size-5" />
                  </button>
                </div>
                <NavList onNavigate={() => setDrawer(false)} />
                <div className="mt-auto">
                  <SidebarFooter />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="relative lg:pl-60">
          <TopBar onMenu={() => setDrawer(true)} />
          <NetworkGuard />
          <main className="relative mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
