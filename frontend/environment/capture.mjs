/**
 * Review screenshots of the marble environment (headless Chromium, WebGL on SwiftShader).
 *
 *   npm run dev                                   # in frontend/
 *   PLAYWRIGHT=<path to node_modules/playwright> node environment/capture.mjs [label]
 *
 * Writes <out>/<label>-<viewport>-t<seconds>.png for the lab route (clock seeked to 0, 5 and 15 s),
 * and <label>-app-<page>-<viewport>.png for console pages with the environment behind them.
 * Playwright isn't a project dependency; install it anywhere (npm i playwright) and point PLAYWRIGHT at it.
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const label = process.argv[2] ?? "shot";
const out = process.env.OUT ?? path.resolve(import.meta.dirname, "../public/environment/review");
const only = process.env.ONLY ?? "lab,app";
const times = (process.env.TIMES ?? "0,5,15").split(",").map(Number);
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const query = process.env.QUERY ?? "";
mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const problems = [];
async function page(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const p = await context.newPage();
  p.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`[${m.type()}] ${m.text()}`);
  });
  p.on("requestfailed", (r) => problems.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  p.on("response", (r) => {
    if (r.url().includes("/environment/") && r.status() >= 400) problems.push(`[${r.status()}] ${r.url()}`);
  });
  return { context, p };
}

const waitLive = (p) =>
  p.waitForFunction(() => window.__marbleEnv?.status === "live" && window.__marbleEnv?.handle, null, { timeout: 240_000 });

if (only.includes("lab")) {
  for (const [name, viewport] of Object.entries(viewports)) {
    const { context, p } = await page(viewport);
    await p.goto(`${base}/lab/environment?tier=high&panel=0${query}`, { waitUntil: "load" });
    await waitLive(p);
    for (const t of times) {
      await p.evaluate((s) => window.__marbleEnv.handle.seek(s), t);
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(out, `${label}-${name}-t${t}.png`) });
    }
    console.log(name, await p.evaluate(() => JSON.stringify(window.__marbleEnv.handle.info())));
    await context.close();
  }
}

if (only.includes("app")) {
  for (const route of (process.env.PAGES ?? "dashboard,scan,verify,shield,issuer").split(",")) {
    for (const [name, viewport] of Object.entries(viewports)) {
      const { context, p } = await page(viewport);
      await p.goto(`${base}/${route}?environment=high`, { waitUntil: "load" });
      await p.waitForSelector(".marble-environment[data-live]", { timeout: 240_000 }).catch(() => problems.push(`${route}: not live`));
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(out, `${label}-app-${route}-${name}.png`) });
      await context.close();
    }
  }
}

await browser.close();
console.log(problems.length ? problems.join("\n") : "no console errors or failed requests");
