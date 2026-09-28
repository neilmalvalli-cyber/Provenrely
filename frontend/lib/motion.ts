/**
 * Motion system. Three durations, one easing curve — every animation in the
 * app should use these so movement feels like one product.
 * CSS equivalents live in app/globals.css (--ease-out-expo, 250ms default).
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DUR = {
  fast: 0.15,
  base: 0.25,
  slow: 0.5,
} as const;

export const SPRING = { type: "spring", stiffness: 260, damping: 30, mass: 0.8 } as const;

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: DUR.base, ease: EASE },
};
