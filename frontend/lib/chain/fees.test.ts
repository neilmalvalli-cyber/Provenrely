import { describe, expect, it } from "vitest";
import { parseGwei, type PublicClient } from "viem";
import { MIN_GAS_PRICE, mstFees } from "./fees";

const client = (getGasPrice: () => Promise<bigint>) => ({ getGasPrice }) as unknown as PublicClient;

describe("mstFees", () => {
  it("never goes below 1 gwei (MST's minimum)", async () => {
    expect(MIN_GAS_PRICE).toBe(parseGwei("1"));
    expect(await mstFees(client(async () => parseGwei("0.1")))).toEqual({ type: "legacy", gasPrice: parseGwei("1") });
  });

  it("uses the RPC price when it is higher", async () => {
    expect(await mstFees(client(async () => parseGwei("2.5")))).toEqual({ type: "legacy", gasPrice: parseGwei("2.5") });
  });

  it("falls back to the minimum when the RPC fails or there is no client", async () => {
    expect((await mstFees(client(async () => Promise.reject(new Error("down"))))).gasPrice).toBe(parseGwei("1"));
    expect((await mstFees(undefined)).gasPrice).toBe(parseGwei("1"));
  });
});
