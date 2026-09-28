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
- Issuer check: `hasRole(ISSUER_ROLE(), wallet)` (OpenZeppelin AccessControl; `ISSUER_ROLE` read once and cached,
  `isIssuer()` in `lib/chain/registry.ts`). Not an issuer → read-only message; list stays visible.
- Reason codes: `FLAG_REASONS` in `lib/chain/flags.ts` is the source of truth (1 Phishing, 2 Investment scam,
  3 Impersonation, 4 Ransomware, 5 Money mule, 6 Stolen funds, 99 Other), mirrored in `backend/README.md`.

Files: `components/issuer/issuer-view.tsx`, `app/(console)/issuer/page.tsx`, `lib/chain/flags.ts`,
`lib/chain/flags.test.ts`, `lib/chain/registry.ts` (+ `anchorEvents`, `isIssuer`), `abi/registry.ts`
(+ `ISSUER_ROLE`, `hasRole`), `backend/README.md` (reason codes, AccessControl functions).

## Step 7 — Dashboard ✅
- `/dashboard`: stats from `api.stats` ("—" on error; "Sample data (mock mode)" label in mock mode), quick links to
  Scan / Verify / Shield / Issuer, recent certificates (`CertificateAnchored`) and recent flags (`Flagged`) from MST.
- Removed the fake panels: `components/dashboard/{activity-item,greeting,stat-card,throughput-panel}.tsx` deleted.
- Command palette: sample cases removed; pasting an address → "Scan this address", a certificate ID → "Verify
  certificate", a tx hash → "View transaction on MSTScan" (new tab); shortcut list matches the real routes.
- Search placeholder (top bar + palette): "Search addresses, certificates, tx hashes" — all three are handled.

Files: `components/dashboard/dashboard-view.tsx`, `app/(console)/dashboard/page.tsx`,
`components/navigation/command-palette.tsx`, `components/layout/app-shell.tsx` (placeholder text).

## Open items
- Contracts not deployed: registry/SafeSend addresses empty, so every chain write is untested against a real contract.
  Retest Shield (flagged + unflagged send), Issuer (flag, revoke, non-issuer wallet) and Verify (real anchor) after deploy.
- Legacy sample-data code (`data/*`, `components/{cases,explorer,intake}/*`, `components/proof/{proof-card,hash-ring}.tsx`,
  `lib/session-seals.ts`): keep for now — clean up after the landing redesign is final (see Decisions).

## Decisions (owner)
1. Issuer check uses OpenZeppelin AccessControl: `ISSUER_ROLE()` read once, then `hasRole(ISSUER_ROLE, address)`.
   Both are in the placeholder ABI; no new contract function.
2. Reason codes 1–6, 99 are final. One exported constant (`FLAG_REASONS`), same table in `backend/README.md`.
3. Old sample-data code: don't delete anything yet; the landing page still uses some of it and is being redesigned
   separately. Clean up once the landing page is final.
4. Search placeholder is "Search addresses, certificates, tx hashes" only because search handles all three
   (tx hashes were added); otherwise the search box would be hidden.

## Tests
`cd frontend && npm test` (vitest): `lib/cert/canonical.test.ts`, `lib/chain/flags.test.ts` — 10 tests.
