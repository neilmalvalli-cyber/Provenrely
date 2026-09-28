import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { mstTestnet } from "./mst";

/**
 * One chain (MST Testnet), one connector: the injected EIP-1193 provider. BridgeKey's in-app
 * browser injects `window.ethereum` like any standard wallet, so no custom connector is needed;
 * wallets that announce themselves via EIP-6963 are also discovered and shown by name.
 *
 * Reads go straight to the MST RPC (not through the wallet), with a timeout and retries so a slow
 * RPC degrades into a visible error state instead of a hang.
 */
export const wagmiConfig = createConfig({
  chains: [mstTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [mstTestnet.id]: http(mstTestnet.rpcUrls.default.http[0], { timeout: 12_000, retryCount: 2, retryDelay: 800 }),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
