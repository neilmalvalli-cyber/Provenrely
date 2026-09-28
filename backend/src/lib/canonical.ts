import { createHash, randomBytes } from "node:crypto";

/**
 * Certificate hashing — byte-for-byte the same as frontend/lib/cert/canonical.ts:
 *
 *   canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
 *   hash      = "0x" + sha256_hex(utf8(salt + canonical))
 *
 * Only `body` is hashed; `salt` is prepended (not inside the body); `anchor` is never hashed.
 * Body rules: ASCII keys, integers only, ISO 8601 UTC timestamps as strings, no null (keys omitted).
 */

export class CanonicalError extends Error {}

export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) throw new CanonicalError("null/undefined is not allowed in a certificate body — omit the key");
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new CanonicalError(`Only integers are allowed in a certificate body (got ${value})`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      // keys are ASCII only, so code-unit order (JS) equals code-point order (Python)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  throw new CanonicalError(`Unsupported value in a certificate body: ${typeof value}`);
}

const SALT_RE = /^[0-9a-f]{64}$/;

export function certificateHash(body: unknown, salt: string): `0x${string}` {
  if (!SALT_RE.test(salt)) throw new CanonicalError("salt must be 64 lowercase hex characters without 0x");
  return `0x${createHash("sha256").update(salt + canonicalize(body), "utf8").digest("hex")}`;
}

export const randomSalt = () => randomBytes(32).toString("hex");
