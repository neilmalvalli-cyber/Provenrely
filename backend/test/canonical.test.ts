import assert from "node:assert/strict";
import { test } from "node:test";
import { CanonicalError, canonicalize, certificateHash } from "../src/lib/canonical.js";

// Test vectors from backend/README.md — the frontend reproduces the same hashes in the browser.
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

test("matches the README test vector", () => {
  assert.equal(certificateHash(body, salt), "0x89e1aba7dd040ef8837c2493071935c41a1244bdb8027dff35a05c0bdd8412f1");
});

test("matches the tamper test vector (verdict SAFE)", () => {
  assert.equal(certificateHash({ ...body, verdict: "SAFE" }, salt), "0x3cf1dc97d956b7913a3d49837fecb6964384a87f0c40acff4316bba24b23042e");
});

test("sorts keys, no whitespace, non-ASCII kept", () => {
  assert.equal(canonicalize({ b: 1, a: { d: "é", c: [2, 1] } }), '{"a":{"c":[2,1],"d":"é"},"b":1}');
});

test("rejects null, floats and bad salts", () => {
  assert.throws(() => canonicalize({ a: null }), CanonicalError);
  assert.throws(() => canonicalize({ a: 1.5 }), CanonicalError);
  assert.throws(() => certificateHash(body, `0x${salt.slice(2)}`), CanonicalError);
});
