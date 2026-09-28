/**
 * After `forge script script/Deploy.s.sol --broadcast`:
 *   1. reads broadcast/Deploy.s.sol/<chain>/run-latest.json
 *   2. prints both addresses and every tx hash with explorer links
 *   3. verifies on-chain with read-only calls: code at both addresses, ISSUER and RELAYER granted,
 *      SafeSend.registry() == registry
 *   4. only if every check passes: writes the NON-secret values into frontend/.env.local and backend/.env
 *      (other lines — including keys — are left untouched and never printed) and fills the README's
 *      "Deployed contracts" section
 *
 * Usage (from backend/):  npm run post-deploy [-- --chain 91562037 --rpc <url> --explorer <url> --no-write
 *                                               --also-frontend-env <path to another frontend/.env.local>]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, getAddress } from "ethers";
import registryAbi from "../src/abi/ProvenrelyRegistry.json" with { type: "json" };
import safeSendAbi from "../src/abi/SafeSend.json" with { type: "json" };
import { replaceBetweenMarkers, updateEnvFile } from "./env-file.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const chainId = Number(arg("chain") ?? 91562037);
const rpcUrl = arg("rpc") ?? (chainId === 91562037 ? "https://testnetrpc.mstblockchain.com" : "http://127.0.0.1:8545");
const explorerUrl = (arg("explorer") ?? "https://testnet.mstscan.com").replace(/\/+$/, "");
const write = !process.argv.includes("--no-write");

interface BroadcastTx {
  hash: string;
  transactionType: "CREATE" | "CALL" | string;
  contractName: string | null;
  contractAddress: string | null;
  function: string | null;
  arguments: string[] | null;
}
interface Receipt {
  transactionHash: string;
  blockNumber: string;
  status: string;
}

const file = join(root, "broadcast", "Deploy.s.sol", String(chainId), "run-latest.json");
if (!existsSync(file)) {
  console.error(`✗ ${relative(root, file)} not found — run the deploy first (see README → Deploy the contracts).`);
  process.exit(1);
}
const run = JSON.parse(readFileSync(file, "utf8")) as { transactions: BroadcastTx[]; receipts: Receipt[] };

const created = (name: string) => {
  const t = run.transactions.find((x) => x.transactionType === "CREATE" && x.contractName === name);
  if (!t?.contractAddress) throw new Error(`no ${name} deployment in ${relative(root, file)}`);
  return { address: getAddress(t.contractAddress), hash: t.hash };
};
const registry = created("ProvenrelyRegistry");
const safeSend = created("SafeSend");
const call = (fn: string) => run.transactions.find((x) => x.transactionType === "CALL" && x.function?.startsWith(fn));
const issuer = call("addIssuer")?.arguments?.[0];
const relayer = call("grantRole")?.arguments?.[1];
const receiptOf = (hash: string) => run.receipts.find((r) => r.transactionHash === hash);
const deployBlock = Number(receiptOf(registry.hash)?.blockNumber ?? 0);

const txLink = (h: string) => `${explorerUrl}/tx/${h}`;
const addrLink = (a: string) => `${explorerUrl}/address/${a}`;

console.log(`\nDeployment on chain ${chainId} (from ${relative(root, file)})\n`);
console.log(`ProvenrelyRegistry  ${registry.address}\n  ${addrLink(registry.address)}`);
console.log(`SafeSend            ${safeSend.address}\n  ${addrLink(safeSend.address)}`);
console.log(`Deploy block        ${deployBlock}\n\nTransactions:`);
for (const t of run.transactions) {
  const r = receiptOf(t.hash);
  const what = t.transactionType === "CREATE" ? `deploy ${t.contractName}` : `${t.contractName}.${t.function}`;
  console.log(`  ${r?.status === "0x1" ? "✓" : "✗"} ${what}\n    ${txLink(t.hash)}`);
}

// ---- on-chain verification (read-only) ----
const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
const reg = new Contract(registry.address, registryAbi, provider);
const ss = new Contract(safeSend.address, safeSendAbi, provider);
const checks: [string, boolean][] = [];
const check = async (label: string, fn: () => Promise<boolean>) => {
  let ok = false;
  try {
    ok = await fn();
  } catch (e) {
    console.error(`    (${label}: ${e instanceof Error ? e.message : e})`);
  }
  checks.push([label, ok]);
};

console.log(`\nVerifying on ${rpcUrl} …`);
await check("chain id matches", async () => Number((await provider.getNetwork()).chainId) === chainId);
await check("registry has code", async () => (await provider.getCode(registry.address)) !== "0x");
await check("SafeSend has code", async () => (await provider.getCode(safeSend.address)) !== "0x");
await check(`issuer ${issuer ?? "?"} has ISSUER`, async () => !!issuer && (await reg.getFunction("hasRole")(await reg.getFunction("ISSUER")(), issuer)));
await check(`relayer ${relayer ?? "?"} has RELAYER`, async () => !!relayer && (await reg.getFunction("hasRole")(await reg.getFunction("RELAYER")(), relayer)));
await check("SafeSend.registry() is the registry", async () => getAddress(await ss.getFunction("registry")()) === registry.address);
for (const [label, ok] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label}`);

if (checks.some(([, ok]) => !ok)) {
  console.error("\n✗ Verification failed — nothing was written.");
  process.exit(1);
}
if (!write) {
  console.log("\n--no-write: env files and README left unchanged.");
  process.exit(0);
}

// ---- write non-secret values ----
const fe = join(root, "frontend", ".env.local");
const be = join(root, "backend", ".env");
const feKeys = updateEnvFile(
  fe,
  {
    NEXT_PUBLIC_MST_CHAIN_ID: String(chainId),
    NEXT_PUBLIC_MST_RPC_URL: rpcUrl,
    NEXT_PUBLIC_MST_EXPLORER_URL: explorerUrl,
    NEXT_PUBLIC_REGISTRY_ADDRESS: registry.address,
    NEXT_PUBLIC_SAFESEND_ADDRESS: safeSend.address,
  },
  join(root, "frontend", ".env.example"),
);
const beKeys = updateEnvFile(
  be,
  {
    MST_CHAIN_ID: String(chainId),
    MST_RPC_URL: rpcUrl,
    REGISTRY_ADDRESS: registry.address,
    SAFESEND_ADDRESS: safeSend.address,
    DEPLOY_BLOCK: String(deployBlock),
  },
  join(root, "backend", ".env.example"),
);
console.log(`\nWrote ${feKeys.join(", ")} → ${relative(root, fe)}`);
// Another checkout's frontend (e.g. the one you run the dev server from): same non-secret values.
const extraFe = arg("also-frontend-env");
if (extraFe) {
  updateEnvFile(extraFe, {
    NEXT_PUBLIC_MST_CHAIN_ID: String(chainId),
    NEXT_PUBLIC_MST_RPC_URL: rpcUrl,
    NEXT_PUBLIC_MST_EXPLORER_URL: explorerUrl,
    NEXT_PUBLIC_REGISTRY_ADDRESS: registry.address,
    NEXT_PUBLIC_SAFESEND_ADDRESS: safeSend.address,
  });
  console.log(`Wrote the same NEXT_PUBLIC_* values → ${extraFe}`);
}
console.log(`Wrote ${beKeys.join(", ")} → ${relative(root, be)}  (RELAYER_PK and other secrets untouched)`);

const table = [
  "| Contract | Address |",
  "|---|---|",
  `| ProvenrelyRegistry | [\`${registry.address}\`](${addrLink(registry.address)}) |`,
  `| SafeSend | [\`${safeSend.address}\`](${addrLink(safeSend.address)}) |`,
  "",
  `Chain ID \`${chainId}\`, deploy block \`${deployBlock}\`.`,
  "",
  "| Transaction | Hash |",
  "|---|---|",
  ...run.transactions.map((t) => `| ${t.transactionType === "CREATE" ? `Deploy ${t.contractName}` : `\`${t.function?.split("(")[0]}\``} | [\`${t.hash.slice(0, 10)}…\`](${txLink(t.hash)}) |`),
].join("\n");
const readme = join(root, "README.md");
if (replaceBetweenMarkers(readme, "<!-- deployed:start -->", "<!-- deployed:end -->", table)) console.log(`Updated the Deployed contracts section → README.md`);
else console.warn("README.md has no <!-- deployed:start --> / <!-- deployed:end --> markers; section not updated.");

console.log("\nNext: restart the frontend and backend so they load the new values.");
