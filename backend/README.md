# Provenrely — backend

The API service (Express + TypeScript + ethers). The frontend (`../frontend`) calls the endpoints below at
`NEXT_PUBLIC_API_URL`. With `NEXT_PUBLIC_USE_MOCKS=true` the frontend returns sample data of exactly these shapes
instead, so either side can run alone.

## Run

```bash
cd backend
cp .env.example .env   # then fill in; never commit .env
npm ci
npm run dev            # http://localhost:8000  (npm run build && npm start for production)
npm test               # hashing test vectors, scan rules, every endpoint over HTTP
```

| Variable | Purpose |
|---|---|
| `PORT` | default `8000` |
| `CORS_ORIGIN` | the frontend's URL (comma-separated for several) |
| `DATA_DIR` | certificate store (`certificates.json`); mount a volume here in production |
| `MST_RPC_URL`, `MST_CHAIN_ID`, `MST_LEGACY_TX` | chain; MST uses legacy (type 0) transactions |
| `EXPLORER_API_URL` | MSTScan's Etherscan-style API for recent transactions; empty = off |
| `REGISTRY_ADDRESS` | deployed `ProvenrelyRegistry`; empty = flag checks and stats report "not configured" |
| `RELAYER_PK` | key of the wallet holding `RELAYER`; anchors certificates and logs custody. Empty = certificates are stored unanchored (local development only) |

`GET /health` → `{ "status": "ok", "registry": bool, "anchoring": bool }`.

Docker: `docker build -t provenrely-api backend/` then run with the variables above and a volume on `/data`.

### How a scan decides
Score starts at 5; verdict is `HIGH_RISK` ≥ 70, `SUSPICIOUS` ≥ 35, else `SAFE`.
- The address itself has an active flag in the registry → 95.
- Received funds from flagged addresses (recent MSTScan history, each counterparty checked with `getFlag`) → +40, +10 per extra (max 3).
- Sent funds to flagged addresses → +25.
- Sent to ≥ 10 different wallets within 10 minutes → +20.
If the registry or explorer can't be reached, the scan still answers and says what wasn't checked.

> Request/response shapes below are the frontend's working contract. If you need to change one, update this file
> and tell the frontend side — the TypeScript types in `frontend/lib/api/types.ts` mirror it.

## Endpoints

All bodies are JSON. Errors: non-2xx status with `{ "error": "human readable message" }`.

### `POST /api/scan`
```json
// request
{ "address": "0x1111111111111111111111111111111111111111" }
// response
{
  "address": "0x1111111111111111111111111111111111111111",
  "verdict": "HIGH_RISK",            // "SAFE" | "SUSPICIOUS" | "HIGH_RISK"
  "score": 87,                       // integer 0–100
  "reasons": ["Received funds from a flagged address", "Sent to 14 new wallets within 10 minutes"],
  "scannedAt": "2026-09-28T10:15:00Z"
}
```

### `POST /api/explain`
```json
// request
{ "address": "0x…", "verdict": "HIGH_RISK", "score": 87, "reasons": ["…"], "language": "hi" }   // "en" | "hi"
// response
{
  "language": "hi",
  "explanation": "…plain-language explanation in the requested language…",
  "nextSteps": ["Report at https://cybercrime.gov.in", "Call the cybercrime helpline 1930"]
}
```

### `POST /api/certificates`
Creates a certificate from a scan, anchors its hash on MST (`anchorCertificate(certHash, subject)`), and returns it.
```json
// request
{ "address": "0x…", "language": "en" }
// response: a Certificate (format below)
```

### `GET /api/certificates/:id`
Returns the Certificate.

### `POST /api/certificates/:id/custody`
Logs a share or export on-chain (`logCustody(certHash, action)`, 1 = share, 2 = export).
```json
// request
{ "action": "share" }   // "share" | "export"
// response
{ "certHash": "0x…", "action": "share", "txHash": "0x…", "timestamp": "2026-09-28T10:20:00Z" }
```

### `GET /api/stats`
Real counts only — never placeholder numbers. A count that can't be produced (yet) is `null`.
- `flagsIssued`, `certificatesAnchored`: `Flagged` / `CertificateAnchored` logs, scanned from `DEPLOY_BLOCK` in
  `LOG_CHUNK_SIZE` ranges with retries, cached and updated incrementally (`null` while catching up).
- `transfersBlocked`: failed `SafeSend.send` transactions (a revert leaves no event), from MSTScan's transaction list
  for `SAFESEND_ADDRESS` — or, with no explorer, by reading blocks and receipts over RPC. `null` when
  `SAFESEND_ADDRESS` is unset or the count isn't available; the dashboard then hides the tile. It counts every failed
  `send` call; in practice those are `RecipientFlagged` reverts.
```json
{ "flagsIssued": 12, "certificatesAnchored": 48, "transfersBlocked": null, "updatedAt": "2026-09-28T10:30:00Z" }
```

If the server has no relayer configured, `POST /api/certificates` returns the certificate without `anchor`, and
custody returns `409`.

## Certificate format

```json
{
  "id": "cert_01J…",
  "body":   { ...all scan and certificate fields... },     // ONLY this is hashed
  "salt":   "64 lowercase hex chars, no 0x",
  "anchor": { "certHash": "0x…", "txHash": "0x…", "blockNumber": 5781531, "blockTimestamp": "2026-09-28T10:15:12Z" }
                                                            // added after anchoring, never hashed
}
```

### Hashing rules (the frontend verifies these in the browser, byte for byte)

- `canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`
- `hash = "0x" + sha256((salt + canonical).encode("utf-8")).hexdigest()`
- Inside `body`: keys are ASCII only; integers only (no floats — `score` is an int 0–100); timestamps are
  ISO 8601 UTC strings like `"2026-09-28T10:15:00Z"`; token amounts are decimal strings in wei; never `null`
  (omit the key instead).

### Test vectors (both sides must reproduce these)

```text
body = {"schemaVersion":1,"address":"0x1111111111111111111111111111111111111111","verdict":"HIGH_RISK","score":87,"reasons":["Received funds from a flagged address","Sent to 14 new wallets within 10 minutes"],"language":"hi","note":"धोखाधड़ी \"quoted\"","scannedAt":"2026-09-28T10:15:00Z","issuer":"Provenrely"}
salt = "a3f1" * 16
expected = 0x89e1aba7dd040ef8837c2493071935c41a1244bdb8027dff35a05c0bdd8412f1

# tamper case: same body with "verdict": "SAFE"
expected = 0x3cf1dc97d956b7913a3d49837fecb6964384a87f0c40acff4316bba24b23042e
```

## Contracts (MST Testnet)

Source of truth: `src/ProvenrelyRegistry.sol` (Foundry, repo root). The frontend and backend ABIs are generated from
its build output (`forge build`, then `cd frontend && npm run abi`; CI fails if they're stale), so this summary is for
reading only.

```solidity
struct Flag { address issuer; uint16 reason; bytes32 evidenceHash; uint64 expiry; bool revoked; }

function flag(address subject, uint16 reason, bytes32 evidenceHash, uint64 expiry);
function revoke(address subject);                                  // only the flag's issuer or an admin
function isFlagged(address subject) view returns (bool);
function getFlag(address subject) view returns (Flag f, bool active);   // active = exists, not revoked, not expired
function anchorCertificate(bytes32 certHash, address subject);
function certificates(bytes32 certHash) view returns (address subject, uint64 timestamp);  // timestamp 0 = never anchored
function logCustody(bytes32 certHash, uint8 action);               // 1 = share, 2 = export

// OpenZeppelin AccessControl. flag() needs ISSUER, anchorCertificate() needs RELAYER (the backend's wallet).
// The frontend checks hasRole(ISSUER(), wallet) and hasRole(DEFAULT_ADMIN_ROLE, wallet).
function ISSUER() view returns (bytes32);
function RELAYER() view returns (bytes32);
function hasRole(bytes32 role, address account) view returns (bool);
function addIssuer(address a);                                     // admin only

event Flagged(address indexed subject, address indexed issuer, uint16 reason, bytes32 evidenceHash, uint64 expiry);
event Revoked(address indexed subject, address indexed by);
event CertificateAnchored(bytes32 indexed certHash, address indexed subject, uint64 timestamp);
event CustodyLogged(bytes32 indexed certHash, address indexed actor, uint8 action, uint64 ts);

error AlreadyFlagged(address subject);  error NotFlagged(address subject);  error NotAllowed();  error BadExpiry();
error ZeroValue();  error AlreadyAnchored(bytes32 certHash);  error NotAnchored(bytes32 certHash);  error BadAction(uint8 action);

// SafeSend (src/SafeSend.sol, guard in src/Unflagged.sol)
function send(address payable to) payable;
error RecipientFlagged(address to);
```

### Flag reason codes (`uint16 reason`)

The frontend's source of truth is `FLAG_REASONS` in `frontend/lib/chain/flags.ts`. The backend and the contract must
use exactly these numbers; change both places together.

| Code | Reason |
|---|---|
| 1 | Phishing |
| 2 | Investment scam |
| 3 | Impersonation |
| 4 | Ransomware |
| 5 | Money mule |
| 6 | Stolen funds |
| 99 | Other |

Chain: MST Testnet, chain id `91562037`, RPC `https://testnetrpc.mstblockchain.com`,
explorer `https://testnet.mstscan.com` (`/tx/{hash}`, `/address/{address}`), currency tMSTC (18 decimals).

Keep private keys and API secrets in the backend's own `.env` (git-ignored) — never in this repo.
