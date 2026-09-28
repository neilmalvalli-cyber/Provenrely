import { describe, expect, it } from "vitest";
import { CanonicalError, canonicalize, certificateHash } from "./canonical";

/** Test vectors from backend/README.md — both sides must reproduce these byte for byte. */
const body = {
  schemaVersion: 1,
  address: "0x1111111111111111111111111111111111111111",
  verdict: "HIGH_RISK",
  score: 87,
  reasons: ["Received funds from a flagged address", "Sent to 14 new wallets within 10 minutes"],
  language: "hi",
  note: 'धोखाधड़ी "quoted"',
  scannedAt: "2026-09-28T10:15:00Z",
  issuer: "Provenrely",
};
const salt = "a3f1".repeat(16);

describe("certificateHash", () => {
  it("matches the backend test vector", async () => {
    expect(await certificateHash(body, salt)).toBe("0x89e1aba7dd040ef8837c2493071935c41a1244bdb8027dff35a05c0bdd8412f1");
  });

  it("matches the tamper test vector (verdict SAFE)", async () => {
    expect(await certificateHash({ ...body, verdict: "SAFE" }, salt)).toBe("0x3cf1dc97d956b7913a3d49837fecb6964384a87f0c40acff4316bba24b23042e");
  });

  it("rejects an invalid salt", async () => {
    await expect(certificateHash(body, "0x" + salt.slice(2))).rejects.toThrow(CanonicalError);
  });
});

describe("canonicalize", () => {
  it("sorts keys recursively, no whitespace, keeps non-ASCII unescaped", () => {
    expect(canonicalize({ b: 1, a: { d: "é", c: [2, 1] } })).toBe('{"a":{"c":[2,1],"d":"é"},"b":1}');
  });

  it("rejects null and floats", () => {
    expect(() => canonicalize({ a: null })).toThrow(CanonicalError);
    expect(() => canonicalize({ a: 1.5 })).toThrow(CanonicalError);
  });
});
