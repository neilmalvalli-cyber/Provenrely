import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { activeFlagsFromEvents, isActiveFlag } from "./flags";
import type { FlagEvent, RevokeEvent } from "./registry";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;
const ISSUER = "0x00000000000000000000000000000000000000ee" as Address;
const future = BigInt(Math.floor(Date.now() / 1000) + 86_400);
const past = BigInt(Math.floor(Date.now() / 1000) - 86_400);
const tx = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;

const flag = (subject: Address, block: number, expiry = future): FlagEvent => ({
  subject,
  issuer: ISSUER,
  reason: 1,
  evidenceHash: tx(0),
  expiry,
  txHash: tx(block),
  blockNumber: BigInt(block),
});
const revoke = (subject: Address, block: number): RevokeEvent => ({ subject, by: ISSUER, txHash: tx(1000 + block), blockNumber: BigInt(block) });

describe("activeFlagsFromEvents", () => {
  it("keeps the latest flag per subject, newest first", () => {
    const out = activeFlagsFromEvents([flag(A, 1), flag(B, 2), flag(A, 3)], []);
    expect(out.map((f) => [f.subject, f.blockNumber])).toEqual([
      [A, 3n],
      [B, 2n],
    ]);
  });

  it("drops a flag revoked at or after it, but not one re-issued after a revoke", () => {
    expect(activeFlagsFromEvents([flag(A, 1)], [revoke(A, 2)])).toEqual([]);
    expect(activeFlagsFromEvents([flag(A, 1)], [revoke(A, 1)])).toEqual([]);
    expect(activeFlagsFromEvents([flag(A, 1), flag(A, 5)], [revoke(A, 2)])).toHaveLength(1);
  });

  it("drops expired flags; expiry 0 never expires", () => {
    expect(activeFlagsFromEvents([flag(A, 1, past), flag(B, 1, 0n)], []).map((f) => f.subject)).toEqual([B]);
  });

  it("matches subjects case-insensitively", () => {
    expect(activeFlagsFromEvents([flag(A, 1)], [revoke(A.toUpperCase().replace("0X", "0x") as Address, 2)])).toEqual([]);
  });
});

describe("isActiveFlag", () => {
  const base = { issuer: ISSUER, reason: 1, evidenceHash: tx(0), expiry: future, revoked: false };
  it("is false for an empty record, a revoked or an expired flag", () => {
    expect(isActiveFlag({ ...base, issuer: "0x0000000000000000000000000000000000000000" })).toBe(false);
    expect(isActiveFlag({ ...base, revoked: true })).toBe(false);
    expect(isActiveFlag({ ...base, expiry: past })).toBe(false);
    expect(isActiveFlag(base)).toBe(true);
  });
});
