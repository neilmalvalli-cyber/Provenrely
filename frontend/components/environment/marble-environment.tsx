"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { initialTier, type QualityTier } from "./config";
import type { EnvironmentHandle, EnvironmentSettings } from "./environment";
import "./marble-environment.css";

interface Props {
  className?: string;
  /** Force a tier (lab); otherwise chosen from the device and lowered from measured frame times. */
  tier?: QualityTier;
  settings?: Partial<EnvironmentSettings>;
  startTime?: number;
  onHandle?: (handle: EnvironmentHandle | null) => void;
  onStatus?: (status: string) => void;
}

/**
 * The photographic marble environment. The poster (a still of the same scene) paints first and stays when WebGL
 * is unavailable or the device is weak; the live scene is code-split, loads after the page, and fades in over it.
 */
export function MarbleEnvironment({ className, tier: forcedTier, settings, startTime, onHandle, onStatus }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EnvironmentHandle | null>(null);
  const [live, setLive] = useState(false);
  const [tier, setTier] = useState<QualityTier | null>(forcedTier ?? null);

  useEffect(() => {
    if (!forcedTier) setTier(initialTier());
  }, [forcedTier]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !tier || tier === "poster") {
      if (tier === "poster") onStatus?.("poster");
      return;
    }
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduced = () => handleRef.current?.setReducedMotion(reduced.matches);
    onStatus?.("loading");

    // Keep three.js off the critical path: start once the browser is idle after the app has painted.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = (cb: () => void) => (hasIdle ? window.requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 200));
    const idleId = idle(() => {
      import("./environment")
        .then(({ createEnvironment }) =>
          createEnvironment(host, {
            tier,
            reducedMotion: reduced.matches,
            settings,
            startTime,
            lockTier: Boolean(forcedTier),
            onFirstFrame: () => {
              if (cancelled) return;
              setLive(true);
              onStatus?.("live");
            },
            onFallback: (reason) => {
              if (cancelled) return;
              onStatus?.(`poster (${reason})`);
              setLive(false);
              setTier("poster");
            },
          }),
        )
        .then((handle) => {
          if (cancelled) {
            handle.dispose();
            return;
          }
          handleRef.current = handle;
          onHandle?.(handle);
          reduced.addEventListener("change", onReduced);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          // The poster stays: a missing chunk, asset or GL feature must never break the app.
          console.info("Marble environment unavailable; showing the still.", error);
          onStatus?.("poster (error)");
        });
    });

    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(idleId as number);
      else clearTimeout(idleId);
      reduced.removeEventListener("change", onReduced);
      handleRef.current?.dispose();
      handleRef.current = null;
      onHandle?.(null);
      setLive(false);
    };
    // Settings are applied through the handle after creation; they must not recreate the scene.
  }, [tier]);

  useEffect(() => {
    if (settings) handleRef.current?.update(settings);
  }, [settings]);

  return (
    <div className={cn("marble-environment", className)} data-live={live || undefined} aria-hidden="true">
      <div className="marble-environment__poster" />
      <div ref={hostRef} className="marble-environment__canvas" />
    </div>
  );
}
