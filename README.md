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
backend/    API service — see backend/README.md for the contract the frontend expects
src/        Solidity contracts (Foundry): ProvenrelyRegistry
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

With `NEXT_PUBLIC_USE_MOCKS=true` every API call returns clearly labelled sample data, so the UI works before the
backend exists. On-chain reads (anchors, flags) always go to MST directly.

## MST Testnet

| | |
|---|---|
| Chain ID | `91562037` (hex `0x5752035`) |
| RPC | https://testnetrpc.mstblockchain.com |
| Explorer | https://testnet.mstscan.com |
| Currency | tMSTC, 18 decimals |
| Wallet | BridgeKey (injected EIP-1193 provider) |

No secrets live in this repository. Configuration comes from `.env.local` files, which are git-ignored.
