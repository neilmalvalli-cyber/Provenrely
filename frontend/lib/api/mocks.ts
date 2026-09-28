import { certificateHash, randomSalt } from "@/lib/cert/canonical";
import { PRODUCT_NAME } from "@/lib/config/brand";
import type { Certificate, CertificateBody, CustodyAction, CustodyReceipt, ExplainRequest, Explanation, Hex, ScanResult, Stats, Verdict } from "./types";

/**
 * Sample responses for NEXT_PUBLIC_USE_MOCKS=true — same shapes as the real API, so every page
 * works end to end before the backend exists. The UI labels this mode as sample data.
 * Certificates are real (their hash verifies), but a sample certificate is NOT anchored on MST.
 */

const STORE = "provenrely:mock-certificates";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deterministic number from a string, so the same address always gets the same verdict. */
function seed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const REASONS: Record<Verdict, string[]> = {
  SAFE: ["No transfers to or from flagged addresses", "Account age and activity look normal"],
  SUSPICIOUS: ["Received funds from an address flagged by an issuer two hops away", "Unusually fast movement of funds after deposit"],
  HIGH_RISK: ["Received funds from a flagged address", "Sent to 14 new wallets within 10 minutes", "Linked to a reported investment scam"],
};

const EXPLAIN: Record<"en" | "hi", Record<Verdict, string>> = {
  en: {
    SAFE: "We found nothing that links this address to known fraud. That is not a guarantee — only send funds to people you know.",
    SUSPICIOUS: "This address is connected to activity that often appears in scams. Do not send money until you have confirmed who owns it.",
    HIGH_RISK: "This address is directly linked to flagged fraud. Do not send money to it. If you already did, report it immediately.",
  },
  hi: {
    SAFE: "हमें इस पते का किसी ज्ञात धोखाधड़ी से कोई संबंध नहीं मिला। फिर भी केवल उन्हीं लोगों को पैसे भेजें जिन्हें आप जानते हैं।",
    SUSPICIOUS: "यह पता ऐसी गतिविधि से जुड़ा है जो अक्सर धोखाधड़ी में दिखती है। मालिक की पुष्टि किए बिना पैसे न भेजें।",
    HIGH_RISK: "यह पता सीधे चिह्नित धोखाधड़ी से जुड़ा है। इसे पैसे न भेजें। अगर आप भेज चुके हैं, तो तुरंत शिकायत करें।",
  },
};

const NEXT_STEPS = {
  en: ["Report the fraud at https://cybercrime.gov.in", "Call the national cybercrime helpline 1930", "Keep screenshots and transaction hashes as evidence"],
  hi: ["https://cybercrime.gov.in पर धोखाधड़ी की शिकायत करें", "राष्ट्रीय साइबर अपराध हेल्पलाइन 1930 पर कॉल करें", "सबूत के लिए स्क्रीनशॉट और लेनदेन हैश सुरक्षित रखें"],
};

const fakeHex = (s: string): Hex => {
  let out = "";
  let h = seed(s);
  while (out.length < 64) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return `0x${out.slice(0, 64)}`;
};

function readStore(): Record<string, Certificate> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, Certificate>;
  } catch {
    return {};
  }
}
function writeStore(all: Record<string, Certificate>) {
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* storage unavailable: the certificate still works for this page view */
  }
}

export const mocks = {
  async scan(address: string): Promise<ScanResult> {
    await delay(700);
    const score = seed(address.toLowerCase()) % 101;
    const verdict: Verdict = score >= 70 ? "HIGH_RISK" : score >= 35 ? "SUSPICIOUS" : "SAFE";
    return { address, verdict, score, reasons: REASONS[verdict], scannedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") };
  },

  async explain(req: ExplainRequest): Promise<Explanation> {
    await delay(500);
    return { language: req.language, explanation: EXPLAIN[req.language][req.verdict], nextSteps: NEXT_STEPS[req.language] };
  },

  async createCertificate(input: { address: string; language: "en" | "hi" }): Promise<Certificate> {
    const scan = await mocks.scan(input.address);
    const body: CertificateBody = {
      schemaVersion: 1,
      address: scan.address,
      verdict: scan.verdict,
      score: scan.score,
      reasons: scan.reasons,
      scannedAt: scan.scannedAt,
      issuer: PRODUCT_NAME,
      language: input.language,
    };
    const salt = randomSalt();
    const certHash = await certificateHash(body, salt);
    const id = `sample_${certHash.slice(2, 14)}`;
    const cert: Certificate = {
      id,
      body,
      salt,
      // sample anchor: shaped like the real thing, but this certificate is not on MST
      anchor: { certHash, txHash: fakeHex(`tx:${certHash}`), blockNumber: 0, blockTimestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") },
    };
    writeStore({ ...readStore(), [id]: cert });
    return cert;
  },

  async getCertificate(id: string): Promise<Certificate> {
    await delay(300);
    const cert = readStore()[id];
    if (!cert) throw new Error("Certificate not found (sample certificates live in this browser only)");
    return cert;
  },

  async logCustody(id: string, action: CustodyAction): Promise<CustodyReceipt> {
    const cert = await mocks.getCertificate(id);
    await delay(500);
    return { certHash: cert.anchor!.certHash, action, txHash: fakeHex(`custody:${id}:${action}:${Date.now()}`), timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") };
  },

  async stats(): Promise<Stats> {
    await delay(300);
    return { flagsIssued: 12, certificatesAnchored: 48, transfersBlocked: 3, updatedAt: new Date().toISOString() };
  },
};
