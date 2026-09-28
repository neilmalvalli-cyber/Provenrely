# Provenrely

Evidence infrastructure for on-chain investigations, on **MST Testnet**.

Provenrely protects a transfer in three layers, with MST as the trust layer:

| Layer | When | What it does |
|---|---|---|
| **Shield** | before a transfer | Issuers flag risky addresses on-chain; `SafeSend` reverts transfers to flagged recipients. |
| **Certificate** | during an investigation | A scan's verdict is sealed into a certificate whose hash is anchored on MST. |
| **Custody** | after | Every share or export of a certificate is logged on-chain. |

Anyone can verify a certificate without trusting our servers: the browser recomputes its hash and reads the anchor
directly from MST.

## Repository layout

```
frontend/   Next.js 16 app (React 19, TypeScript strict, Tailwind v4, wagmi + viem)
backend/    API service (Express, TypeScript, ethers) — backend/README.md has the API contract
src/        Solidity contracts (Foundry): ProvenrelyRegistry, SafeSend, Unflagged
test/       Foundry tests
script/     Foundry deploy scripts
lib/        Foundry dependencies (git submodules: forge-std, openzeppelin-contracts)
```

## Contracts

```bash
git submodule update --init --recursive
forge build
forge test
```

See https://book.getfoundry.sh/ for Foundry itself.

## Run the frontend

```bash
cd frontend
cp .env.example .env.local   # then edit values
npm install
npm run dev                  # http://localhost:3000
```

With `NEXT_PUBLIC_USE_MOCKS=true` every API call returns clearly labelled sample data, so the UI works without the
backend. On-chain reads (anchors, flags) always go to MST directly.

## Run the backend

```bash
cd backend
cp .env.example .env   # then edit values
npm ci
npm run dev            # http://localhost:8000
```

Point the frontend at it with `NEXT_PUBLIC_API_URL=http://localhost:8000` and `NEXT_PUBLIC_USE_MOCKS=false`.

## Deploy (all three parts)

1. **Contracts** — `forge script` below; note the registry and SafeSend addresses it prints.
2. **Backend** — `backend/Dockerfile` (or `npm run build && npm start`) with `REGISTRY_ADDRESS`, `RELAYER_PK` (the
   relayer granted in step 1), `CORS_ORIGIN` (the frontend URL) and a persistent `DATA_DIR`.
3. **Frontend** — any Next.js host (e.g. Vercel, root `frontend/`) with `NEXT_PUBLIC_REGISTRY_ADDRESS`,
   `NEXT_PUBLIC_SAFESEND_ADDRESS`, `NEXT_PUBLIC_API_URL` (the backend URL) and `NEXT_PUBLIC_USE_MOCKS=false`.

After changing a contract: `forge build`, then `cd frontend && npm run abi` regenerates both ABIs (CI checks this).

## MST Testnet

| | |
|---|---|
| Chain ID | `91562037` (hex `0x5752035`) |
| RPC | https://testnetrpc.mstblockchain.com |
| Explorer | https://testnet.mstscan.com |
| Currency | tMSTC, 18 decimals |
| Wallet | BridgeKey (injected EIP-1193 provider) |

## Deploy the contracts

```bash
# DEPLOYER_PK, ISSUER_ADDR, RELAYER_ADDR come from the environment (e.g. a git-ignored .env) — never pass a key on the command line
forge script script/Deploy.s.sol:Deploy --rpc-url https://testnetrpc.mstblockchain.com --chain-id 91562037 --broadcast --legacy
```

MST uses legacy (type 0) transactions, hence `--legacy`. Try the command without `--broadcast` first for a dry run.

No secrets live in this repository. Configuration comes from `.env` / `.env.local` files, which are git-ignored.
