import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Certificate } from "./types.js";

export interface CertificateStore {
  get(id: string): Certificate | undefined;
  put(cert: Certificate): Promise<void>;
}

/** In-memory store (tests). */
export function memoryStore(): CertificateStore {
  const m = new Map<string, Certificate>();
  return { get: (id) => m.get(id), put: async (c) => void m.set(c.id, c) };
}

/**
 * Certificates in one JSON file under DATA_DIR, written atomically (temp file + rename).
 * Fine for a single instance; swap for a database before running several replicas.
 */
export async function fileStore(dataDir: string): Promise<CertificateStore> {
  const file = join(dataDir, "certificates.json");
  await mkdir(dataDir, { recursive: true });
  const m = new Map<string, Certificate>();
  try {
    for (const c of JSON.parse(await readFile(file, "utf8")) as Certificate[]) m.set(c.id, c);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  let writing = Promise.resolve();
  return {
    get: (id) => m.get(id),
    put(cert) {
      m.set(cert.id, cert);
      const snapshot = JSON.stringify([...m.values()], null, 2);
      writing = writing.then(async () => {
        await writeFile(`${file}.tmp`, snapshot);
        await rename(`${file}.tmp`, file);
      });
      return writing;
    },
  };
}
