import gsap from "gsap";

const HEX = "0123456789abcdef";
/** One change takes this long, whatever the scroll speed: unhurried, never scrubbed to the snap. */
const STEP_S = 1.45;

type Part = {
  root: Element;
  main: Element;
  base: Element[];
  aux: Element[];
  beams: Element[];
  pops: Element[];
  decode: SVGTextElement[];
  /** centre and size of the main object, in scene units (480 × 600) */
  box: { x: number; y: number; w: number; h: number };
};

const bbox = (el: SVGGraphicsElement) => {
  const b = el.getBBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
};

/**
 * The page-long companion. Each section (`[data-morph]`) is a stop; the scenes live on one
 * paused timeline, one unit per change. When a new section becomes the stop, the playhead
 * glides to it over STEP_S — so every change plays at the same calm pace, forwards or back.
 *
 * In every change one piece of glass carries across: the outgoing scene's main object travels
 * into the incoming one's place while that grows out of it; old details drift away, the new
 * base settles, then details, beams and badges build in.
 */
export function buildCompanion(layer: HTMLElement) {
  const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-morph]"));
  if (sections.length < 2) return () => {};
  const html = document.documentElement;
  const q = gsap.utils.selector(layer);
  const box = q(".cmp-box")[0] as HTMLElement;
  const mark = q(".cmp-mark")[0] as HTMLElement;
  const spin = q(".cmp-mark-spin")[0] as HTMLElement;
  const drift = q(".cmp-drift")[0] as HTMLElement;

  // Lift the mark out of the hero into a fixed layer without moving it by a pixel.
  const cell = layer.parentElement!.getBoundingClientRect();
  layer.classList.add("is-fixed");
  const dx = cell.left + cell.width / 2 - html.clientWidth / 2; // the fixed layer excludes the scrollbar
  const dy = cell.top + cell.height / 2 - html.clientHeight / 2 + window.scrollY;
  // (both are centred by layout, so their transforms start empty)
  gsap.set(box, { x: dx, y: dy });
  gsap.set(mark, { transformPerspective: 900, transformOrigin: "50% 50%" });

  // The box is 480 × 600 scene units; the mark sits centred in it.
  const unit = box.offsetWidth / 480;
  const markBox = { x: 240, y: 300, w: mark.offsetWidth / unit, h: mark.offsetHeight / unit };

  const scene = (key: string): Part | null => {
    if (key === "mark") return { root: mark, main: mark, base: [], aux: q(".cmp-deco"), beams: [], pops: [], decode: [], box: markBox };
    const root = layer.querySelector<SVGSVGElement>(`.cmp-scene[data-scene="${key}"]`);
    if (!root) return null;
    const main = root.querySelector<SVGGElement>(".sc-main")!;
    return {
      root,
      main,
      base: Array.from(root.querySelectorAll(".sc-base")),
      aux: Array.from(root.querySelectorAll(".sc-aux")),
      beams: Array.from(root.querySelectorAll(".sc-beam")),
      pops: Array.from(root.querySelectorAll(".sc-pop")),
      decode: Array.from(root.querySelectorAll<SVGTextElement>(".sc-decode")),
      box: bbox(main),
    };
  };

  const tl = gsap.timeline({ paused: true, defaults: { ease: "sine.inOut" } });

  /** Base, details, beams, badges and hashes of an incoming scene, from `k` (0–1) into its change. */
  const buildIn = (B: Part, at: (k: number) => number, k: number) => {
    tl.fromTo(B.base, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, at(k));
    tl.fromTo(B.aux, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }, at(k + 0.2));
    if (B.beams.length) tl.fromTo(B.beams, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.35, stagger: 0.03 }, at(k + 0.25));
    if (B.pops.length)
      tl.fromTo(B.pops, { scale: 0.5, transformOrigin: "50% 50%", autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.25, ease: "back.out(1.7)" }, at(k + 0.4));
    for (const el of B.decode) {
      const final = el.textContent ?? "";
      const p = { v: 0 };
      tl.to(
        p,
        {
          v: 1,
          duration: 0.35,
          ease: "none",
          onUpdate: () => {
            const keep = Math.floor(p.v * final.length);
            let s = final.slice(0, keep);
            for (let n = keep; n < final.length; n++) s += final[n] === "…" ? "…" : HEX[(n * 7 + Math.floor(p.v * 40)) % 16];
            el.textContent = s;
          },
        },
        at(k + 0.3),
      );
    }
  };

  for (let i = 1; i < sections.length; i++) {
    const A = scene(sections[i - 1].dataset.morph ?? "mark");
    const B = scene(sections[i].dataset.morph ?? "mark");
    if (!A || !B) continue;
    const at = (k: number) => i - 1 + k;

    /* ---- the section text leaves and arrives with its scene, on the same clock ---- */
    const textOut = sections[i - 1].querySelectorAll("[data-cmp-col]");
    const textIn = sections[i].querySelectorAll("[data-cmp-col]");
    tl.to(textOut, { autoAlpha: 0, y: -22, duration: 0.42, stagger: 0.04, ease: "sine.in" }, at(0.02));
    tl.fromTo(textIn, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "sine.out" }, at(0.32));

    /* ---- out: details drift away first, the base settles out under them ---- */
    tl.to(A.aux, { autoAlpha: 0, y: -12, duration: 0.35, stagger: 0.04 }, at(0));
    tl.to(A.base, { autoAlpha: 0, duration: 0.35 }, at(0.08));

    const top = B.main !== mark ? B.root.querySelector<SVGGElement>(".sc-top") : null;
    if (A.main === mark && top) {
      /*
       * The first change, one continuous gesture: the S glides to the centre and lies down in
       * true isometric perspective (rotateX 54.7° over a 45° turn in its own plane) exactly onto
       * the top layer, where the same S is printed. The layers below then unfold downward out of
       * it, like a deck spreading open, and the base settles last.
       */
      const topY = 155; // centre of the top layer's face (scenes.ts: cy 452 − z 297)
      const flat = (130 / markBox.h) * 1.2247; // S printed 130 units tall; isometric foreshortening
      const layers = Array.from(B.root.querySelectorAll<SVGGElement>(".sc-layer")).reverse(); // top-down
      const drop = [92, 184, 273]; // how far each lower layer sits beneath the top one
      tl.to(box, { x: 0, y: 0, duration: 0.72, ease: "power2.inOut" }, at(0));
      tl.to(mark, { y: (topY - 300) * unit, scale: flat, rotationX: 54.7356, transformPerspective: 4000, duration: 0.62, ease: "power2.inOut" }, at(0.06));
      tl.to(spin, { rotation: 45, duration: 0.62, ease: "power2.inOut" }, at(0.06));
      tl.set(B.root, { autoAlpha: 1 }, at(0.5));
      tl.fromTo(top, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, ease: "none" }, at(0.62));
      tl.to(mark, { autoAlpha: 0, duration: 0.08, ease: "none" }, at(0.7));
      tl.fromTo(layers, { autoAlpha: 0, y: (k: number) => -drop[k] }, { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.05, ease: "power2.out" }, at(0.66));
      buildIn(B, at, 0.74);
      continue;
    }

    // the carried object: from A's main to B's main
    const mx = B.box.x - A.box.x;
    const my = B.box.y - A.box.y;
    const ms = gsap.utils.clamp(0.45, 1.8, Math.min(B.box.w / A.box.w, B.box.h / A.box.h));

    if (A.main === mark) {
      tl.to(mark, { rotationX: 50, x: mx * unit, y: my * unit, scale: ms, autoAlpha: 0, duration: 0.65 }, at(0.1));
    } else {
      tl.to(A.main, { x: mx, y: my, scale: ms, transformOrigin: "50% 50%", autoAlpha: 0, duration: 0.6 }, at(0.12));
      tl.set(A.root, { autoAlpha: 0 }, at(1));
    }

    if (B.main === mark) {
      // home: the S rises back upright out of the last scene
      tl.fromTo(spin, { rotation: 0 }, { rotation: 0, duration: 0.01, immediateRender: false }, at(0.3));
      tl.fromTo(
        mark,
        { rotationX: 50, x: -mx * unit, y: -my * unit, scale: 1 / ms, autoAlpha: 0 },
        { rotationX: 0, x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.7, immediateRender: false },
        at(0.3),
      );
      tl.fromTo(B.aux, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, immediateRender: false }, at(0.65));
    } else {
      // each scene appears once, so its starting state is applied now (the mark appears twice: not so)
      tl.set(B.root, { autoAlpha: 1 }, at(0));
      tl.fromTo(B.main, { x: -mx, y: -my, scale: 1 / ms, transformOrigin: "50% 50%", autoAlpha: 0 }, { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.62 }, at(0.28));
      buildIn(B, at, 0.4);
    }
  }
  const last = sections.length - 1;
  tl.set({}, {}, last);

  /* ---- which stop are we at? glide the playhead there ---- */
  const centreOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
  };
  const centres = sections.map((s, i) => (i === 0 ? 0 : centreOf(s)));
  const nearest = (y: number) => centres.reduce((best, c, i) => (Math.abs(c - y) < Math.abs(centres[best] - y) ? i : best), 0);

  let index = nearest(window.scrollY);
  tl.time(index);
  let glide: gsap.core.Tween | null = null;
  const goTo = (i: number) => {
    if (i === index) return;
    const steps = Math.abs(i - index);
    // the first change (hero ↔ console) gets a little more time; jumps of 3+ stops play only the last change
    const first = Math.min(i, index) === 0 && Math.max(i, index) === 1;
    glide?.kill();
    if (steps > 2) tl.time(i > index ? i - 1 : i + 1);
    index = i;
    glide = gsap.to(tl, { time: i, duration: STEP_S * (steps === 2 ? 1.4 : first ? 1.25 : 1), ease: "power1.inOut" });
  };


  // after the last stop the page scrolls freely to the footer, and the mark leaves with its section
  const lastStop = centres[last];
  const onScroll = () => {
    const y = window.scrollY;
    goTo(nearest(Math.min(y, lastStop)));
    // no stops past the final one (the footer); they return as soon as you scroll back above it
    html.classList.toggle("cmp-free", y > lastStop - 60);
    gsap.set(drift, { y: -Math.max(0, y - lastStop) });
  };
  // straight from the scroll event (at most once a frame), so the leaving mark moves in step with the page
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  return () => {
    window.removeEventListener("scroll", onScroll);
    glide?.kill();
    tl.progress(0).kill();
    html.classList.remove("cmp-free");
    layer.classList.remove("is-fixed");
    gsap.set([box, mark, spin, drift], { clearProps: "transform" });
  };
}
