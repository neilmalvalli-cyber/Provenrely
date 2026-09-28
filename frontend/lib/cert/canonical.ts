/**
 * Certificate hashing, shared by every page (and mirrored byte-for-byte by the backend):
 *
 *   canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
 *   hash      = "0x" + sha256_hex(utf8(salt + canonical))
 *
 * Only `body` is hashed; `salt` is prepended; `anchor` (added after anchoring) is never hashed.
 * Body rules: ASCII keys, integers only, ISO 8601 UTC timestamps as strings, no null (keys omitted).
 */

export type CanonicalValue = string | number | boolean | CanonicalValue[] | { [key: string]: CanonicalValue };

export class CanonicalError extends Error {}

/** Sort object keys recursively, stringify every leaf with standard JSON escaping, no whitespace. */
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

export function isValidSalt(salt: string) {
  return SALT_RE.test(salt);
}

/** SHA-256 over UTF-8(salt + canonical(body)), as 0x-prefixed lowercase hex. Uses Web Crypto. */
export async function certificateHash(body: unknown, salt: string): Promise<`0x${string}`> {
  if (!isValidSalt(salt)) throw new CanonicalError("salt must be 64 lowercase hex characters without 0x");
  const bytes = new TextEncoder().encode(salt + canonicalize(body));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

/** A fresh random salt (32 bytes, lowercase hex). */
export function randomSalt(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
