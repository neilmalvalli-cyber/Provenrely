# Provenrely

Provenrely is a prototype for checking risky crypto addresses before a transfer and preserving evidence afterwards. It uses MST Testnet as a public trust layer:

1. **Shield:** `SafeSend` refuses a transfer to an address actively flagged in the registry.
2. **Certificate:** a scan result is hashed with a random salt, and the hash is anchored on-chain so a viewer can detect changes.
3. **Custody:** sharing or exporting an anchored certificate can be logged on-chain.

The project was built for the MST Blockchain x Newrro Buildathon. It is a demo, not a guarantee that an address is safe or a replacement for reporting fraud.

## Repository status

| Part | Where it is | Current state |
| --- | --- | --- |
| Smart contracts | `src/`, `test/`, `script/` on `main` | Foundry contracts and tests for the registry and SafeSend |
| Backend API | `backend/` on `main` | Express/TypeScript scaffold; its current scan and certificate endpoints are placeholders and are **not** connected to MST |
| Frontend | [`frontend/` on the `frontend` branch](https://github.com/neilmalvalli-cyber/Provenrely/tree/frontend/frontend) | Next.js app with labelled sample-data mode and typed API calls |

The `frontend/` directory has not yet been merged into `main`. To see the full UI, check out the `frontend` branch. Keep `NEXT_PUBLIC_USE_MOCKS=true` until the real backend, deployed contracts, and end-to-end certificate flow are verified together.

## Requirements

- Node.js 20+ and npm for the frontend and backend
- [Foundry](https://book.getfoundry.sh/getting-started/installation) for contract builds, tests, and local Anvil
- An MST-compatible wallet for on-chain interactions

MST Testnet uses chain ID **91562037** (`0x5752035`), RPC `https://testnetrpc.mstblockchain.com`, and explorer `https://testnet.mstscan.com`. Use testnet wallets and test funds only. The decimal chain ID is confirmed by `eth_chainId`; do not confuse it with MST Mainnet.

## Run the frontend on Windows

Open PowerShell:

```powershell
git clone --branch frontend --recurse-submodules https://github.com/neilmalvalli-cyber/Provenrely.git
Set-Location Provenrely\frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. The example environment enables labelled sample data, so the UI can be explored without a backend or deployed contracts. `NEXT_PUBLIC_*` values are public in the browser: never put private keys in `frontend/.env.local`.

For a production build or checks, run `npm run build`, `npm run lint`, and `npm test` from `frontend/`. See the [frontend README](https://github.com/neilmalvalli-cyber/Provenrely/blob/frontend/frontend/README.md) for its app structure.

## Run and test the contracts

From the repository root in PowerShell:

```powershell
forge build
forge test
```

For local development, start `anvil` in another terminal. The deploy script is `script/Deploy.s.sol` and reads `DEPLOYER_PK`, `ISSUER_ADDR`, and `RELAYER_ADDR` from its environment. It deploys `ProvenrelyRegistry`, grants the issuer and relayer roles, and deploys `SafeSend`. Do not commit or print private keys.

The relevant contract methods are `getFlag`/`isFlagged`, `anchorCertificate`, `certificates`, and `logCustody` on the registry, plus `send` on SafeSend. The issuer wallet flags or revokes addresses; the relayer wallet anchors certificates. A flag's active state comes from the contract, including expiry and revocation.

## Backend and integration

The current `main` backend is a starting scaffold, not a live MST service. It can be built on Windows from `backend/` with `npm ci` and `npm run build`, but its current `/api/scan` response is simulated and its certificate endpoint does not submit an anchor transaction. Do not present those responses as chain verified.

The frontend expects these API calls at `NEXT_PUBLIC_API_URL`:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/scan` | Address verdict, score, reasons, and scan time |
| `POST /api/explain` | English or Hindi explanation of a scan |
| `POST /api/certificates` | Issue and anchor a certificate |
| `GET /api/certificates/:id` | Retrieve the certificate JSON |
| `POST /api/certificates/:id/custody` | Log a share or export |
| `GET /api/stats` | Dashboard counts from real sources |

The exact request and response types live in `frontend/lib/api/types.ts` on the `frontend` branch. The frontend hashes only a certificate's `body`: SHA-256 of UTF-8 `salt + canonicalJSON(body)`. Its verify page recomputes that hash and checks the registry independently. A real backend must use the same bytes and must never accept a client-supplied verdict as proof.

After the backend is deployed and a real scan → anchor → verify flow succeeds, set `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_REGISTRY_ADDRESS`, and `NEXT_PUBLIC_SAFESEND_ADDRESS` in the frontend environment. The current frontend client has a 15-second API timeout; on-chain certificate and custody requests may need a longer timeout.

## Demo flow

1. Flag a scam address with an issuer wallet.
2. Attempt a SafeSend transfer to it and observe the on-chain revert.
3. Scan the address and explain the result.
4. Issue a salted certificate, verify its hash and on-chain anchor, then alter a field to show tamper detection.
5. Share or export the certificate and show the custody transaction.

Only show steps backed by actual transactions as live MST results. Sample-data mode is labelled in the frontend.
