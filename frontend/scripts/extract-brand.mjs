// Cuts the symbol and wordmark out of the supplied logo (brand-source.webp)
// and converts its dark background to transparency. Run: node scripts/extract-brand.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "brand-source.webp";
const BG = [4, 4, 20]; // sampled background colour
const FLOOR = 14; // anything this close to the background becomes fully transparent

mkdirSync("public/brand", { recursive: true });

async function extract(region, out, feather = 0.18, shape = "ellipse") {
  const { data, info } = await sharp(SRC).extract(region).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = [0, 1, 2].map((c) => Math.max(0, data[i + c] - BG[c]));
      const m = Math.max(...d);
      let a = Math.max(0, m - FLOOR) / (255 - BG[2] - FLOOR);
      a = Math.min(1, a * 1.15);
      // soft elliptical vignette so stray background texture at the crop edges disappears
      const nx = (x / w - 0.5) * 2;
      const ny = (y / h - 0.5) * 2;
      const r = shape === "rect" ? Math.max(Math.abs(nx), Math.abs(ny)) : Math.sqrt(nx * nx + ny * ny);
      const edge = Math.min(1, Math.max(0, (1.05 - r) / feather));
      a *= edge;
      for (let c = 0; c < 3; c++) data[i + c] = a > 0.004 ? Math.min(255, Math.round(d[c] / Math.max(a, m / 255))) : 0;
      data[i + 3] = Math.round(a * 255);
    }
  }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).png().toFile(out);
  const meta = await sharp(out).metadata();
  console.log(out, meta.width, "x", meta.height);
}

await extract({ left: 330, top: 120, width: 600, height: 830 }, "public/brand/solidity-mark.png");
await extract({ left: 140, top: 956, width: 970, height: 100 }, "public/brand/solidity-wordmark.png", 0.1, "rect");

// favicon / app icon: mark centred on the site background
const mark = await sharp("public/brand/solidity-mark.png").resize({ height: 440, fit: "inside" }).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 5, g: 7, b: 13, alpha: 1 } } })
  .composite([{ input: mark, gravity: "center" }])
  .png()
  .toFile("app/icon.png");
await sharp("app/icon.png").resize(180, 180).toFile("app/apple-icon.png");
console.log("icons written");

// Web-optimised sizes (the full PNGs stay as masters)
await sharp("public/brand/solidity-mark.png").resize({ height: 160 }).webp({ quality: 90, alphaQuality: 100 }).toFile("public/brand/mark-160.webp");
await sharp("public/brand/solidity-mark.png").resize({ height: 640 }).webp({ quality: 88, alphaQuality: 100 }).toFile("public/brand/mark-640.webp");
await sharp("public/brand/solidity-wordmark.png").resize({ height: 48 }).webp({ quality: 92, alphaQuality: 100 }).toFile("public/brand/wordmark-48.webp");
console.log("web sizes written");
