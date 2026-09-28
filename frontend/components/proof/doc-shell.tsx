"use client";

import { Moon, Printer, ShieldCheck, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/button";

const KEY = "solidity:doc-theme";

/** Toolbar for documents inside the console: light/dark document toggle (remembered), print, verify. */
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
    <div data-doc-theme={theme} className="doc">
      <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="icon" onClick={toggle} aria-label={theme === "light" ? "Dark document" : "Light document"}>
          {theme === "light" ? <Moon /> : <Sun />}
        </Button>
        <Button variant="secondary" size="sm" className="h-10 px-4" onClick={() => window.print()}>
          <Printer />
          <span className="hidden sm:inline">Print / PDF</span>
        </Button>
        <LinkButton href={verifyHref} variant="primary" size="sm" className="h-10 px-4">
          <ShieldCheck />
          Verify
        </LinkButton>
      </div>
      {children}
    </div>
  );
}
