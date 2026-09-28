"use client";

import { motion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";

/** Re-mounts on every console navigation: a short, quiet page entrance. */
export default function ConsoleTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="console-page flex flex-1 flex-col"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
