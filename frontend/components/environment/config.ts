/** Feature flag: the environment is on unless NEXT_PUBLIC_MARBLE_ENVIRONMENT is "false". */
export const MARBLE_ENVIRONMENT_ENABLED = process.env.NEXT_PUBLIC_MARBLE_ENVIRONMENT !== "false";

export const ENVIRONMENT_BASE = "/environment";

/** "poster" = the static image only (weak devices, no WebGL, or after a measured slow start). */
export type QualityTier = "high" | "medium" | "poster";

export interface TierSettings {
  /** Upper bound for the device pixel ratio. */
  maxDpr: number;
  /** Leaf-mask resolution (square). */
  mask: number;
  /** Floor reflection resolution as a fraction of the drawing buffer. */
  reflection: number;
  /** Hardware MSAA samples for the main pass (0 = use SMAA instead). */
  msaa: number;
  /** Frame cap: the motion is slow, so the medium tier doesn't need 60 Hz. */
  fps: number;
}

export const TIERS: Record<Exclude<QualityTier, "poster">, TierSettings> = {
  high: { maxDpr: 1.75, mask: 2048, reflection: 0.5, msaa: 4, fps: 60 },
  medium: { maxDpr: 1.25, mask: 1024, reflection: 0.35, msaa: 0, fps: 30 },
};

export const POSTER = {
  wide: `${ENVIRONMENT_BASE}/poster-wide.webp`,
  tall: `${ENVIRONMENT_BASE}/poster-tall.webp`,
};

/** Pick a starting tier from what the device says about itself; measured frame times can lower it later. */
export function initialTier(): QualityTier {
  if (typeof window === "undefined") return "poster";
  const override = new URLSearchParams(window.location.search).get("environment");
  if (override === "high" || override === "medium" || override === "poster") return override;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) return "poster";
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return "poster";
  const small = window.matchMedia("(max-width: 640px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (small && coarse) return "poster"; // phones: the poster looks the same and costs no battery
  if ((nav.deviceMemory ?? 8) < 4 || (navigator.hardwareConcurrency ?? 8) <= 2) return "poster";
  if (coarse || (window.devicePixelRatio ?? 1) > 2 || (nav.deviceMemory ?? 8) < 8) return "medium";
  return "high";
}
