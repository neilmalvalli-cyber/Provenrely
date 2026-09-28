import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createChain } from "./lib/chain.js";
import { createExplorer } from "./lib/explorer.js";
import { fileStore } from "./store.js";

const config = loadConfig();
const chain = createChain(config);
const app = createApp({
  chain,
  explorer: createExplorer(config.explorerApiUrl),
  store: await fileStore(config.dataDir),
  issuerName: config.issuerName,
  corsOrigins: config.corsOrigins,
});

app.listen(config.port, () => {
  console.log(`Provenrely API on :${config.port} — registry ${chain.configured ? config.registryAddress : "not configured"}, anchoring ${chain.canWrite ? "on" : "off"}`);
});
