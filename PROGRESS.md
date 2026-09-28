# Provenrely — build progress

Frontend in `frontend/`. Scope: functionality first in the internal UI; visual redesign and landing/animation work later.

## Step 1 — wallet + chain + nav ✅
- MST Testnet from env (`lib/config/env.ts`, `lib/chain/mst.ts`); chain id 91562037 confirmed live (`eth_chainId` = `0x5752035`; MST docs' `0x5752c55` is wrong — hex is always derived).
- BridgeKey via wagmi `injected()` (standard EIP-1193, no custom connector); late-injection re-check for mobile in-app browsers.
- Connect → auto prompt to switch/add MST → banner with retry if the wallet didn't switch. Tested with a scripted EIP-1193 test wallet (worst case: adds without switching). Needs a real BridgeKey test on a phone.
- Top bar: wallet button + live MST block (RPC read, links to MSTScan; "RPC unreachable" on failure).
- Sidebar: Dashboard, Scan, Verify, Shield, Issuer. Explorer, Login, Intake, Cases, Proof routes removed (redirects in `next.config.ts`).
- Brand: `lib/config/brand.ts` (`PRODUCT_NAME = "Provenrely"`), text wordmark, page titles, aria labels, footer.

Files: `.env.example`, `.env.local` (git-ignored), `next.config.ts`, `package.json`, `app/layout.tsx`,
`app/not-found.tsx`, `app/(console)/{scan,shield,issuer}/page.tsx` (placeholders), `components/providers.tsx`,
`components/wallet/*`, `components/layout/app-shell.tsx`, `components/layout/site-footer.tsx`,
`components/navigation/command-palette.tsx`, `components/navigation/site-nav.tsx`, `components/proof/doc-shell.tsx`,
`components/brand/Logo.tsx`, `components/ui/badges.tsx`, `lib/config/*`, `lib/chain/*`.
Deleted: `app/(console)/{explorer,intake,cases}`, `app/login`, `app/proof`.

Known leftovers (landing out of scope for now): the landing intro still animates the old wordmark letters; landing copy
still names the old product. Command palette still searches sample cases (fixed with Dashboard, step 7).

## Step 2 — Scan ✅
- `/scan`: address validation → `api.scan` → verdict, score, reasons; English/Hindi → `api.explain` + next steps;
  1930 and cybercrime.gov.in always shown; "Issue certificate" → `api.createCertificate` → `/certificate/[id]`.
- Works end to end in mock mode (`NEXT_PUBLIC_USE_MOCKS=true`, labelled "Sample data").

Files: `app/(console)/scan/page.tsx`, `components/scan/{scan-view,verdict}.tsx`, `lib/api/{types,client,mocks}.ts`.

## Step 3 — Certificate ✅
- `/certificate/[id]` (DocShell): loads via `api.getCertificate`, recomputes the hash locally, reads `anchoredAt(hash)`
  on MST ("Anchored on MST" only if > 0; "registry not configured" otherwise), anchor tx via `CertificateAnchored`,
  QR to `/verify?cert=<id>`, share/export → `api.logCustody`, custody list from `CustodyLogged` events.
- Shared: `lib/cert/canonical.ts` (canonicalize + `certificateHash` via Web Crypto; both backend test vectors match),
  `lib/chain/registry.ts` (reads + indexed event queries with chunked fallback), `lib/chain/explorer.ts`,
  `abi/registry.ts`, `abi/safe-send.ts` (placeholder ABIs). Added `sonner`, `qrcode.react`.

Files: `app/certificate/[id]/page.tsx`, `components/certificate/certificate-view.tsx`, `lib/cert/canonical.ts`,
`lib/chain/{registry,explorer}.ts`, `abi/*`.

## Step 4 — Verify ✅
- `/verify`: load a certificate by file upload, paste, or `?cert=<id>` (only the file is fetched from the API).
  Hash recomputed locally → `anchoredAt(hash)` on MST → VALID (block time, anchor tx + block links) or TAMPERED.
  The file's own `anchor` is never trusted; a mismatch with it is shown as a warning.
- "Edit a field" toggle: edit any scalar body field, re-hashes live → TAMPERED.
- Registry not configured → hash still shown, "can't check MST" message. Old Merkle/sample-case demo removed.
- Unit tests (vitest, owner's choice): `lib/cert/canonical.test.ts` — both backend vectors, bad salt, key sorting, null/float rejection. Run `npm test`.
- Browser-checked: pasting the backend test vector shows 0x89e1…; editing verdict → SAFE shows the tamper vector 0x3cf1….

Files: `components/proof/verify-view.tsx` (rewritten), `app/(console)/verify/page.tsx` (title), `lib/cert/canonical.test.ts`, `package.json` (`test` script).

## Step 5 — Shield ✅
- `/shield`: recipient + amount (tMSTC, `parseEther`, balance shown) → `getFlag(recipient)` warning (reason, issuer,
  expiry) → "Send" / "Send anyway" = `SafeSend.send(to)` with value from the wallet.
- Fixed gas limit (150k) is passed so the wallet doesn't pre-estimate: a flagged transfer is mined and reverts on-chain.
  Receipts carry no revert data, so the call is replayed at that block to decode `RecipientFlagged(address)`.
- sonner toasts (pending → confirmed / reverted, explorer links); `<Toaster>` mounted in `components/providers.tsx`.
- SafeSend not configured → sending disabled with a message; wrong network / no wallet → button disabled with a reason.

Files: `components/shield/shield-view.tsx`, `app/(console)/shield/page.tsx`, `lib/chain/tx.tsx` (revert decoding,
`trackTx` toasts), `lib/chain/flags.ts`, `components/providers.tsx`.

## Step 6 — Issuer ✅
- `/issuer`: `flag(subject, reason, evidenceHash, expiry)` — reason dropdown, evidence file hashed with SHA-256 in the
  browser (never uploaded), expiry date (end of day UTC, must be in the future). Simulated before sending so contract
  rejections show a reason.
- Active flags from `Flagged` + `Revoked` events (latest flag per subject, minus revoked/expired), with Revoke.
- Roles: `hasRole(ISSUER(), wallet)` and `hasRole(DEFAULT_ADMIN_ROLE, wallet)` (`readRoles()` in `lib/chain/registry.ts`;
  `ISSUER` read once and cached). Not an issuer → read-only form; list stays visible. Revoke is shown only on your own
  flags, or on all flags for an admin (contract rule). (Updated in step 8.)
- Reason codes: `FLAG_REASONS` in `lib/chain/flags.ts` is the source of truth (1 Phishing, 2 Investment scam,
  3 Impersonation, 4 Ransomware, 5 Money mule, 6 Stolen funds, 99 Other), mirrored in `backend/README.md`.

Files: `components/issuer/issuer-view.tsx`, `app/(console)/issuer/page.tsx`, `lib/chain/flags.ts`,
`lib/chain/flags.test.ts`, `lib/chain/registry.ts` (+ `anchorEvents`, `readRoles`), `abi/registry.ts`,
`backend/README.md` (reason codes, AccessControl functions).

## Step 7 — Dashboard ✅
- `/dashboard`: stats from `api.stats` ("—" on error; "Sample data (mock mode)" label in mock mode), quick links to
  Scan / Verify / Shield / Issuer, recent certificates (`CertificateAnchored`) and recent flags (`Flagged`) from MST.
- Removed the fake panels: `components/dashboard/{activity-item,greeting,stat-card,throughput-panel}.tsx` deleted.
- Command palette: sample cases removed; pasting an address → "Scan this address", a certificate ID → "Verify
  certificate", a tx hash → "View transaction on MSTScan" (new tab); shortcut list matches the real routes.
- Search placeholder (top bar + palette): "Search addresses, certificates, tx hashes" — all three are handled.

Files: `components/dashboard/dashboard-view.tsx`, `app/(console)/dashboard/page.tsx`,
`components/navigation/command-palette.tsx`, `components/layout/app-shell.tsx` (placeholder text).

## Step 8 — CI fix + frontend matches the contract ✅
Contract logic untouched (`src/ProvenrelyRegistry.sol` on `main` is the source of truth).
- CI: `forge fmt` removed whitespace on two blank lines in `test/ProvenrelyRegistry.t.sol` (lines 30, 40) — the only
  change. Locally: `forge fmt --check` clean, `forge build --sizes` OK (solc 0.8.37; lint warnings only, about
  `block.timestamp` comparisons), `forge test` 3/3 pass. `.gitattributes`: `*.sol text eol=lf`. Submodules initialised.
- ABIs are generated, not hand-written: `frontend/scripts/gen-abi.mjs` reads `out/<Name>.sol/<Name>.json` →
  `frontend/abi/*.ts`. Regenerate: `forge build` (repo root), then `cd frontend && npm run abi`. SafeSend isn't in the
  repo yet, so `abi/safe-send.ts` stays hand-written until it is.
- Issuer role: `ISSUER()` + `hasRole()`; admin via `DEFAULT_ADMIN_ROLE` (for the revoke rule).
- Anchor lookup: `certificates(hash)` → timestamp 0 = not anchored, otherwise VALID with that timestamp (Verify,
  Certificate). `readAnchoredAt()` keeps its name and callers.
- `getFlag`: reads `(Flag f, bool active)`; Shield warns and says "Send anyway" when the contract's `active` is true.
  The frontend's own copy of the active rule (`isActiveFlag`) was removed.
- `CustodyLogged` timestamp field is `ts`; custody list reads it.
- Custom errors are decoded by name with plain-language text (`lib/chain/tx.tsx`).
- `backend/README.md` contract summary updated to the real interface (read-only summary; source is the .sol file).

Files: `.gitattributes`, `test/ProvenrelyRegistry.t.sol` (fmt only), `frontend/scripts/gen-abi.mjs`,
`frontend/package.json` (`abi` script), `frontend/abi/registry.ts` (generated), `frontend/lib/chain/{registry,flags,tx}.ts*`,
`frontend/lib/chain/flags.test.ts`, `frontend/components/{shield/shield-view,issuer/issuer-view,proof/verify-view,
certificate/certificate-view}.tsx`, `backend/README.md`.

## Open items
- SafeSend contract isn't in the repo yet (Shield uses a hand-written ABI for `send` + `RecipientFlagged`).
- `src/Counter.sol` / `script/Counter.s.sol` Foundry template files are still on `main` (contract side, left alone).
- Contracts not deployed: registry/SafeSend addresses empty, so every chain write is untested against a real contract.
  Retest Shield (flagged + unflagged send), Issuer (flag, revoke, non-issuer wallet) and Verify (real anchor) after deploy.
- Legacy sample-data code (`data/*`, `components/{cases,explorer,intake}/*`, `components/proof/{proof-card,hash-ring}.tsx`,
  `lib/session-seals.ts`): keep for now — clean up after the landing redesign is final (see Decisions).

## Decisions (owner)
1. Issuer check uses OpenZeppelin AccessControl with `hasRole`. The contract's role getter is `ISSUER()` (not
   `ISSUER_ROLE()`), so step 8 uses `ISSUER()`; no new contract function.
2. Reason codes 1–6, 99 are final. One exported constant (`FLAG_REASONS`), same table in `backend/README.md`.
3. Old sample-data code: don't delete anything yet; the landing page still uses some of it and is being redesigned
   separately. Clean up once the landing page is final.
4. Search placeholder is "Search addresses, certificates, tx hashes" only because search handles all three
   (tx hashes were added); otherwise the search box would be hidden.
5. Contract is the source of truth: don't change contract logic from the frontend side; generate ABIs from `forge build`.

## Tests
`cd frontend && npm test` (vitest): `lib/cert/canonical.test.ts`, `lib/chain/flags.test.ts` — 9 tests.
Contracts: `forge test` (repo root) — 3 tests.

## Marble environment (feat/marble-environment) — plan
Phase 1 only: a photographic marble background behind the internal app (the `(console)` route group). Landing page,
contracts, backend and feature logic are not touched.

**Stack findings.** Next 16.3 (App Router, Turbopack), React 19, Tailwind 4 (`@theme` tokens in `app/globals.css`),
npm + `package-lock.json`, `lint` = `tsc --noEmit`, vitest. `three@0.186` is already a dependency (no r3f/drei/
postprocessing). The console layout (`app/(console)/layout.tsx`) wraps every internal page in `AppShell`, which already
mounts a first-pass `MarbleBackground` (runtime-only, procedural shader stone on boxes, RoomEnvironment IBL, invisible
leaf casters). `/certificate/[id]` is a document page outside the console group and has no background. No Git LFS.
Network: npm, PyPI and raw.githubusercontent.com are reachable; blender.org, Poly Haven and ambientCG are not.

**Evaluation of the first pass.** Good bones (lazy chunk, pause when hidden/off-screen, context loss, disposal), but it
can't reach the bar: unbevelled boxes, no GI/bounce (hemisphere light only), no contact shadows, a single PCF shadow
map for both architecture and leaves, no floor reflections, RoomEnvironment reflections that don't belong to the
scene, and a composition that doesn't match the reference. Kept: the mount pattern, lifecycle handling, CSS fallback
idea. Replaced: the scene, materials, lighting and shadows.

**Architecture.**
- Blender 5.2 LTS (`pip install bpy`, headless) builds the scene from a committed script
  (`frontend/environment/blender/build_scene.py`): bevelled walls, pillars, fluted columns, stepped platforms and a
  portico ceiling, a second UV set for lightmaps, and Cycles bakes:
  - `lightmap` RGB = sky + bounce irradiance (all indirect light, including the sun's bounce and AO/contact shadowing);
  - `sunvis` = soft sun visibility from the architecture (sun lamp with a real angular diameter → true penumbrae);
  - an HDR panorama rendered *from inside the scene* for specular IBL, so reflections show this room, not a stock HDRI.
- Stone textures are generated (tileable, periodic noise/Voronoi in numpy, `generate_textures.py`): terrazzo aggregate,
  crackle veining, mineral tint, roughness and normal variation. No third-party texture is needed, so no licence risk.
- Runtime: plain Three.js in a client component, dynamically imported (no SSR), no new dependencies (r3f/drei would be
  a second rendering stack for one canvas). MeshStandardMaterial with shader patches:
  diffuse ambient from the baked lightmap (IBL irradiance switched off to avoid double counting), direct sun from a
  real `DirectionalLight` for correct diffuse + specular, multiplied by baked `sunvis` (architecture shadows) and a
  live shadow map that contains only the off-camera foliage (instanced leaves + branches; wind in a vertex shader shared
  by the shadow depth material: sway, flutter, per-branch phase, slow irregular gusts).
- Floor: blurred planar reflection (half-res mirror render → separable blur), roughness- and Fresnel-weighted,
  distorted by the floor normal map. Post: SMAA, very light vignette/grain; AO is baked, so no runtime AO pass.
- Tone mapping: compare ACES Filmic, AgX and Khronos PBR Neutral on screenshots; keep whichever keeps whites textured.

**Integration.** `AppShell` keeps mounting the background (flag `NEXT_PUBLIC_MARBLE_ENVIRONMENT`, default on). A static
poster (captured from the final scene) is shown first and when WebGL is unavailable; the canvas fades in over it.
Dev-only preview `/lab/environment` with a debug panel (exposure, sun angle, wind, quality tier); 404 in production.

**Risks.** CPU-only Cycles bakes in the container (bake time vs noise → denoiser); SwiftShader screenshots are slow
and not representative of GPU performance; asset weight (target < 4 MB total, textures as WebP); the console's dark
panels on a light background (keep the existing ink swap, add at most a neutral scrim).
