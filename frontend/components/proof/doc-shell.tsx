"use client";

import { Moon, Printer, ShieldCheck, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/config/brand";

const KEY = "solidity:doc-theme";

/** Page chrome for documents: light/dark toggle (remembered), print, verify. */
export function DocShell({ verifyHref, children }: { verifyHref: string; children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === "dark" || t === "light") setTheme(t);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div data-doc-theme={theme} className="doc min-h-dvh bg-[var(--doc-page)] transition-colors duration-300">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-void/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label={`${PRODUCT_NAME} home`}>
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === "light" ? "Dark document" : "Light document"}>
              {theme === "light" ? <Moon /> : <Sun />}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer />
              <span className="hidden sm:inline">Print / PDF</span>
            </Button>
            <LinkButton href={verifyHref} variant="primary" size="sm">
              <ShieldCheck />
              Verify
            </LinkButton>
          </div>
        </div>
      </header>
      <div className={cn("transition-colors duration-300")}>{children}</div>
    </div>
  );
}
