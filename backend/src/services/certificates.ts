import { randomUUID } from "node:crypto";
import type { Chain } from "../lib/chain.js";
import { certificateHash, randomSalt } from "../lib/canonical.js";
import type { Explorer } from "../lib/explorer.js";
import type { CertificateStore } from "../store.js";
import { ApiError, LANGUAGES, type Certificate, type CertificateBody, type CustodyAction, type CustodyReceipt, type Language } from "../types.js";
import { scanAddress } from "./scan.js";

export interface CertDeps {
  chain: Chain;
  explorer: Explorer;
  store: CertificateStore;
  issuerName: string;
}

const CUSTODY_CODE: Record<CustodyAction, 1 | 2> = { share: 1, export: 2 };

/**
 * Scan → certificate body → salt + hash → anchorCertificate(hash, subject) on MST → store.
 * Without a configured relayer (local development) the certificate is stored unanchored, and the
 * frontend shows "Not anchored on MST". If anchoring is configured but fails, nothing is stored.
 */
export async function createCertificate(input: unknown, deps: CertDeps): Promise<Certificate> {
  const b = (input ?? {}) as Record<string, unknown>;
  const language = (b.language ?? "en") as Language;
  if (!LANGUAGES.includes(language)) throw new ApiError(400, 'language must be "en" or "hi".');

  const scan = await scanAddress(b.address, deps);
  const body: CertificateBody = {
    schemaVersion: 1,
    address: scan.address,
    verdict: scan.verdict,
    score: scan.score,
    reasons: scan.reasons,
    scannedAt: scan.scannedAt,
    issuer: deps.issuerName,
    language,
  };
  const salt = randomSalt();
  const certHash = certificateHash(body, salt);
  const cert: Certificate = { id: `cert_${randomUUID().replace(/-/g, "")}`, body, salt };

  if (deps.chain.canWrite) cert.anchor = await deps.chain.anchor(certHash, scan.address);
  else console.warn(`[certificates] ${cert.id} stored without an anchor (no relayer configured)`);

  await deps.store.put(cert);
  return cert;
}

export function getCertificate(id: string, store: CertificateStore): Certificate {
  const cert = store.get(id);
  if (!cert) throw new ApiError(404, "Certificate not found.");
  return cert;
}

/** Logs a share or export on-chain: logCustody(certHash, 1 | 2). */
export async function logCustody(id: string, input: unknown, deps: CertDeps): Promise<CustodyReceipt> {
  const action = ((input ?? {}) as Record<string, unknown>).action as CustodyAction;
  if (action !== "share" && action !== "export") throw new ApiError(400, 'action must be "share" or "export".');
  const cert = getCertificate(id, deps.store);
  if (!cert.anchor) throw new ApiError(409, "This certificate isn't anchored on MST, so custody can't be logged.");
  const { txHash, timestamp } = await deps.chain.logCustody(cert.anchor.certHash, CUSTODY_CODE[action]);
  return { certHash: cert.anchor.certHash, action, txHash, timestamp };
}
