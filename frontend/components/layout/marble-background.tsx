"use client";

import { useEffect, useRef } from "react";
import "./marble-background.css";

/** Decorative, viewport-sized WebGL scene. Its parent should establish isolation. */
export function MarbleBackground() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;

    // Keep Three.js off the critical UI path and out of landing/login bundles.
    void import("./marble-scene").then(({ createMarbleScene }) => {
      if (!cancelled) dispose = createMarbleScene(host);
    }).catch((error: unknown) => {
      // The CSS ivory surface remains usable if WebGL/the chunk is unavailable.
      console.warn("Marble background unavailable", error);
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return <div ref={hostRef} className="marble-background no-print" aria-hidden="true" />;
}
