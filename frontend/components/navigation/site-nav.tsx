"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { LinkButton } from "@/components/ui/button";
import { DUR, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/config/brand";

/**
 * Minimal site header. The logo is always there; an "Open console" button
 * appears only once the hero (which has its own CTAs) has scrolled away.
 */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      setPastHero(window.scrollY > window.innerHeight * 0.7);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-line bg-void/70 backdrop-blur-2xl backdrop-saturate-150" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={`${PRODUCT_NAME} home`}>
          <Logo intro />
        </Link>
        <AnimatePresence>
          {pastHero && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: DUR.base, ease: EASE }}
            >
              <LinkButton href="/dashboard" variant="primary" size="sm">
                Open console
                <ArrowRight />
              </LinkButton>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
