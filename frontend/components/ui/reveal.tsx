"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { DUR, EASE } from "@/lib/motion";

/** Fade-and-rise once, on first scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      data-reveal=""
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: DUR.slow, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}
