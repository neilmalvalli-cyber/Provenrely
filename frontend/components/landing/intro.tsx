"use client";

import { useEffect, useRef, useState } from "react";
import { INTRO_SEEN_KEY } from "@/lib/intro-boot";
import "./intro.css";

/* Timeline (ms) — scenes 1–5 are CSS; these drive the hand-off. */
const T_HANDOFF = 3600;
const T_FINISH = 4800; // flight ends 4600; bloom fully gone by 4800
const FLIGHT_MS = 1000;
const EXIT_MS = 320; // skip fade
const SETTLE_MS = 260; // overlay copy fades out over the (identical) real elements

/* Where the symbol and wordmark sit inside the 1254×1254 artwork
   (must match the crops in scripts/extract-brand.mjs). */
const ART = 1254;
const MARK_BOX = { x: 339, y: 120, w: 585, h: 830 };
const WORD_BOX = { x: 164, y: 956, w: 917, h: 100 };
const pct = (b: typeof MARK_BOX) => ({
  left: `${(b.x / ART) * 100}%`,
  top: `${(b.y / ART) * 100}%`,
  width: `${(b.w / ART) * 100}%`,
  height: `${(b.h / ART) * 100}%`,
});

const NODES: [number, number][] = [
  [110, 190], [250, 330], [150, 520], [300, 690], [90, 800], [470, 150], [560, 800],
  [900, 810], [1120, 720], [1330, 800], [1260, 540], [1170, 330], [1330, 170], [980, 140],
];
const PARTICLES: [string, number, number][] = [
  ["v2", -160, 150], ["v3", -90, 640], ["v1", 180, 120], ["v2", 380, 250], ["v3", 640, 90], ["v1", 820, 180],
  ["v2", 1250, 110], ["v3", 1390, 420], ["v1", 1040, 480], ["v2", 1210, 860], ["v3", 760, 860], ["v1", 420, 560],
  ["v2", 60, 420], ["v3", 960, 610], ["v1", 1560, 230], ["v2", 1600, 700],
];
const ATTRACT: [number, number, number, number, number][] = [
  [520, 300, 0.4, 170, 82], [900, 280, 0.44, -153, 99], [560, 520, 0.47, 136, -105], [880, 530, 0.42, -136, -113],
  [440, 410, 0.5, 238, -11], [1000, 400, 0.46, -238, -3], [700, 220, 0.52, 17, 150], [740, 600, 0.49, -17, -173],
];
const FLASHES: [number, number, number][] = [
  [150, 520, 0.46], [250, 330, 0.6], [1330, 170, 0.54], [1170, 330, 0.66], [560, 800, 0.52], [980, 140, 0.56], [1260, 540, 0.62], [110, 190, 0.5],
];
const FLOWS = ["M560 800L720 397", "M980 140L720 397", "M1260 540L720 397", "M110 190L720 397"];
const FACETS = ["cUL", "cUR", "cML", "cMR", "cLL", "cLR"];
const EDGES: [string, number][] = [
  ["M405 302L625 168L625 432L405 548Z", 1.1],
  ["M625 168L857 300L625 432Z", 1.19],
  ["M405 548L577 458L577 655Z", 1.28],
  ["M680 425L852 530L680 626Z", 1.36],
  ["M400 785L625 657L625 912Z", 1.44],
  ["M625 657L852 529L852 785L625 912Z", 1.5],
];
const LETTERS = ["lS", "lO", "lL", "lI1", "lD", "lI2", "lT", "lY"];

export function LogoIntro() {
  const [mounted, setMounted] = useState(true);
  const overlay = useRef<HTMLDivElement>(null);
  const sym = useRef<HTMLDivElement>(null);
  const symRef = useRef<HTMLDivElement>(null);
  const landingMark = useRef<HTMLImageElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const scale = useRef(1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const html = document.documentElement;
    if (html.getAttribute("data-intro") !== "playing") {
      setMounted(false);
      return;
    }

    const fit = () => {
      const s = Math.min(window.innerHeight / 900, window.innerWidth / 760, 1.2);
      scale.current = s;
      html.style.setProperty("--ix-s", String(s));
    };
    fit();
    window.addEventListener("resize", fit);

    /** Fly `el` so that its reference box lands exactly on `selector`'s element; returns the scale. */
    const fly = (el: HTMLElement | null, ref: HTMLElement | null, selector: string): number | null => {
      if (!el || !ref) return null;
      const target = document.querySelector(selector);
      const t = target?.getBoundingClientRect();
      if (!t || t.height === 0 || t.bottom < 0 || t.top > window.innerHeight) {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: "forwards", easing: "ease-out" });
        return null;
      }
      const r = ref.getBoundingClientRect();
      const s = scale.current;
      const k = t.height / r.height;
      const dx = (t.left + t.width / 2 - (r.left + r.width / 2)) / s;
      const dy = (t.top + t.height / 2 - (r.top + r.height / 2)) / s;
      el.style.transformOrigin = `${ref.offsetLeft + ref.offsetWidth / 2}px ${ref.offsetTop + ref.offsetHeight / 2}px`;
      el.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], {
        duration: FLIGHT_MS,
        easing: "cubic-bezier(.65,0,.25,1)",
        fill: "forwards",
      });
      return s * k;
    };

    /**
     * Normal end: the flown copies sit exactly on their targets. Reveal the real elements
     * underneath first, then fade the copies out on top — the page is never less than fully
     * visible, so there is no blink. Skip: nothing is aligned yet, so just fade the overlay.
     */
    const finish = (skipped = false) => {
      timers.current.forEach(clearTimeout);
      html.setAttribute("data-intro", "done");
      try {
        sessionStorage.setItem(INTRO_SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
      if (!skipped) {
        overlay.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SETTLE_MS, fill: "forwards", easing: "linear" });
        timers.current = [window.setTimeout(() => setMounted(false), SETTLE_MS + 20)];
        return;
      }
      overlay.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, fill: "forwards", easing: "ease-out" });
      timers.current = [window.setTimeout(() => setMounted(false), EXIT_MS + 20)];
    };

    // Start on a clean frame once hydration is done and the artwork is decoded (see intro.css).
    // Timers are scheduled against the running CSS animation's own clock, so the hand-off
    // lands exactly on the CSS timeline even if the failsafe started it first.
    const clock = () => overlay.current?.querySelector(".ix-bgRad")?.getAnimations()[0];
    const elapsed = () => {
      const a = clock();
      if (a?.startTime != null) return performance.now() - Number(a.startTime);
      if (a?.currentTime != null) return Number(a.currentTime);
      return 0;
    };
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, Math.max(0, ms - elapsed())));

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      overlay.current?.classList.add("ix-run");
      // Every page-level change happens in this one frame, while the flight is at its slowest,
      // so no style recalculation interrupts the motion mid-flight.
      at(T_HANDOFF, () => {
        const scaleToTarget = fly(sym.current, symRef.current, '[data-intro-target="hero-mark"]');
        fly(word.current, wordRef.current, '[data-intro-target="nav-wordmark"]');
        // give the flying mark the hero image's own drop-shadow (in its local units) so
        // nothing about its look changes at the swap
        if (scaleToTarget && landingMark.current) {
          const u = 1 / scaleToTarget;
          landingMark.current.style.filter = `drop-shadow(0 ${30 * u}px ${60 * u}px rgba(76,50,190,0.45))`;
        }
        const ov = overlay.current;
        if (ov) {
          // Script animations sit above the CSS ones in the cascade, so these really fade.
          ov.querySelectorAll<HTMLElement>(".ix-bg, .ix-net, .ix-ptw").forEach((el) =>
            el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: 800, easing: "ease-out", fill: "forwards" }),
          );
          // Hero image fades in fully on top of the halo, and only then is the halo removed.
          landingMark.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out", fill: "forwards" });
          ov.querySelector<HTMLElement>(".ix-halo")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: 220, fill: "forwards" });
          ov.classList.add("ix-handoff");
        }
        html.setAttribute("data-intro", "revealing");
      });
      at(T_FINISH, () => finish());
    };
    const nextFrame = () => {
      // double rAF = after the browser has painted the hydrated page; timeout covers hidden tabs
      requestAnimationFrame(() => requestAnimationFrame(start));
      window.setTimeout(start, 150);
    };
    const art = new Image();
    art.src = "/brand/intro-logo.webp";
    Promise.race([art.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 800))]).then(nextFrame);

    const onSkip = () => finish(true);
    overlay.current?.addEventListener("ix-skip", onSkip);
    return () => {
      window.removeEventListener("resize", fit);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div ref={overlay} className="ix-overlay">
      <div className="ix-bg ix-solid" aria-hidden />
      <div className="ix-bg ix-bgRad" aria-hidden />
      <div className="ix-bg ix-amb" aria-hidden />

      <div className="ix-box" aria-hidden>
        <svg className="ix-net" viewBox="0 0 1440 900">
          <g className="ix-nodes">
            {NODES.map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle className="ix-nh" cx={x} cy={y} r="7" />
                <circle className="ix-nd" cx={x} cy={y} r="2" />
              </g>
            ))}
          </g>
        </svg>

        <div className="ix-full ix-ptw">
          {PARTICLES.map(([v, x, y], i) => (
            <div key={i} className={`ix-pt ix-${v}`} style={{ left: x, top: y }} />
          ))}
        </div>

        <svg className="ix-energy" viewBox="0 0 1440 900">
          <path className="ix-eb" pathLength={100} style={{ animationDelay: ".35s" }} d="M-30 520L150 520L250 330L720 397" />
          <path className="ix-ec" pathLength={100} style={{ animationDelay: ".35s" }} d="M-30 520L150 520L250 330L720 397" />
          <path className="ix-eb" pathLength={100} style={{ animationDelay: ".44s" }} d="M1470 170L1330 170L1170 330L720 397" />
          <path className="ix-ec ix-ec2" pathLength={100} style={{ animationDelay: ".44s" }} d="M1470 170L1330 170L1170 330L720 397" />
          <g className="ix-efg">
            {FLOWS.map((d) => (
              <g key={d}>
                <path className="ix-ef" d={d} />
                <path className="ix-ed" pathLength={100} d={d} />
              </g>
            ))}
          </g>
          {FLASHES.map(([x, y, delay]) => (
            <circle key={`${x}-${y}`} className="ix-nf" style={{ animationDelay: `${delay}s` }} cx={x} cy={y} r="3" />
          ))}
        </svg>

        {ATTRACT.map(([x, y, delay, tx, ty], i) => (
          <div
            key={i}
            className="ix-at"
            style={{ left: x, top: y, animationDelay: `${delay}s`, ["--tx" as string]: `${tx}px`, ["--ty" as string]: `${ty}px` }}
          />
        ))}

        <div className="ix-cring ix-cr1" />
        <div className="ix-cring ix-cr2" />
        <div className="ix-core" />
        <div className="ix-lglow" />
        <div className="ix-bloom" />
        <div className="ix-pring" />

        <div className="ix-stage">
          <div className="ix-fhaze" />
          <div className="ix-fline" />
          <div className="ix-fspark" />

          <div ref={sym} className="ix-symw">
            <div className="ix-floaty">
              <div className="ix-lg ix-halo" />
              {FACETS.map((f) => (
                <div key={f} className={`ix-lg ix-pc ix-${f}`} />
              ))}
              <div className="ix-sweep">
                <div className="ix-band" />
              </div>
              <svg className="ix-edges" viewBox="0 0 1254 1254">
                <defs>
                  <linearGradient id="ix-egr" gradientUnits="userSpaceOnUse" x1="400" y1="168" x2="860" y2="912">
                    <stop offset="0" stopColor="#4f8dff" />
                    <stop offset="0.5" stopColor="#8466ff" />
                    <stop offset="1" stopColor="#d85cff" />
                  </linearGradient>
                </defs>
                {EDGES.map(([d, delay]) => (
                  <path key={d} className="ix-ee" pathLength={100} style={{ animationDelay: `${delay}s` }} d={d} />
                ))}
              </svg>
            </div>
            {/* At hand-off the flying symbol becomes the hero's own image, so it lands pixel-identical. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={landingMark} src="/brand/mark-640.webp" alt="" className="ix-landing-mark" style={pct(MARK_BOX)} />
            <div ref={symRef} className="pointer-events-none absolute" style={pct(MARK_BOX)} />
          </div>

          <div ref={word} className="ix-wmw">
            {LETTERS.map((l) => (
              <div key={l} className={`ix-lg ix-lt ix-${l}`} />
            ))}
            <div ref={wordRef} className="pointer-events-none absolute" style={pct(WORD_BOX)} />
          </div>

          <div className="ix-st">
            <svg className="ix-ic" width="12" height="12" viewBox="0 0 12 12">
              <path d="M6 1l4.3 2.5v5L6 11 1.7 8.5v-5z" />
              <path d="M4 6.1l1.4 1.4L8.2 4.7" />
            </svg>
            <span>SIGNATURE VALID</span>
          </div>
        </div>
      </div>

      <div className="ix-bg ix-vig" aria-hidden />

      <button
        type="button"
        className="ix-skip"
        onClick={() => overlay.current?.dispatchEvent(new Event("ix-skip"))}
      >
        SKIP INTRO
      </button>
    </div>
  );
}
