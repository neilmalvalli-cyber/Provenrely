/**
 * Scam scenario on MST Testnet, with tiny amounts:
 *   1. funder → victim (amount + a little for gas)
 *   2. victim → scammer              (the scam)
 *   3. scammer → hop1 → hop2         (laundering hops)
 *   4. issuer flags the scammer on the registry
 *   5. SafeSend.send(scammer) reverts on-chain with RecipientFlagged
 * Every tx hash and explorer link is written to scenario-output.json (repo root).
 *
 * Keys come only from the environment — backend/.env.scenario (git-ignored) or the shell — never printed.
 * Chain and contract settings come from backend/.env (written by `npm run post-deploy`).
 *
 * Usage (from backend/):  npm run scenario -- --dry-run     (plan + checks only, sends nothing)
 *                         npm run scenario                  (runs it)
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, Wallet, formatEther, getAddress, isAddress, parseEther, type TransactionRequest } from "ethers";
import registryAbi from "../src/abi/ProvenrelyRegistry.json" with { type: "json" };
import safeSendAbi from "../src/abi/SafeSend.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
dotenv.config({ path: join(here, "..", ".env.scenario"), quiet: true });
dotenv.config({ path: join(here, "..", ".env"), quiet: true });

const dryRun = process.argv.includes("--dry-run");
const env = (k: string) => process.env[k]?.trim() || undefined;

const chainId = Number(env("MST_CHAIN_ID") ?? 91562037);
const rpcUrl = env("MST_RPC_URL") ?? "https://testnetrpc.mstblockchain.com";
const explorer = (env("SCENARIO_EXPLORER_URL") ?? "https://testnet.mstscan.com").replace(/\/+$/, "");
const legacy = (env("MST_LEGACY_TX") ?? "true") !== "false";
const registryAddress = env("REGISTRY_ADDRESS");
const safeSendAddress = env("SAFESEND_ADDRESS");
const amount = parseEther(env("SCENARIO_AMOUNT") ?? "0.01");
const gasBuffer = parseEther(env("SCENARIO_GAS_BUFFER") ?? "0.002");
const probe = parseEther(env("SCENARIO_SAFESEND_AMOUNT") ?? "0.001");
const REASON_INVESTMENT_SCAM = 2;

const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
const wallet = (k: string) => {
  const key = env(k);
  if (!key) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`${k} must be 0x followed by 64 hex characters`);
  return new Wallet(key, provider);
};
const funder = wallet("SCENARIO_FUNDER_PK");
const victim = wallet("SCENARIO_VICTIM_PK");
const scammer = wallet("SCENARIO_SCAMMER_PK");
const hop1 = wallet("SCENARIO_HOP1_PK");
const issuer = wallet("SCENARIO_ISSUER_PK");
const hop2Address = env("SCENARIO_HOP2_ADDRESS");

// Each hop keeps a little for its own gas.
const plan = {
  fundVictim: amount + gasBuffer,
  drain: amount,
  hop1: amount - gasBuffer / 2n,
  hop2: amount - gasBuffer,
};

const missing = [
  ["SCENARIO_FUNDER_PK", funder],
  ["SCENARIO_VICTIM_PK", victim],
  ["SCENARIO_SCAMMER_PK", scammer],
  ["SCENARIO_HOP1_PK", hop1],
  ["SCENARIO_ISSUER_PK", issuer],
  ["SCENARIO_HOP2_ADDRESS", hop2Address && isAddress(hop2Address) ? hop2Address : null],
  ["REGISTRY_ADDRESS", registryAddress],
  ["SAFESEND_ADDRESS", safeSendAddress],
].filter(([, v]) => !v).map(([k]) => k as string);

const who = (w: Wallet | null, name: string) => w?.address ?? `(set ${name})`;
const tMSTC = (v: bigint) => `${formatEther(v)} tMSTC`;

console.log(`\nScam scenario on chain ${chainId} (${rpcUrl})${dryRun ? " — DRY RUN, nothing will be sent" : ""}\n`);
console.log("Accounts:");
console.log(`  funder   ${who(funder, "SCENARIO_FUNDER_PK")}`);
console.log(`  victim   ${who(victim, "SCENARIO_VICTIM_PK")}`);
console.log(`  scammer  ${who(scammer, "SCENARIO_SCAMMER_PK")}`);
console.log(`  hop1     ${who(hop1, "SCENARIO_HOP1_PK")}`);
console.log(`  hop2     ${hop2Address ?? "(set SCENARIO_HOP2_ADDRESS)"}`);
console.log(`  issuer   ${who(issuer, "SCENARIO_ISSUER_PK")}`);
console.log("\nPlan:");
console.log(`  1. funder  → victim   ${tMSTC(plan.fundVictim)}`);
console.log(`  2. victim  → scammer  ${tMSTC(plan.drain)}   (the scam)`);
console.log(`  3. scammer → hop1     ${tMSTC(plan.hop1)}`);
console.log(`  4. hop1    → hop2     ${tMSTC(plan.hop2)}`);
console.log(`  5. issuer flags the scammer (reason ${REASON_INVESTMENT_SCAM}: Investment scam, expires in 30 days)`);
console.log(`  6. funder  → SafeSend.send(scammer) ${tMSTC(probe)} → expected to revert with RecipientFlagged`);

if (missing.length) {
  console.log(`\nMissing: ${missing.join(", ")} (put keys in backend/.env.scenario — see scenario.env.example)`);
  process.exit(dryRun ? 0 : 1);
}

const registry = new Contract(registryAddress!, registryAbi, provider);
const [issuerRole, issuerOk, funderBal, issuerBal, flagged] = await Promise.all([
  registry.getFunction("ISSUER")(),
  registry.getFunction("ISSUER")().then((role: string) => registry.getFunction("hasRole")(role, issuer!.address)),
  provider.getBalance(funder!.address),
  provider.getBalance(issuer!.address),
  registry.getFunction("isFlagged")(scammer!.address),
]);
void issuerRole;
const needFunder = plan.fundVictim + probe + gasBuffer;
console.log("\nChecks:");
console.log(`  ${issuerOk ? "✓" : "✗"} issuer holds ISSUER`);
console.log(`  ${funderBal >= needFunder ? "✓" : "✗"} funder balance ${tMSTC(funderBal)} (needs ~${tMSTC(needFunder)})`);
console.log(`  ${issuerBal >= gasBuffer ? "✓" : "✗"} issuer balance ${tMSTC(issuerBal)} (needs gas)`);
console.log(`  ${flagged ? "•" : "✓"} scammer ${flagged ? "is already flagged — step 5 will be skipped" : "not flagged yet"}`);
if (!issuerOk || funderBal < needFunder || issuerBal < gasBuffer) {
  console.error("\n✗ Checks failed — fund the wallets / grant the role first.");
  process.exit(1);
}
if (dryRun) {
  console.log("\nDry run complete. Run without --dry-run to send.");
  process.exit(0);
}

// ---- run ----
const overrides = async (): Promise<TransactionRequest> => (legacy ? { type: 0, gasPrice: (await provider.getFeeData()).gasPrice ?? undefined } : {});
const steps: { step: string; from: string; to: string; amount?: string; txHash: string; link: string; status: "success" | "reverted" }[] = [];

async function record(step: string, from: string, to: string, value: bigint | undefined, send: () => Promise<{ hash: string }>) {
  const tx = await send();
  const receipt = await provider.waitForTransaction(tx.hash, 1, 180_000);
  const status = receipt?.status === 1 ? "success" : "reverted";
  steps.push({ step, from, to, amount: value !== undefined ? formatEther(value) : undefined, txHash: tx.hash, link: `${explorer}/tx/${tx.hash}`, status });
  console.log(`  ${status === "success" ? "✓" : "↯"} ${step}\n    ${explorer}/tx/${tx.hash}`);
  return status;
}
const transfer = async (from: Wallet, to: string, value: bigint, step: string) =>
  record(step, from.address, to, value, async () => from.sendTransaction({ to, value, ...(await overrides()) }));

console.log("\nRunning:");
await transfer(funder!, victim!.address, plan.fundVictim, "fund victim");
await transfer(victim!, scammer!.address, plan.drain, "victim → scammer (scam)");
await transfer(scammer!, hop1!.address, plan.hop1, "scammer → hop1");
await transfer(hop1!, getAddress(hop2Address!), plan.hop2, "hop1 → hop2");

if (!flagged) {
  const evidence = `0x${createHash("sha256").update(JSON.stringify(steps.map((s) => s.txHash))).digest("hex")}`;
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400);
  const reg = registry.connect(issuer!) as Contract;
  await record("issuer flags scammer", issuer!.address, registryAddress!, undefined, async () =>
    reg.getFunction("flag")(scammer!.address, REASON_INVESTMENT_SCAM, evidence, expiry, await overrides()),
  );
}

// Fixed gas limit: the wallet doesn't pre-estimate, so the transfer is mined and reverts on-chain.
const ss = new Contract(safeSendAddress!, safeSendAbi, funder!);
const blocked = await record("SafeSend.send(scammer) — expected revert", funder!.address, safeSendAddress!, probe, async () =>
  ss.getFunction("send")(scammer!.address, { value: probe, gasLimit: 150_000n, ...(await overrides()) }),
);

const out = join(root, "scenario-output.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      chainId,
      explorer,
      registry: registryAddress,
      safeSend: safeSendAddress,
      accounts: { funder: funder!.address, victim: victim!.address, scammer: scammer!.address, hop1: hop1!.address, hop2: getAddress(hop2Address!), issuer: issuer!.address },
      steps,
      finishedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
console.log(`\n${blocked === "reverted" ? "✓ SafeSend blocked the transfer on-chain." : "✗ SafeSend did NOT revert — check the flag."}`);
console.log(`Wrote scenario-output.json`);
process.exit(blocked === "reverted" ? 0 : 1);
