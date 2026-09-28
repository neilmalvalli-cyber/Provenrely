# Deploying Provenrely

Three parts: **contracts** on MST Testnet, the **backend** API (Docker, on Render or Railway), and the **frontend**
(Next.js, on Vercel). No secret is ever committed: keys go only into the hosting dashboards or git-ignored `.env`
files.

## 0. Contracts (done once)

```bash
# repo root; DEPLOYER_PK, ISSUER_ADDR, RELAYER_ADDR in a git-ignored .env or the shell
forge script script/Deploy.s.sol:Deploy --rpc-url https://testnetrpc.mstblockchain.com --chain-id 91562037 --broadcast --legacy
cd backend && npm ci && npm run post-deploy
```

`post-deploy` verifies the deployment on-chain (code, roles, SafeSend → registry), then writes the addresses,
chain ID and deploy block into `frontend/.env.local` and `backend/.env`, and the README's Deployed contracts section.
Use those values below. MST rejects gas prices under **1 gwei**; everything here already uses at least 1 gwei.

**Fund the relayer**: send ~0.5 tMSTC to the `RELAYER_ADDR` wallet. Each certificate is one anchor transaction
(~0.0001 tMSTC at 1 gwei). Below `RELAYER_MIN_BALANCE` the API refuses new certificates with a clear error;
`GET /api/health` shows the balance.

## 1. Backend

### Option A — Render (Blueprint, `render.yaml`)

1. Render dashboard → **New +** → **Blueprint** → connect GitHub → pick the `Provenrely` repo and the branch to deploy.
2. Render reads `render.yaml`: one web service `provenrely-api` (Docker, `backend/Dockerfile`), a 1 GB disk at
   `/data`, health check `/api/health`. The disk needs a paid instance (`starter`).
3. Fill in the values it asks for (the `sync: false` ones): `CORS_ORIGIN` (your Vercel URL — you can set it after
   step 2 of the frontend and redeploy), `REGISTRY_ADDRESS`, `SAFESEND_ADDRESS`, `DEPLOY_BLOCK`, `RELAYER_PK`, and
   optionally `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL`.
4. **Apply**. When the deploy is live, open `https://<service>.onrender.com/api/health` — expect
   `"registry": true, "anchoring": true` and a relayer balance with `"low": false`.

### Option B — Railway (`backend/railway.json`)

1. Railway → **New Project** → **Deploy from GitHub repo** → pick the repo.
2. Service → **Settings** → **Source** → **Root Directory** = `backend`. Railway then uses `backend/railway.json`
   (Dockerfile build, health check `/api/health`).
3. Service → **Variables** → add the variables from the table below (at least `CORS_ORIGIN`, `REGISTRY_ADDRESS`,
   `SAFESEND_ADDRESS`, `DEPLOY_BLOCK`, `RELAYER_PK`, `TRUST_PROXY=1`, `DATA_DIR=/data`).
4. Right-click the service on the canvas → **Attach volume** (or Command palette → *Add Volume*) → mount path `/data`.
5. Service → **Settings** → **Networking** → **Generate Domain**. Open `https://<domain>/api/health` to check.

### Backend variables

| Variable | Required | Value |
|---|---|---|
| `CORS_ORIGIN` | yes | The frontend URL(s), comma-separated, e.g. `https://provenrely.vercel.app` |
| `REGISTRY_ADDRESS` | yes | From `post-deploy` |
| `SAFESEND_ADDRESS` | yes | From `post-deploy` (enables the Transfers blocked stat) |
| `DEPLOY_BLOCK` | yes | From `post-deploy` (log scans start here) |
| `RELAYER_PK` | yes | **Secret.** Key of the wallet granted `RELAYER` at deploy. Dashboard only. |
| `DATA_DIR` | yes | `/data` (the persistent volume) |
| `TRUST_PROXY` | yes | `1` behind Render/Railway, so rate limits see client IPs |
| `MST_RPC_URL` | no | `https://testnetrpc.mstblockchain.com` (default) |
| `MST_CHAIN_ID` | no | `91562037` (default) |
| `MST_LEGACY_TX` | no | `true` (default; MST uses type-0 transactions) |
| `MIN_GAS_PRICE_GWEI` | no | `1` (default; MST's minimum) |
| `EXPLORER_API_URL` | no | `https://testnet.mstscan.com/api` (default; scans + blocked-transfer count) |
| `RELAYER_MIN_BALANCE` | no | `0.01` tMSTC (default) |
| `RATE_LIMIT_CERTIFICATES` / `_CUSTODY` / `_SCAN` / `_EXPLAIN` | no | `5/3600`, `20/3600`, `30/60`, `30/60` (requests/seconds per IP) |
| `LOG_CHUNK_SIZE`, `LOG_MAX_CHUNKS_PER_REFRESH` | no | `2000`, `200` |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_MS` | no | AI explanations (`anthropic` or `openai`); without them, templates are used. `LLM_API_KEY` is a secret. |
| `ISSUER_NAME` | no | `Provenrely` |

## 2. Frontend — Vercel

1. Vercel → **Add New…** → **Project** → import the GitHub repo.
2. **Root Directory** → `frontend`. Framework preset: Next.js (detected). Build command and output: defaults.
3. **Environment Variables** (Production):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_MST_CHAIN_ID` | `91562037` |
   | `NEXT_PUBLIC_MST_RPC_URL` | `https://testnetrpc.mstblockchain.com` |
   | `NEXT_PUBLIC_MST_EXPLORER_URL` | `https://testnet.mstscan.com` |
   | `NEXT_PUBLIC_REGISTRY_ADDRESS` | from `post-deploy` |
   | `NEXT_PUBLIC_SAFESEND_ADDRESS` | from `post-deploy` |
   | `NEXT_PUBLIC_API_URL` | the backend URL, e.g. `https://provenrely-api.onrender.com` |
   | `NEXT_PUBLIC_USE_MOCKS` | `false` (also the default when unset — never `true` in production) |

   These are public by design (they are compiled into the browser bundle); none of them is a secret.
4. **Deploy**. Then set the backend's `CORS_ORIGIN` to the Vercel URL and redeploy the backend.
5. `NEXT_PUBLIC_*` values are baked in at build time: after changing one, redeploy the frontend.

## 3. Smoke test

1. `GET <backend>/api/health` → registry and anchoring `true`, relayer not low.
2. Open the site → Scan any address → Explain (Hindi) → Issue certificate → the certificate page says
   **Anchored on MST** → its QR / Verify link says **VALID** → edit a field → **TAMPERED**.
3. Share on the certificate → a custody entry appears (read from `CustodyLogged` on MST).
4. Optional: `cd backend && npm run scenario -- --dry-run`, then `npm run scenario` (keys in `backend/.env.scenario`)
   for the on-chain scam walkthrough; the dashboard's Transfers blocked count goes up.
