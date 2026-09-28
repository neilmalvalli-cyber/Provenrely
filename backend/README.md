# Provenrely — backend

This folder is for the API service. The frontend (`../frontend`) calls the endpoints below at
`NEXT_PUBLIC_API_URL`. Until the backend is ready, the frontend runs with `NEXT_PUBLIC_USE_MOCKS=true` and returns
sample data of exactly these shapes, so both sides can be built in parallel.

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
Real counts only (from the chain or your database) — never placeholder numbers.
```json
{ "flagsIssued": 12, "certificatesAnchored": 48, "transfersBlocked": 3, "updatedAt": "2026-09-28T10:30:00Z" }
```

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

Source of truth: `src/ProvenrelyRegistry.sol` (Foundry, repo root). The frontend's ABI is generated from its build
output (`forge build`, then `cd frontend && npm run abi`), so this summary is for reading only.

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

// SafeSend — not in this repo yet; frontend/abi/safe-send.ts is hand-written until it is (npm run abi picks it up)
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
