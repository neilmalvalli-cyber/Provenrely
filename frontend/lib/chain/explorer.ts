import { env } from "@/lib/config/env";

/** Links into the MST explorer (Blockscout): every tx hash, address and block the UI shows goes through here. */
export const explorer = {
  tx: (hash: string) => `${env.explorerUrl}/tx/${hash}`,
  address: (address: string) => `${env.explorerUrl}/address/${address}`,
  block: (block: number | bigint) => `${env.explorerUrl}/block/${block.toString()}`,
};
