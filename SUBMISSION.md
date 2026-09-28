# Provenrely — submission pack

MST Blockchain x Newrro Buildathon · MST Testnet (chain `91562037`) · Repo: https://github.com/neilmalvalli-cyber/Provenrely

## 1. Mandatory requirements checklist

> **TODO:** paste the buildathon's five mandatory requirements (exact wording) into the first table and map each one
> to the evidence in the second. The evidence below is what the project can show today.

| # | Requirement (official wording) | Status | Evidence |
|---|---|---|---|
| 1 | _paste_ | | |
| 2 | _paste_ | | |
| 3 | _paste_ | | |
| 4 | _paste_ | | |
| 5 | _paste_ | | |

| Evidence | Status | Where |
|---|---|---|
| Smart contracts deployed on MST Testnet | ✅ done | Registry [`0x1bE6…6F31`](https://testnet.mstscan.com/address/0x1bE6E26f13450568183D06a14a8ae1d5e3136F31), SafeSend [`0x88D3…75Da`](https://testnet.mstscan.com/address/0x88D3DeD3AbF9fdA0BcD851Cc550981F94F1C75Da); deploy record in `broadcast/`; roles and wiring verified on-chain by `npm run post-deploy` |
| Contracts source-verified on MSTScan | ❌ not possible as deployed | compiled with solc 0.8.37; MSTScan supports up to 0.8.36 (bytecode matches the repo exactly) |
| Wallet integration (BridgeKey, EIP-1193) | ✅ built · ⏳ manual test on devices | connect, add/switch to MST, Shield send, Issuer flag/revoke; checklist in §4 |
| Working end-to-end product | ✅ on a local chain · ⏳ on MST once hosted | scan → explain → certificate (anchored) → VALID / TAMPERED → custody → stats, run end to end against a local chain with the real contracts |
| Real on-chain transactions for every feature | ✅ | flag / revoke, SafeSend (success and revert), anchorCertificate, logCustody |
| Tests + CI | ✅ | contracts 11, backend 51, frontend 12; GitHub Actions: Foundry, Frontend, Backend (+ Docker build, ABI drift) |
| Public repo, README, deployment guide | ✅ | README.md, DEPLOYMENT.md |
| Live demo URL | ⏳ | after Vercel + Render/Railway deploy — add to README |
| Demo video | ⏳ | record with the script below — add to README |

## 2. Three-minute demo script

Prep: issuer wallet and a normal wallet in BridgeKey, both on MST; `npm run scenario` already run (so a scammer
address is flagged and has a reverted SafeSend on MSTScan); a second tab open on MSTScan.

| Time | Show | Say |
|---|---|---|
| 0:00–0:20 | Landing page | "Crypto scam victims find out too late. Provenrely checks an address before you pay, proves what you found, and records who handled the proof — on MST." |
| 0:20–0:55 | **Shield**: paste the scammer address | The warning appears: flagged, *Investment scam*, issuer address, expiry — read from the registry on MST. |
| | Enter 0.001 tMSTC → **Send anyway** → confirm in BridgeKey | "We let it go through to prove the chain enforces it, not our UI." Toast: **reverted on-chain**, decoded `RecipientFlagged`. Click the tx → MSTScan shows the failed transaction. |
| 0:55–1:30 | **Scan** the same address | HIGH_RISK, score, reasons ("flagged on the registry", links to flagged counterparties). |
| | **Explain** in हिन्दी | Plain Hindi explanation + next steps: 1930 helpline and cybercrime.gov.in. |
| 1:30–2:05 | **Issue certificate** | Certificate page: **Anchored on MST**, hash recomputed in the browser, anchor tx → MSTScan, QR code. |
| | Scan the QR with a phone (or open Verify) | **VALID** with the block time — "no account, no trust in our server". |
| 2:05–2:25 | Verify → **Edit a field** → change `verdict` to `SAFE` | Instantly **TAMPERED**: the hash no longer matches what MST holds. |
| 2:25–2:45 | Certificate → **Share** | A custody entry appears — read back from the `CustodyLogged` event; click its tx on MSTScan. |
| 2:45–3:00 | **Dashboard** | Flags issued, certificates anchored, transfers blocked — real counts from MST. "Shield, Certificate, Custody — all on MST." |

Fallback if MST is slow: the scenario's `scenario-output.json` has every tx link (drain, hops, flag, SafeSend revert).

## 3. Judge questions — short answers

**Why blockchain?** Three things a database can't give strangers: flags that are public and attributable (issuer
wallet, reason, evidence hash, expiry, revocations as events); enforcement inside `SafeSend` on MST rather than in our
app; and certificates anyone can verify against MST without trusting our server — plus a custody trail no one can
quietly rewrite.

**What exists already?** *Chainalysis's sanctions oracle* puts sanctioned addresses on-chain for contracts to check,
but it covers sanctions lists, not everyday scams, and has no user-facing evidence or custody. *Chainabuse* collects
community scam reports off-chain; it doesn't enforce anything at transfer time or produce verifiable evidence.
Provenrely combines an accountable on-chain flag registry, protocol-level enforcement (`SafeSend` / the reusable
`onlyUnflagged` guard), tamper-evident certificates with on-chain custody, and plain-language English/Hindi guidance
pointing to 1930 and cybercrime.gov.in — on MST.

**How do flags stay accountable?** Only wallets the admin grants `ISSUER` can flag. Every flag records the issuer
address, a reason code and an evidence hash (the evidence file itself stays with the issuer), and has an expiry.
Only that issuer or an admin can revoke it, and the admin can remove an issuer. It is all public on MST. Next step:
an appeal process and a multisig admin.

**Privacy?** A certificate's contents stay off-chain; only a salted SHA-256 hash (256-bit random salt, so it can't be
reversed or guessed) and the scanned address go on-chain — and addresses are public on-chain anyway. Evidence files
are hashed in the browser and never uploaded. The optional AI sees only the scan result, never anything about the user.

**What's AI here?** Only the explanation, and it's optional. Verdicts come from transparent rules over on-chain data
(registry flags, links to flagged counterparties, transfer bursts). If an LLM is configured, it rewrites the scan
into plain English or Hindi, is told never to add facts, its output is validated, the 1930 / cybercrime.gov.in steps
are enforced, and any failure falls back to templates. AI never decides a verdict.

**What does it cost?** Each certificate or custody entry is one transaction (~0.0001 tMSTC at 1 gwei), paid by the
relayer, which stops issuing below a balance threshold; per-IP rate limits prevent spending attacks.

## 4. Manual BridgeKey test checklist

Run on **desktop** and on **Android (BridgeKey in-app browser)** against the deployed site. Record pass/fail and any
tx hash.

| # | Step | Expected | Desktop | Android |
|---|---|---|---|---|
| 1 | Open the site, **Connect wallet** | BridgeKey connects; address shown in the top bar | | |
| 2 | Wallet on another network | Prompt to add/switch to MST Testnet (chain `91562037`); banner with retry if it doesn't switch | | |
| 3 | Top bar | Live MST block number | | |
| 4 | Shield → unflagged address, 0.001 tMSTC → Send | Wallet shows gas price ≥ 1 gwei; tx confirmed; toast + MSTScan link | | |
| 5 | Shield → flagged address | Warning with reason, issuer, expiry; button reads **Send anyway** | | |
| 6 | Send anyway → confirm | Mined and **reverted**; `RecipientFlagged` shown; tx on MSTScan is failed; funds not moved | | |
| 7 | Reject a transaction in BridgeKey | "cancelled" toast, nothing sent | | |
| 8 | Issuer page with the issuer wallet | Form enabled; flag an address with an evidence file and an expiry date → tx confirmed; appears in Active flags | | |
| 9 | Issuer page with a non-issuer wallet | Read-only message; list visible; no Revoke buttons | | |
| 10 | Revoke your own flag | tx confirmed; flag leaves the list; Shield no longer warns | | |
| 11 | Scan → Explain (Hindi) → Issue certificate | Certificate page: Anchored on MST | | |
| 12 | Certificate → **Share** | Share sheet (or copy link); custody entry appears | | |
| 13 | Scan the certificate QR with the phone camera | Verify page opens: **VALID** | | |
| 14 | Verify → Edit a field | **TAMPERED** | | |
| 15 | Dashboard | Real counts (Transfers blocked shown once counted) | | |
| 16 | Open the site fresh inside BridgeKey's in-app browser | Wallet is detected even though the provider injects after page load (late-injection re-check); Connect works without a reload | n/a | |
