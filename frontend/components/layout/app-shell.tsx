"use client";

import { motion } from "framer-motion";
import { Flag, Keyboard, LayoutGrid, Plus, ScanSearch, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Eyebrow, GlassShell, IconButton, PillLink } from "@/components/console/kit";
import { CommandPaletteProvider, useCommandPalette } from "@/components/navigation/command-palette";
import { NotificationsMenu } from "@/components/navigation/notifications-menu";
import { DemoBadge } from "@/components/ui/badges";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NetworkGuard } from "@/components/wallet/network-guard";
import { NetworkStatus } from "@/components/wallet/network-status";
import { mstTestnet } from "@/lib/chain/mst";
import { env } from "@/lib/config/env";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import "@/components/console/console-theme.css";
import "./marble-background.css";

const OVERVIEW = [{ href: "/dashboard", label: "Dashboard", icon: LayoutGrid, keys: "G D" }];
const TOOLS = [
  { href: "/scan", label: "Scan", icon: ScanSearch, keys: "G S" },
  { href: "/verify", label: "Verify", icon: ShieldCheck, keys: "G V" },
  { href: "/shield", label: "Shield", icon: ShieldAlert, keys: "G H" },
  { href: "/issuer", label: "Issuer", icon: Flag, keys: "G I" },
];
const NAV = [...OVERVIEW, ...TOOLS];

const isActive = (pathname: string, href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

/** Big heading in the top bar: a greeting on the dashboard, the section name elsewhere. */
function heading(pathname: string) {
  if (pathname.startsWith("/dashboard")) return { title: "Hi, Investigator", sub: "Dashboard" };
  if (pathname.startsWith("/certificate")) return { title: "Certificate", sub: "Document" };
  const item = NAV.find((n) => isActive(pathname, n.href));
  return { title: item?.label ?? "Console", sub: "Tools" };
}

function NavItem({ href, label, icon: Icon, keys }: (typeof NAV)[number]) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex h-11 items-center gap-3 rounded-full px-4 text-[14px] font-medium transition-colors",
          active ? "text-[#fff]" : "text-fg-2 hover:bg-[#f4f4f5] hover:text-fg",
        )}
      >
        {active && <motion.span layoutId="nav-active" transition={SPRING} className="absolute inset-0 rounded-full bg-[#0b0b0c]" />}
        <Icon className="relative size-[18px]" />
        <span className="relative flex-1">{label}</span>
        <span className={cn("relative hidden font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100 lg:inline", active ? "text-[#fff]/60" : "text-muted")}>
          {keys}
        </span>
      </Link>
    </li>
  );
}

/** White sidebar card: wordmark, navigation with section labels, settings at the bottom. */
function Sidebar() {
  const { openShortcuts } = useCommandPalette();
  return (
    // The whole card is sticky: it stays in place while only the content column scrolls. 41px = page padding (20)
    // + shell border (1) + shell padding (20), so it sticks exactly where it sits; it is one viewport tall minus that
    // on both sides, and scrolls itself if the menu ever outgrows it.
    <aside className="no-print sticky top-[41px] hidden h-[calc(100dvh-82px)] w-[248px] shrink-0 self-start overflow-y-auto rounded-[var(--radius-card)] border border-black/[0.05] bg-[#fff] shadow-[var(--shadow-card)] lg:block">
      <div className="flex min-h-full flex-col p-4">
      <Link href="/" className="mb-8 px-2 pt-1 text-[#0b0b0c]">
        <Logo />
      </Link>
      <Eyebrow className="mb-2 px-4">Overview</Eyebrow>
      <ul className="flex flex-col gap-1">
        {OVERVIEW.map((n) => (
          <NavItem key={n.href} {...n} />
        ))}
      </ul>
      <Eyebrow className="mb-2 mt-6 px-4">Tools</Eyebrow>
      <ul className="flex flex-col gap-1">
        {TOOLS.map((n) => (
          <NavItem key={n.href} {...n} />
        ))}
      </ul>

      <div className="mt-auto">
        <Eyebrow className="mb-2 px-4">Settings</Eyebrow>
        <button
          onClick={openShortcuts}
          className="flex h-11 w-full items-center gap-3 rounded-full px-4 text-left text-[14px] font-medium text-fg-2 hover:bg-[#f4f4f5] hover:text-fg"
        >
          <Keyboard className="size-[18px]" /> Keyboard shortcuts
        </button>
        <div className="mt-3 rounded-[var(--radius-tile)] bg-[#f4f4f5] px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          {env.useMocks ? (
            <>
              <span className="font-medium text-fg">Sample data mode.</span> API responses are simulated; on-chain reads are live.
            </>
          ) : (
            <>Live API · {mstTestnet.name}</>
          )}
        </div>
      </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const { open } = useCommandPalette();
  const pathname = usePathname();
  const { title, sub } = heading(pathname);
  return (
    <header className="no-print flex flex-wrap items-center gap-3 px-1 pb-5 pt-1 sm:gap-4 lg:pb-6">
      <Link href="/dashboard" className="text-[#0b0b0c] lg:hidden" aria-label="Dashboard">
        <LogoMark className="h-8" />
      </Link>
      <div className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1">
        <div className="text-[13px] font-medium text-muted">{sub}</div>
        <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[34px]">{title}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NetworkStatus className="hidden border-black/[0.08] bg-[#fff]/70 md:flex" />
        {env.useMocks && <DemoBadge className="hidden bg-[#fff]/70 xl:inline-flex" />}
        <PillLink href="/scan" className="hidden sm:inline-flex">
          <Plus /> New scan
        </PillLink>
        <IconButton onClick={open} aria-label="Search (⌘K)" title="Search addresses, certificates, tx hashes">
          <Search />
        </IconButton>
        <NotificationsMenu />
        <ConnectButton />
      </div>
      <div className="order-last w-full md:hidden">
        <NetworkStatus className="w-fit border-black/[0.08] bg-[#fff]/70" />
      </div>
    </header>
  );
}

/** Mobile: the sidebar becomes a bottom bar. */
function BottomBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="no-print fixed inset-x-3 bottom-3 z-40 rounded-full border border-[#fff]/70 bg-[#fff]/85 px-2 py-1.5 shadow-[0_18px_40px_-16px_rgba(11,11,12,0.35)] backdrop-blur-xl lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-center justify-between">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mx-auto flex h-12 max-w-[72px] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-medium",
                  active ? "bg-[#0b0b0c] text-[#fff]" : "text-fg-2",
                )}
              >
                <Icon className="size-[18px]" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CommandPaletteProvider>
      <div className="console-theme marble-console relative isolate min-h-dvh">
        <div className="marble-background marble-background--still no-print" aria-hidden="true" />

        <div className="p-2.5 pb-24 sm:p-4 sm:pb-24 lg:p-5">
          <GlassShell className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-[1600px] gap-5 p-3 sm:p-5">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col pt-1">
              <TopBar />
              <NetworkGuard />
              <main className="console-main relative flex flex-1 flex-col">{children}</main>
            </div>
          </GlassShell>
        </div>

        <BottomBar />
      </div>
    </CommandPaletteProvider>
  );
}
