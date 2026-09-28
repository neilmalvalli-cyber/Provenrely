"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { formatNumber } from "@/lib/utils";

const MARK_SRC = "/brand/mark-640.webp";
const maskStyle = {
  WebkitMaskImage: `url(${MARK_SRC})`,
  maskImage: `url(${MARK_SRC})`,
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
} as const;

/**
 * The brand mark as a physical object: it tilts in 3D toward the pointer and
 * a highlight travels across its facets. One slow float when idle.
 */
export function HeroMark({ block = 6892118 }: { block?: number }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 90, damping: 18, mass: 0.9 };
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-16, 16]), spring);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), spring);
  const lx = useSpring(useTransform(px, [-0.5, 0.5], [18, 82]), spring);
  const ly = useSpring(useTransform(py, [-0.5, 0.5], [14, 70]), spring);
  const sheen = useMotionTemplate`radial-gradient(circle at ${lx}% ${ly}%, rgba(255,255,255,0.55), rgba(255,255,255,0.08) 28%, transparent 52%)`;
  const shadowX = useTransform(rotateY, (v) => `${v * -1.2}px`);

  // While the landing intro plays, stay perfectly still at rest so the flying symbol
  // lands exactly on this mark; start floating and tilting only once it has landed.
  const [live, setLive] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    let wasIntro = false;
    let t = 0;
    const check = () => {
      const s = html.getAttribute("data-intro");
      const intro = s === "playing" || s === "revealing";
      window.clearTimeout(t);
      if (intro) {
        wasIntro = true;
        setLive(false);
      } else if (wasIntro) {
        // let the intro's overlay copy finish fading out on top before we start moving
        t = window.setTimeout(() => setLive(true), 450);
      } else {
        setLive(true);
      }
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
    return () => {
      mo.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (reduce || !live) return;
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reduce, live]);

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[560px] items-center justify-center" style={{ perspective: 1100 }}>
      {/* orbit: one thin ring, one travelling light */}
      <svg viewBox="0 0 560 560" className="intro-fade absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id="hm-ring" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c4b5fd" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path id="hm-orbit" d="M40 330 a240 78 0 1 0 480 0 a240 78 0 1 0 -480 0" fill="none" stroke="url(#hm-ring)" strokeWidth="1" />
        <path d="M100 330 a180 56 0 1 0 360 0 a180 56 0 1 0 -360 0" fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 6" />
        {!reduce && (
          <circle r="2.5" fill="#ddd6fe">
            <animateMotion dur="11s" repeatCount="indefinite">
              <mpath href="#hm-orbit" />
            </animateMotion>
          </circle>
        )}
      </svg>

      {/* floor light */}
      <motion.div
        aria-hidden
        className="intro-fade absolute bottom-[17%] h-10 w-[46%] rounded-[100%] bg-[radial-gradient(closest-side,rgba(124,92,250,0.55),transparent)] blur-md"
        style={{ x: shadowX }}
      />

      <motion.div
        className="relative"
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        animate={reduce || !live ? { y: 0 } : { y: [0, -10, 0] }}
        transition={live ? { duration: 7, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
      >
        <LogoMark size="lg" priority introTarget="hero-mark" className="h-[260px] drop-shadow-[0_30px_60px_rgba(76,50,190,0.45)] sm:h-[330px]" />
        {/* specular sheen, clipped to the mark's own shape */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay transition-opacity duration-[900ms] ease-out"
          style={{ ...maskStyle, background: sheen, opacity: live ? 1 : 0 }}
        />
        {/* faint reflection */}
        <div
          aria-hidden
          className="intro-fade pointer-events-none absolute left-0 right-0 top-full mt-3 opacity-[0.14] blur-[1.5px]"
          style={{ transform: "scaleY(-1)", maskImage: "linear-gradient(to top, #000, transparent 45%)", WebkitMaskImage: "linear-gradient(to top, #000, transparent 45%)" }}
        >
          <LogoMark size="lg" className="h-[260px] sm:h-[330px]" />
        </div>
      </motion.div>

      {/* one status chip — the only annotation */}
      <div
        className="intro-content glass absolute bottom-[6%] left-1/2 flex -translate-x-1/2 animate-rise items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-2.5 pr-4 [animation-delay:600ms]"
        style={{ ["--intro-delay" as string]: "0.55s" }}
      >
        <span className="size-1.5 rounded-full bg-ok shadow-[0_0_6px_rgba(52,199,123,0.8)]" />
        <span className="text-[12px] text-fg">Sealed</span>
        <span className="font-mono text-[11.5px] text-muted">PR-8842 · #{formatNumber(block)}</span>
      </div>
    </div>
  );
}
