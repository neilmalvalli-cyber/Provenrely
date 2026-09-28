"use client";

import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Backdrop } from "@/components/layout/backdrop";
import { LinkButton } from "@/components/ui/button";
import { getCase } from "@/data/cases";
import { formatNumber } from "@/lib/utils";
import { Companion } from "../companion/companion";

const CASE = getCase("PR-8842")!;

/**
 * The landing hero. Its mark is also the page's companion: on desktop it leaves the hero for
 * the centre column and becomes each section's glass scene as you scroll (../companion).
 * At rest it is exactly the image the intro lands on.
 */
export function ScrollHero() {
  const d = (s: string) => ({ ["--intro-delay" as string]: s }) as CSSProperties;
  return (
    <section data-morph="mark" data-snap="start" className="relative flex min-h-[100svh] items-center overflow-x-clip pt-24 pb-16 lg:pt-16">
      <Backdrop variant="hero" />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8">
        <div data-cmp-col="" className="pt-8 lg:pt-0">
          <p className="intro-content animate-rise text-[13.5px] text-fg-2" style={d("0s")}>
            Evidence infrastructure for on-chain investigations
          </p>
          <h1 className="intro-content animate-rise text-display text-sheen mt-5 text-balance" style={d("0.1s")}>
            Evidence, anchored.
          </h1>
          <div className="intro-content animate-rise mt-10 flex flex-wrap gap-3" style={d("0.2s")}>
            <LinkButton href="/dashboard" variant="primary" size="lg">
              Open the console
              <ArrowRight />
            </LinkButton>
            <LinkButton href="#how" variant="secondary" size="lg">
              See how sealing works
            </LinkButton>
          </div>
          <p className="intro-content animate-rise mt-10 text-[12.5px] text-muted" style={d("0.3s")}>
            Built on Ethereum · Sepolia preview
          </p>
        </div>

        <div className="relative flex justify-center pb-10">
          <div className="sh-box">
            <Companion />
            {/* status — stays with the hero */}
            <div className="absolute left-1/2 top-[104%] -translate-x-1/2">
              <div
                className="intro-content glass flex animate-rise items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-2.5 pr-4 [animation-delay:600ms]"
                style={d("0.55s")}
              >
                <span className="size-1.5 rounded-full bg-ok shadow-[0_0_6px_rgba(52,199,123,0.8)]" />
                <span className="text-[12px] text-fg">Sealed</span>
                <span className="font-mono text-[11.5px] text-muted">
                  {CASE.id} · #{formatNumber(CASE.evidence.blockHeight)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
