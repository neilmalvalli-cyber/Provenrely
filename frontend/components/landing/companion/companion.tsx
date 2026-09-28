"use client";

import { useEffect, useRef, useState } from "react";
import { getCase } from "@/data/cases";
import { formatNumber, shortHash } from "@/lib/utils";
import { SCENE_H, SCENE_KEYS, SCENE_W, SCENES, type SceneData } from "./scenes";
import "./companion.css";

const MARK_SRC = "/brand/mark-640.webp";
const CASE = getCase("PR-8842")!;
const DATA: SceneData = { leafHash: shortHash(CASE.evidence.proofHash, 10, 6), block: formatNumber(CASE.evidence.blockHeight) };
const MARKUP = Object.fromEntries(SCENE_KEYS.map((k) => [k, SCENES[k](`cmp-${k}`, DATA)]));

/**
 * The Solidity mark and the page-long companion it becomes. At rest it is exactly the hero
 * image the intro lands on. On desktop, once the page has loaded, timeline.ts lifts it into a
 * fixed layer, brings it to the centre column, and turns it into each section's glass scene.
 */
export function Companion() {
  const layer = useRef<HTMLDivElement>(null);
  const live = useIntroLanded();

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    const html = document.documentElement;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    let timer = 0;
    const build = () => {
      dispose?.();
      dispose = undefined;
      html.classList.toggle("cmp-snap", mq.matches);
      if (!mq.matches) return;
      import("./timeline").then(({ buildCompanion }) => {
        if (!cancelled && mq.matches) dispose = buildCompanion(el);
      });
    };
    // positions depend on the final layout: build once everything has loaded, and after resizes
    const start = () => (timer = window.setTimeout(build, 60));
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(build, 250);
    };
    window.addEventListener("resize", onResize);
    mq.addEventListener("change", build);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("load", start);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", build);
      html.classList.remove("cmp-snap");
      dispose?.();
    };
  }, []);

  return (
    <div ref={layer} className="cmp-layer" data-live={live}>
      <div className="cmp-drift">
      <div className="cmp-box">
        <div className="sh-float">
          <div className="intro-fade absolute inset-0">
            <div className="sh-halo" aria-hidden />
          </div>

          {/* the mark, with its hero-only orbit and reflection */}
          <div className="cmp-mark">
            <div className="cmp-mark-spin">
              <div className="intro-fade pointer-events-none absolute inset-0">
                <div className="cmp-deco absolute inset-0">
                  <svg viewBox="0 0 451 640" className="sh-orbit" aria-hidden>
                    <defs>
                      <linearGradient id="sh-orbit-g" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#fff" stopOpacity="0" />
                        <stop offset="0.5" stopColor="#c4b5fd" stopOpacity="0.38" />
                        <stop offset="1" stopColor="#fff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path id="sh-orbit-p" d="M-114,410 a340,104 0 1,0 680,0 a340,104 0 1,0 -680,0" fill="none" stroke="url(#sh-orbit-g)" strokeWidth="1.4" />
                    <ellipse cx="225.5" cy="410" rx="250" ry="76" fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 8" />
                    <circle r="4" fill="#ddd6fe" className="sh-orbit-dot">
                      <animateMotion dur="11s" repeatCount="indefinite">
                        <mpath href="#sh-orbit-p" />
                      </animateMotion>
                    </circle>
                  </svg>
                  <div className="sh-reflect" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={MARK_SRC} alt="" className="size-full" draggable={false} />
                  </div>
                </div>
              </div>
              {/* the hero image — the intro's landing target, pixel-identical at rest */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={MARK_SRC}
                width={451}
                height={640}
                alt="Solidity"
                draggable={false}
                fetchPriority="high"
                data-intro-target="hero-mark"
                className="relative size-full drop-shadow-[0_30px_60px_rgba(76,50,190,0.45)]"
              />
              <div className="intro-fade absolute inset-0">
                <div className="sh-sweep" aria-hidden />
              </div>
            </div>
          </div>

          {/* the scenes it becomes, one per section (hidden until the timeline brings one in) */}
          <div className="cmp-scenes" aria-hidden>
            {SCENE_KEYS.map((k) => (
              <svg
                key={k}
                className="cmp-scene"
                data-scene={k}
                viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
                dangerouslySetInnerHTML={{ __html: MARKUP[k] }}
              />
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/** True once the landing intro (if any) has handed off — until then the mark must stay perfectly still. */
function useIntroLanded() {
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
        // let the intro's overlay copy finish fading out on top before anything moves
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
  return live;
}
