import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createChain } from "./lib/chain.js";
import { createExplorer } from "./lib/explorer.js";
import { createLlm } from "./lib/llm.js";
import { fileStore } from "./store.js";

const config = loadConfig();
const chain = createChain(config);
const llm = createLlm();
const app = createApp({
  chain,
  explorer: createExplorer(config.explorerApiUrl),
  store: await fileStore(config.dataDir),
  issuerName: config.issuerName,
  corsOrigins: config.corsOrigins,
  llm,
  relayerMinBalance: config.relayerMinBalance,
  trustProxy: config.trustProxy,
  limits: config.limits,
  logs: {
    startBlock: config.deployBlock,
    chunkSize: config.logChunkSize,
    maxChunksPerRefresh: config.maxChunksPerRefresh,
    safeSendAddress: config.safeSendAddress,
  },
});

app.listen(config.port, () => {
  console.log(`Provenrely API on :${config.port} — registry ${chain.configured ? config.registryAddress : "not configured"}, anchoring ${chain.canWrite ? "on" : "off"}, explanations ${llm ? llm.name : "templates"}`);
});
