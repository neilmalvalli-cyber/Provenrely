/**
 * The glass scenes the Solidity mark becomes beside each landing section (approved in the
 * "Solidity — Logo Scenes" design canvas). Each scene is SVG in a 480 × 600 viewBox, split
 * into three groups the page animates:
 *   .sc-base  — floor, pedestal, rings: settles in first
 *   .sc-main  — the one glass object that carries the transition
 *   .sc-aux   — tiles, beams (.sc-beam, drawn along their path), chips, particles
 * Plain strings, no dependencies: the design canvas renders the very same markup.
 */

export const SCENE_W = 480;
export const SCENE_H = 600;

type P3 = (u: number, v: number, z: number) => [number, number];
const C30 = Math.cos(Math.PI / 6);
const f = (n: number) => (Math.round(n * 10) / 10).toString();
const pts = (arr: [number, number][]) => arr.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");

/** Isometric projector centred at (cx, cy): u runs right-down, v left-down, z up. */
const iso =
  (cx: number, cy: number, k = 1): P3 =>
  (u, v, z) => [cx + (u - v) * C30 * k, cy + (u + v) * 0.5 * k - z * k];

function defs(id: string) {
  return `<defs>
  <linearGradient id="${id}Top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9a6ff" stop-opacity="0.46"/><stop offset="1" stop-color="#4f36c9" stop-opacity="0.16"/></linearGradient>
  <linearGradient id="${id}L" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b8def" stop-opacity="0.5"/><stop offset="1" stop-color="#2b2a8f" stop-opacity="0.22"/></linearGradient>
  <linearGradient id="${id}R" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a74ff" stop-opacity="0.5"/><stop offset="1" stop-color="#3a1f9a" stop-opacity="0.24"/></linearGradient>
  <linearGradient id="${id}Card" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#a996ff" stop-opacity="0.34"/><stop offset="0.55" stop-color="#5a44d8" stop-opacity="0.14"/><stop offset="1" stop-color="#2a1f7a" stop-opacity="0.2"/></linearGradient>
  <linearGradient id="${id}Edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eee8ff"/><stop offset="0.5" stop-color="#b8a4ff"/><stop offset="1" stop-color="#6d8dff"/></linearGradient>
  <linearGradient id="${id}BeamV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc" stop-opacity="0.15"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0.95"/></linearGradient>
  <linearGradient id="${id}Beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d8dff" stop-opacity="0.15"/><stop offset="0.5" stop-color="#a78bfa" stop-opacity="0.9"/><stop offset="1" stop-color="#7dd3fc" stop-opacity="0.9"/></linearGradient>
  <radialGradient id="${id}Floor"><stop offset="0" stop-color="#7c5cfa" stop-opacity="0.55"/><stop offset="0.6" stop-color="#4b2fd0" stop-opacity="0.15"/><stop offset="1" stop-color="#4b2fd0" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}Badge" cx="0.35" cy="0.3"><stop offset="0" stop-color="#6f7cff"/><stop offset="1" stop-color="#2a1d8f"/></radialGradient>
  <filter id="${id}Glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;
}

/* ---------- glyphs, drawn in local units around (x, y) ---------- */
const ST = 'fill="none" stroke="#dcd3ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const g = {
  image: (x: number, y: number, s: number) =>
    `<g ${ST}><rect x="${f(x - s / 2)}" y="${f(y - s * 0.38)}" width="${f(s)}" height="${f(s * 0.76)}" rx="${f(s * 0.1)}"/><path d="M${f(x - s * 0.4)},${f(y + s * 0.26)} L${f(x - s * 0.1)},${f(y - s * 0.06)} L${f(x + s * 0.1)},${f(y + s * 0.12)} L${f(x + s * 0.22)},${f(y + s * 0.02)} L${f(x + s * 0.42)},${f(y + s * 0.26)}"/><circle cx="${f(x + s * 0.2)}" cy="${f(y - s * 0.16)}" r="${f(s * 0.07)}"/></g>`,
  lines: (x: number, y: number, w: number, n = 3, gap = 9, op = 0.55) =>
    Array.from({ length: n }, (_, i) => `<line x1="${f(x)}" y1="${f(y + i * gap)}" x2="${f(x + (i === n - 1 ? w * 0.6 : w))}" y2="${f(y + i * gap)}" stroke="#cfc6ff" stroke-opacity="${op}" stroke-width="3" stroke-linecap="round"/>`).join(""),
  bars: (x: number, y: number, w: number, h: number) =>
    [0.45, 0.8, 0.6, 1, 0.7].map((k, i) => `<rect x="${f(x + i * (w / 5))}" y="${f(y + h * (1 - k))}" width="${f(w / 5 - 4)}" height="${f(h * k)}" rx="1.5" fill="#cfc6ff" fill-opacity="0.6"/>`).join(""),
  table: (x: number, y: number, s: number) =>
    `<g ${ST}><rect x="${f(x - s / 2)}" y="${f(y - s * 0.4)}" width="${f(s)}" height="${f(s * 0.8)}" rx="3"/><line x1="${f(x - s / 2)}" y1="${f(y - s * 0.13)}" x2="${f(x + s / 2)}" y2="${f(y - s * 0.13)}"/><line x1="${f(x - s / 2)}" y1="${f(y + s * 0.14)}" x2="${f(x + s / 2)}" y2="${f(y + s * 0.14)}"/><line x1="${f(x - s * 0.1)}" y1="${f(y - s * 0.4)}" x2="${f(x - s * 0.1)}" y2="${f(y + s * 0.4)}"/></g>`,
  code: (x: number, y: number, s: number) =>
    `<g ${ST}><path d="M${f(x - s * 0.22)},${f(y - s * 0.22)} L${f(x - s * 0.44)},${f(y)} L${f(x - s * 0.22)},${f(y + s * 0.22)}"/><path d="M${f(x + s * 0.22)},${f(y - s * 0.22)} L${f(x + s * 0.44)},${f(y)} L${f(x + s * 0.22)},${f(y + s * 0.22)}"/><path d="M${f(x + s * 0.08)},${f(y - s * 0.3)} L${f(x - s * 0.08)},${f(y + s * 0.3)}"/></g>`,
  doc: (x: number, y: number, s: number) =>
    `<g ${ST}><path d="M${f(x - s * 0.34)},${f(y - s * 0.45)} h${f(s * 0.46)} l${f(s * 0.22)},${f(s * 0.22)} v${f(s * 0.68)} h-${f(s * 0.68)} z"/><line x1="${f(x - s * 0.18)}" y1="${f(y)}" x2="${f(x + s * 0.18)}" y2="${f(y)}"/><line x1="${f(x - s * 0.18)}" y1="${f(y + s * 0.16)}" x2="${f(x + s * 0.18)}" y2="${f(y + s * 0.16)}"/></g>`,
  graph: (x: number, y: number, s: number) =>
    `<g ${ST}><circle cx="${f(x - s * 0.3)}" cy="${f(y + s * 0.2)}" r="${f(s * 0.09)}"/><circle cx="${f(x)}" cy="${f(y - s * 0.24)}" r="${f(s * 0.09)}"/><circle cx="${f(x + s * 0.32)}" cy="${f(y + s * 0.16)}" r="${f(s * 0.09)}"/><path d="M${f(x - s * 0.24)},${f(y + s * 0.13)} L${f(x - s * 0.06)},${f(y - s * 0.16)} M${f(x + s * 0.06)},${f(y - s * 0.16)} L${f(x + s * 0.26)},${f(y + s * 0.08)} M${f(x - s * 0.2)},${f(y + s * 0.2)} L${f(x + s * 0.22)},${f(y + s * 0.17)}"/></g>`,
  clip: (x: number, y: number, s: number) =>
    `<g ${ST}><path d="M${f(x + s * 0.28)},${f(y - s * 0.06)} l-${f(s * 0.36)},${f(s * 0.36)} a${f(s * 0.14)},${f(s * 0.14)} 0 0 1 -${f(s * 0.2)},-${f(s * 0.2)} l${f(s * 0.4)},-${f(s * 0.4)} a${f(s * 0.1)},${f(s * 0.1)} 0 0 1 ${f(s * 0.14)},${f(s * 0.14)} l-${f(s * 0.36)},${f(s * 0.36)}"/></g>`,
  cube: (x: number, y: number, s: number) =>
    `<g ${ST}><path d="M${f(x)},${f(y - s * 0.4)} L${f(x + s * 0.38)},${f(y - s * 0.2)} L${f(x + s * 0.38)},${f(y + s * 0.22)} L${f(x)},${f(y + s * 0.42)} L${f(x - s * 0.38)},${f(y + s * 0.22)} L${f(x - s * 0.38)},${f(y - s * 0.2)} Z M${f(x - s * 0.38)},${f(y - s * 0.2)} L${f(x)},${f(y)} L${f(x + s * 0.38)},${f(y - s * 0.2)} M${f(x)},${f(y)} L${f(x)},${f(y + s * 0.42)}"/></g>`,
  hash: (x: number, y: number, s: number, w = 2.4) =>
    `<g fill="none" stroke="#f3efff" stroke-width="${w}" stroke-linecap="round"><line x1="${f(x - s * 0.12)}" y1="${f(y - s * 0.42)}" x2="${f(x - s * 0.22)}" y2="${f(y + s * 0.42)}"/><line x1="${f(x + s * 0.22)}" y1="${f(y - s * 0.42)}" x2="${f(x + s * 0.12)}" y2="${f(y + s * 0.42)}"/><line x1="${f(x - s * 0.4)}" y1="${f(y - s * 0.14)}" x2="${f(x + s * 0.4)}" y2="${f(y - s * 0.14)}"/><line x1="${f(x - s * 0.44)}" y1="${f(y + s * 0.16)}" x2="${f(x + s * 0.36)}" y2="${f(y + s * 0.16)}"/></g>`,
  check: (x: number, y: number, s: number) =>
    `<path d="M${f(x - s * 0.3)},${f(y + s * 0.02)} L${f(x - s * 0.08)},${f(y + s * 0.24)} L${f(x + s * 0.32)},${f(y - s * 0.22)}" fill="none" stroke="#fff" stroke-width="${f(Math.max(2.4, s * 0.1))}" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: (x: number, y: number, s: number) =>
    `<g ${ST}><rect x="${f(x - s * 0.34)}" y="${f(y - s * 0.05)}" width="${f(s * 0.68)}" height="${f(s * 0.5)}" rx="${f(s * 0.08)}"/><path d="M${f(x - s * 0.2)},${f(y - s * 0.05)} v-${f(s * 0.14)} a${f(s * 0.2)},${f(s * 0.2)} 0 0 1 ${f(s * 0.4)},0 v${f(s * 0.14)}"/></g>`,
};

/* ---------- building blocks ---------- */

type SlabOpts = { cx: number; cy: number; w: number; d?: number; z?: number; t?: number; k?: number; bright?: number; content?: string; top?: string };

/** An isometric glass slab (a plate when thin, a cube when t = w); `content` is drawn on its top face in local units (±w/2). */
function slab(id: string, { cx, cy, w, d = w, z = 0, t = 8, k = 1, bright = 1, content = "", top }: SlabOpts) {
  const P = iso(cx, cy, k);
  const h = w / 2;
  const e = d / 2;
  const right = [P(h, -e, z), P(h, e, z), P(h, e, z + t), P(h, -e, z + t)];
  const left = [P(-h, e, z), P(h, e, z), P(h, e, z + t), P(-h, e, z + t)];
  const topF = [P(-h, -e, z + t), P(h, -e, z + t), P(h, e, z + t), P(-h, e, z + t)];
  const [ox, oy] = P(0, 0, z + t);
  const m = `matrix(${f(C30 * k)},${f(0.5 * k)},${f(-C30 * k)},${f(0.5 * k)},${f(ox)},${f(oy)})`;
  return `<g opacity="${bright}" filter="url(#${id}Glow)">
    <polygon points="${pts(right)}" fill="url(#${id}R)" stroke="url(#${id}Edge)" stroke-width="1.1" stroke-opacity="0.7"/>
    <polygon points="${pts(left)}" fill="url(#${id}L)" stroke="url(#${id}Edge)" stroke-width="1.1" stroke-opacity="0.7"/>
    <polygon points="${pts(topF)}" fill="${top ?? `url(#${id}Top)`}" stroke="url(#${id}Edge)" stroke-width="1.5"/>
    ${content ? `<g transform="${m}">${content}</g>` : ""}
  </g>`;
}

type CardOpts = { x: number; y: number; w: number; h: number; lean?: number; r?: number; body?: string; op?: number; dashed?: boolean };

/** An upright glass card, optionally leaning (deg). */
function card(id: string, { x, y, w, h, lean = 0, r = 12, body = "", op = 1, dashed = false }: CardOpts) {
  return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(lean)})" opacity="${op}" filter="url(#${id}Glow)">
    <rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="url(#${id}Card)" stroke="url(#${id}Edge)" stroke-width="1.6"${dashed ? ' stroke-dasharray="6 5"' : ""}/>
    <rect x="${f(-w / 2 + 1.5)}" y="${f(-h / 2 + 1.5)}" width="${f(w - 3)}" height="${f(h * 0.4)}" rx="${r - 1}" fill="#ffffff" fill-opacity="0.04"/>
    ${body}
  </g>`;
}

const floor = (id: string, x: number, y: number, rx: number, ry = rx * 0.22, op = 1) =>
  `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#${id}Floor)" opacity="${op}"/>`;
const beam = (id: string, d: string, op = 1, grad = "BeamV") =>
  `<path class="sc-beam" pathLength="1" d="${d}" fill="none" stroke="url(#${id}${grad})" stroke-width="1.8" stroke-linecap="round" opacity="${op}" filter="url(#${id}Glow)"/>`;
const dot = (x: number, y: number, r = 3.2, c = "#c4b5fd") => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${c}"/>`;
const mono = `font-family="var(--font-mono), ui-monospace, monospace"`;

function pedestal(id: string, x: number, y: number, rx: number) {
  return `<g>
    <ellipse cx="${x}" cy="${y + 22}" rx="${rx}" ry="${rx * 0.24}" fill="#0a0b16" stroke="#6d5bd8" stroke-opacity="0.35"/>
    <path d="M${x - rx},${y + 22} v-14 a${rx},${rx * 0.24} 0 0 1 ${rx * 2},0 v14" fill="#0c0d1c" stroke="#6d5bd8" stroke-opacity="0.3"/>
    <ellipse cx="${x}" cy="${y + 8}" rx="${rx}" ry="${rx * 0.24}" fill="#11122a" stroke="url(#${id}Edge)" stroke-opacity="0.8" filter="url(#${id}Glow)"/>
    <ellipse cx="${x}" cy="${y}" rx="${rx * 0.78}" ry="${rx * 0.18}" fill="#141539" stroke="#8b6cf8" stroke-opacity="0.7"/>
    <ellipse cx="${x}" cy="${y - 4}" rx="${rx * 0.56}" ry="${rx * 0.13}" fill="none" stroke="#c4b5fd" stroke-width="2" filter="url(#${id}Glow)"/>
    ${floor(id, x, y - 4, rx * 0.8, rx * 0.2, 0.9)}
  </g>`;
}

type Parts = { base?: string; main: string; aux?: string; auxBack?: string };
const svg = (id: string, { base = "", main, aux = "", auxBack = "" }: Parts) =>
  `${defs(id)}<g class="sc-base">${base}</g><g class="sc-aux sc-aux-back">${auxBack}</g><g class="sc-main">${main}</g><g class="sc-aux">${aux}</g>`;

/* ---------- the scenes ---------- */

export type SceneData = { leafHash: string; block: string };

/** The console — one workspace in layers: analysis, findings, evidence, on a base. */
function stack(id: string) {
  const cx = 240, cy = 452, w = 186;
  const P = iso(cx, cy);
  const layer = (z: number, content: string, b = 1, cls = "sc-layer") => `<g class="${cls}">${slab(id, { cx, cy, w, z, t: 7, content, bright: b })}</g>`;
  const corner = (z: number) => [P(-w / 2, w / 2, z), P(w / 2, -w / 2, z)];
  const [l0, r0] = corner(26);
  const [l3, r3] = corner(290);
  return svg(id, {
    base: `${floor(id, 240, 540, 190, 40)}<ellipse cx="240" cy="522" rx="220" ry="62" fill="none" stroke="#8b6cf8" stroke-opacity="0.22"/>
      <line x1="${f(l0[0])}" y1="${f(l0[1])}" x2="${f(l3[0])}" y2="${f(l3[1])}" stroke="#8b6cf8" stroke-opacity="0.25"/>
      <line x1="${f(r0[0])}" y1="${f(r0[1])}" x2="${f(r3[0])}" y2="${f(r3[1])}" stroke="#8b6cf8" stroke-opacity="0.25"/>`,
    // bottom to top, so layers can rise in order; the top layer is where the S comes to rest
    main: `<g class="sc-layer">${slab(id, { cx, cy, w, z: 0, t: 24, top: "#6c4df0" })}</g>
      ${layer(106, `${g.bars(-60, -18, 70, 44)}${g.lines(20, -14, 44, 3, 10)}`, 0.95)}
      ${layer(198, `${g.lines(-64, -30, 60, 4, 11)}${g.lines(8, -30, 56, 4, 11, 0.35)}`)}
      ${layer(290, `<image href="/brand/mark-640.webp" x="-46" y="-65" width="92" height="130"/>`, 1, "sc-top")}`,
    aux: `${dot(r3[0] - 4, r3[1] + 3, 3.4, "#ddd6fe")}
      ${beam(id, `M${f(r3[0])},${f(r3[1] + 3)} h40 v-18 h36`, 0.5, "Beam")}
      ${beam(id, `M${f(r3[0])},${f(r3[1] + 83)} h58`, 0.35, "Beam")}`,
  });
}

/** Verify — a document on a pedestal, sealed with a check, its sources orbiting. */
function doc(id: string) {
  const tiles = [
    { x: 78, y: 150, i: g.image },
    { x: 66, y: 256, i: g.code },
    { x: 404, y: 150, i: g.table },
    { x: 414, y: 262, i: g.doc },
  ];
  return svg(id, {
    base: `${pedestal(id, 240, 432, 178)}<path d="M50,322 a190,46 0 0 1 380,0" fill="none" stroke="#8b6cf8" stroke-opacity="0.3" stroke-width="9"/>`,
    auxBack: tiles
      .map((t) => {
        const tx = t.x < 240 ? 168 : 312;
        return `${beam(id, `M${t.x + (t.x < 240 ? 26 : -26)},${t.y} C${(t.x + tx) / 2},${t.y} ${(t.x + tx) / 2},${t.y + 40} ${tx},${t.y + 40}`, 0.7, "Beam")}${dot(tx, t.y + 40, 2.8)}
          ${card(id, { x: t.x, y: t.y, w: 52, h: 46, r: 9, body: t.i(0, 0, 22) })}`;
      })
      .join(""),
    main: `${card(id, { x: 232, y: 262, w: 168, h: 222, lean: -7, r: 14, body: `${g.image(-38, -66, 40)}${g.lines(4, -80, 46, 3, 11)}${g.lines(-58, -16, 116, 5, 14)}` })}`,
    aux: `<path d="M50,322 a190,46 0 0 0 380,0" fill="none" stroke="#a78bfa" stroke-opacity="0.5" stroke-width="9"/>
      <g class="sc-pop" filter="url(#${id}Glow)"><circle cx="304" cy="330" r="36" fill="url(#${id}Badge)" stroke="#c4b5fd" stroke-width="2.4"/>${g.check(304, 330, 42)}</g>`,
  });
}

/** The statement — a screenshot and a spreadsheet, loose, become one sealed record. */
function record(id: string) {
  return svg(id, {
    base: floor(id, 240, 500, 170, 34),
    auxBack: `${card(id, { x: 132, y: 150, w: 140, h: 104, lean: -11, op: 0.55, dashed: true, body: g.image(0, -6, 52) })}
      ${card(id, { x: 350, y: 140, w: 140, h: 104, lean: 9, op: 0.55, dashed: true, body: g.table(0, 0, 60) })}
      ${beam(id, "M150,206 C150,280 220,290 232,330", 0.8)}${beam(id, "M340,196 C340,280 262,290 250,330", 0.8)}`,
    main: card(id, { x: 240, y: 408, w: 208, h: 150, r: 14, body: `${g.image(-58, -28, 44)}${g.table(0, -26, 36)}${g.lines(28, -46, 44, 2, 12)}${g.lines(-78, 18, 156, 3, 13)}` }),
    aux: `<g class="sc-pop" filter="url(#${id}Glow)"><rect x="286" y="458" width="82" height="30" rx="15" fill="#161a3f" stroke="#c4b5fd" stroke-opacity="0.8"/>${g.lock(305, 470, 20)}<circle cx="344" cy="473" r="4.5" fill="#34c77b"/></g>`,
  });
}

/** Collect — the four evidence items flow into one bundle. */
function collect(id: string) {
  const items = [
    { x: 76, y: 108, i: g.graph },
    { x: 190, y: 72, i: g.cube },
    { x: 298, y: 76, i: g.doc },
    { x: 408, y: 112, i: g.clip },
  ];
  return svg(id, {
    base: floor(id, 240, 520, 180, 34),
    auxBack: `${items.map((t, i) => `${beam(id, `M${t.x},${t.y + 34} C${t.x},${t.y + 170} ${226 + i * 9},230 ${226 + i * 9},318`, 0.85)}${dot(226 + i * 9, 318, 2.6, "#e9e4ff")}`).join("")}
      ${items.map((t) => card(id, { x: t.x, y: t.y, w: 74, h: 60, r: 10, body: t.i(0, 0, 30) })).join("")}`,
    main: `${card(id, { x: 262, y: 396, w: 200, h: 146, r: 14, op: 0.45 })}${card(id, { x: 251, y: 408, w: 200, h: 146, r: 14, op: 0.7 })}
      ${card(id, { x: 240, y: 420, w: 200, h: 146, r: 14, body: `${g.image(-54, -30, 50)}${g.lines(-8, -44, 70, 3, 12)}${g.lines(-78, 16, 156, 3, 13)}` })}`,
  });
}

/** Hash — the bundle passes through a fingerprint gate and comes out as its hash. */
function hash(id: string, d: SceneData) {
  const sq = [[118, 216], [352, 230], [132, 330], [364, 344], [100, 272], [382, 290], [150, 380], [340, 188]];
  return svg(id, {
    base: `${floor(id, 240, 530, 170, 30)}${sq.map(([x, y], i) => `<rect x="${x}" y="${y}" width="${6 + (i % 3) * 2}" height="${6 + (i % 3) * 2}" rx="1.5" fill="#6d8dff" fill-opacity="${0.35 + (i % 3) * 0.2}"/>`).join("")}`,
    auxBack: `${card(id, { x: 240, y: 86, w: 118, h: 76, r: 10, body: `${g.image(-24, -2, 34)}${g.lines(4, -12, 30, 3, 9)}` })}${beam(id, "M240,126 L240,176")}${beam(id, "M240,386 L240,446")}`,
    main: card(id, { x: 240, y: 282, w: 188, h: 206, r: 16, body: g.hash(0, 0, 104, 11) }),
    aux: `<g filter="url(#${id}Glow)"><rect x="98" y="448" width="284" height="52" rx="12" fill="url(#${id}Card)" stroke="url(#${id}Edge)" stroke-width="1.6"/>
      <text class="sc-decode" x="240" y="480" text-anchor="middle" ${mono} font-size="17" fill="#f3efff" letter-spacing="0.5">${d.leafHash}</text></g>`,
  });
}

/** Commit — fingerprints combine pairwise into a tree of cubes, up to one root. */
function merkle(id: string) {
  const leaf = [96, 192, 288, 384].map((x) => ({ x, y: 470 }));
  const mid = [144, 336].map((x) => ({ x, y: 340 }));
  const top = { x: 240, y: 196 };
  const cube = (x: number, y: number, s: number, content = "", b = 1) => slab(id, { cx: x, cy: y, w: s, t: s, content, bright: b });
  return svg(id, {
    base: floor(id, 240, 530, 210, 34),
    auxBack: `${leaf.map((l, i) => beam(id, `M${l.x},${l.y - 60} C${l.x},${l.y - 100} ${mid[i >> 1].x},${mid[i >> 1].y + 40} ${mid[i >> 1].x},${mid[i >> 1].y}`, 0.75)).join("")}
      ${mid.map((m) => beam(id, `M${m.x},${m.y - 60} C${m.x},${m.y - 110} ${top.x},${top.y + 60} ${top.x},${top.y + 10}`, 0.9)).join("")}
      ${leaf.map((l) => cube(l.x, l.y, 44, "", 0.85)).join("")}${mid.map((m) => cube(m.x, m.y, 56, "", 0.95)).join("")}`,
    main: `${floor(id, top.x, top.y + 20, 90, 30, 0.6)}${cube(top.x, top.y, 92, g.hash(0, 0, 44, 4))}`,
  });
}

/** Anchor — the root cube locked into a chain of blocks. */
function chain(id: string, d: SceneData) {
  const P = iso(240, 330);
  const blocks = [-2, -1, 0, 1, 2].map((i) => ({ i, p: P(i * 92, 0, 0) }));
  const [cx, cy] = blocks[2].p;
  return svg(id, {
    base: floor(id, 240, 420, 220, 60),
    auxBack: `${blocks
      .slice(0, -1)
      .map(({ p }, j) => {
        const q = blocks[j + 1].p;
        return `<line x1="${f(p[0])}" y1="${f(p[1] - 22)}" x2="${f(q[0])}" y2="${f(q[1] - 22)}" stroke="#a78bfa" stroke-opacity="0.6" stroke-width="2" filter="url(#${id}Glow)"/>`;
      })
      .join("")}
      ${blocks.filter(({ i }) => i !== 0).map(({ i, p }) => slab(id, { cx: p[0], cy: p[1] + 6, w: 42, t: 42, bright: 0.55 + 0.15 * (2 - Math.abs(i)) })).join("")}`,
    main: `<ellipse cx="${f(cx)}" cy="${f(cy + 32)}" rx="70" ry="22" fill="none" stroke="#c4b5fd" stroke-width="2" filter="url(#${id}Glow)"/>${slab(id, { cx, cy, w: 68, t: 68, content: g.hash(0, 0, 34, 3.4) })}`,
    aux: `<line x1="240" y1="190" x2="240" y2="236" stroke="#c4b5fd" stroke-opacity="0.5"/>
      <g class="sc-pop" filter="url(#${id}Glow)"><rect x="133" y="155" width="214" height="34" rx="10" fill="#0e1024" fill-opacity="0.85" stroke="#a996ff" stroke-opacity="0.55"/>
      <circle cx="151" cy="172" r="4.5" fill="#34c77b"/><text x="248" y="177" text-anchor="middle" ${mono} font-size="13" fill="#e9e4ff">block #${d.block}</text></g>`,
  });
}

/** Who it's for — a shield that holds up under challenge. */
function shield(id: string) {
  const sh = "M240,150 L318,178 C318,268 292,318 240,350 C188,318 162,268 162,178 Z";
  return svg(id, {
    base: `${pedestal(id, 240, 452, 168)}<circle cx="240" cy="262" r="176" fill="none" stroke="#8b6cf8" stroke-opacity="0.18"/><circle cx="240" cy="262" r="140" fill="none" stroke="#8b6cf8" stroke-opacity="0.12" stroke-dasharray="3 8"/>`,
    main: `<path d="${sh}" transform="translate(10,12)" fill="#2a1f7a" fill-opacity="0.5"/>
      <g filter="url(#${id}Glow)"><path d="${sh}" fill="url(#${id}Card)" stroke="url(#${id}Edge)" stroke-width="2.4"/><path d="M240,170 L302,192 C302,264 282,304 240,330" fill="#ffffff" fill-opacity="0.05"/>${g.check(240, 252, 92)}</g>`,
    aux: [[96, 150], [390, 128], [410, 300], [80, 320]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="${7 + i}" height="${7 + i}" rx="2" fill="#6d8dff" fill-opacity="0.5"/>`).join(""),
  });
}

/** Architecture — the bundle stays private (above); only its fingerprint goes on-chain (below). */
function arch(id: string) {
  const P = iso(240, 470);
  const rail = [-1, 0, 1].map((i) => P(i * 84, 0, 0));
  const label = (y: number, t: string) => `<text x="240" y="${y}" text-anchor="middle" ${mono} font-size="12" letter-spacing="2" fill="#8a91a0">${t}</text>`;
  return svg(id, {
    base: `${floor(id, 240, 250, 170, 50, 0.6)}${floor(id, 240, 500, 140, 30, 0.8)}<line x1="60" y1="352" x2="420" y2="352" stroke="#8b6cf8" stroke-opacity="0.35" stroke-dasharray="4 6"/>${label(60, "PRIVATE")}${label(572, "PUBLIC")}`,
    main: `${slab(id, { cx: 240, cy: 250, w: 150, z: 0, t: 16, top: "#4a36b8", bright: 0.8 })}
      ${slab(id, { cx: 240, cy: 250, w: 150, z: 52, t: 6, bright: 0.8, content: g.lines(-50, -18, 70, 4, 11) })}
      ${slab(id, { cx: 240, cy: 250, w: 150, z: 104, t: 6, bright: 0.9, content: g.lock(0, -6, 60) })}`,
    aux: `${beam(id, "M240,330 L240,418")}
      ${rail.slice(0, -1).map((p, j) => `<line x1="${f(p[0])}" y1="${f(p[1] - 20)}" x2="${f(rail[j + 1][0])}" y2="${f(rail[j + 1][1] - 20)}" stroke="#a78bfa" stroke-opacity="0.5" stroke-width="2"/>`).join("")}
      ${slab(id, { cx: rail[0][0], cy: rail[0][1] + 4, w: 38, t: 38, bright: 0.55 })}${slab(id, { cx: rail[2][0], cy: rail[2][1] + 4, w: 38, t: 38, bright: 0.55 })}
      <g class="sc-pop">${slab(id, { cx: rail[1][0], cy: rail[1][1], w: 58, t: 58, content: g.hash(0, 0, 28, 3) })}</g>`,
  });
}

/** Every scene by the name a section gives in `data-morph` ("mark" is the logo itself, drawn as an image). */
export const SCENES = {
  stack: (id: string) => stack(id),
  doc: (id: string) => doc(id),
  record: (id: string) => record(id),
  collect: (id: string) => collect(id),
  hash: (id: string, d: SceneData) => hash(id, d),
  merkle: (id: string) => merkle(id),
  chain: (id: string, d: SceneData) => chain(id, d),
  shield: (id: string) => shield(id),
  arch: (id: string) => arch(id),
} as const;

export type SceneKey = keyof typeof SCENES;
export const SCENE_KEYS = Object.keys(SCENES) as SceneKey[];
