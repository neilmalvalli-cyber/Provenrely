import { defineChain, toHex } from "viem";
import { env } from "@/lib/config/env";

/**
 * MST Testnet, defined from configuration only. The chain id comes from NEXT_PUBLIC_MST_CHAIN_ID
 * (confirmed live with eth_chainId: 0x5752035 = 91562037). Its hex form is always derived here,
 * never hardcoded — some MST materials list a wrong hex (0x5752c55).
 */
export const MST_CONFIGURED = env.chainId !== null;

export const mstTestnet = defineChain({
  // 0 is never a real chain: every chain feature checks MST_CONFIGURED before relying on the id
  id: env.chainId ?? 0,
  name: "MST Testnet",
  nativeCurrency: { name: "MST Testnet Coin", symbol: "tMSTC", decimals: 18 },
  rpcUrls: { default: { http: [env.rpcUrl] } },
  blockExplorers: { default: { name: "MSTScan", url: env.explorerUrl } },
  testnet: true,
});

export const MST_CHAIN_ID_HEX = toHex(mstTestnet.id);
