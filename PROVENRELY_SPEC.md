# Provenrely — spec

## Design conventions

### Landing layout (desktop, lg+)
- Every section is a `Split` (`components/landing/split.tsx`): content left and right of an empty centre column
  (`--cmp-col`, 420px). The section's `data-morph` names the companion scene the logo becomes there.
- Every desktop row has content on both sides.
- Wide pieces (console preview, verify demo, architecture diagram) sit in a side column via `FitWidth`
  (`components/ui/fit-width.tsx`), which scales only at lg+. Below lg the sides stack.
- Scroll snapping: every `[data-morph]` section is a mandatory stop (`html.cmp-snap`, `scroll-snap-stop: always`;
  the hero snaps to its top). The CTA is the last stop; past it `html.cmp-free` turns snapping off so the footer
  scrolls freely.
- Never wrap a snap stop in `overflow: hidden` (a scroll container swallows its snap point) — use `overflow-clip`.
- Navbar is logo-only; an "Open console" button appears after scrolling past the hero.
- Background: the still marble photograph (`public/environment/marble-still.webp`), same as the console, with the
  console's light monochrome tokens (`.console-theme`). No starfield, no grid anywhere.

### Companion animation (logo scenes)
- Scenes are SVG strings (480 × 600) split into `.sc-base` / `.sc-main` / `.sc-aux` (+ `.sc-beam`, `.sc-pop`,
  `.sc-decode`). In each change the outgoing `.sc-main` travels into the incoming one's place while that grows out of
  it; beams draw, hashes decode.
- One paused GSAP timeline, one unit per change. Transitions are timed, not scrubbed: when the nearest stop changes,
  the playhead glides there over `STEP_S` (1.45s); jumps of 3+ stops show only the last change. Rebuilt on resize.
- Section text (`[data-cmp-col]` columns and the hero copy) leaves and arrives on the same timeline as its scene; on
  desktop, `Reveal` inside those columns is neutralised by CSS.
- Centre boxes and marks by layout (inset + auto margins), never by CSS `translate` — GSAP owns centring via
  `xPercent` / `yPercent` and clears the CSS `translate`.
- GSAP animates `.cmp-*` wrappers and scene SVG groups only — never an element carrying `.intro-content`,
  `.intro-fade` or `[data-intro-target]`.
- Mobile and reduced motion: no companion and no snap stops; the hero shows the static mark.

### Intro
- The boot script (`lib/intro-boot.ts`) stays a plain inline `<head>` script in `app/layout.tsx`
  (`next/script` `beforeInteractive` runs too late and the hero flashes).
- The intro waits for hydration and artwork decode, then starts on a clean frame. It plays over the marble still; the
  wordmark is live text from `PRODUCT_WORDMARK` (the artwork still carries the old name, so its letters aren't used).
- Hand-off timers use the running CSS animation's clock (`.ix-bgRad`), not wall time.
- Hand-off fades use the Web Animations API, not CSS transitions (finished CSS animations override transitions,
  which snapped elements and caused a blink).
- The hero image fades in fully before the halo is removed; then the real elements are revealed under the overlay and
  the overlay copy fades out. The hero mark stays still (no float/tilt) until the intro ends.
- Replay the intro with `/?intro=1` (otherwise it plays once per browser session).

### Console and documents
- Console layout: one frosted-glass shell; a white sidebar card running the full height of the page; content in
  bento cards (light, or near-black `Card variant="dark"`) with 20px gaps. Side columns use `.bento-col` and the
  page's last block grows, so columns and the sidebar end level. Kit: `components/console/kit.tsx`.
- Console text sizes are +1px over the base scale, for projector legibility.
- Document pages (certificates) are light by default with a dark toggle, and print-ready.
