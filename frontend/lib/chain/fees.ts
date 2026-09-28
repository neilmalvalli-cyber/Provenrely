import { parseGwei, type PublicClient } from "viem";

/** MST rejects gas prices (and tips) below 1 gwei. */
export const MIN_GAS_PRICE = parseGwei("1");

/**
 * Fee fields for wallet transactions on MST: a legacy gas price of max(RPC price, 1 gwei). MST's base fee
 * is 0 and it uses type-0 transactions, so passing an explicit legacy price keeps wallets from choosing
 * an EIP-1559 tip below the minimum.
 */
export async function mstFees(client: PublicClient | undefined): Promise<{ type: "legacy"; gasPrice: bigint }> {
  let price = 0n;
  try {
    price = client ? await client.getGasPrice() : 0n;
  } catch {
    /* RPC unavailable: fall back to the minimum */
  }
  return { type: "legacy", gasPrice: price > MIN_GAS_PRICE ? price : MIN_GAS_PRICE };
}
