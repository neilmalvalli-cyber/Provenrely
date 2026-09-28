import { ApiError, LANGUAGES, VERDICTS, type ExplainRequest, type Explanation, type Language, type Verdict } from "../types.js";

const SUMMARY: Record<Language, Record<Verdict, string>> = {
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

const SCORE_LINE: Record<Language, (score: number) => string> = {
  en: (s) => `Risk score: ${s} out of 100.`,
  hi: (s) => `जोखिम स्कोर: 100 में से ${s}।`,
};

const NEXT_STEPS: Record<Language, string[]> = {
  en: [
    "Report the fraud at https://cybercrime.gov.in",
    "Call the national cybercrime helpline 1930",
    "Keep screenshots and transaction hashes as evidence",
  ],
  hi: [
    "https://cybercrime.gov.in पर धोखाधड़ी की शिकायत करें",
    "राष्ट्रीय साइबर अपराध हेल्पलाइन 1930 पर कॉल करें",
    "सबूत के लिए स्क्रीनशॉट और लेनदेन हैश सुरक्षित रखें",
  ],
};

/** Validates an explain request (extra fields such as scannedAt are ignored). */
export function parseExplainRequest(b: unknown): ExplainRequest {
  const r = (b ?? {}) as Record<string, unknown>;
  if (!VERDICTS.includes(r.verdict as Verdict)) throw new ApiError(400, "verdict must be SAFE, SUSPICIOUS or HIGH_RISK.");
  if (typeof r.score !== "number" || !Number.isInteger(r.score) || r.score < 0 || r.score > 100) throw new ApiError(400, "score must be an integer 0–100.");
  const language = (r.language ?? "en") as Language;
  if (!LANGUAGES.includes(language)) throw new ApiError(400, 'language must be "en" or "hi".');
  const reasons = Array.isArray(r.reasons) ? r.reasons.filter((x): x is string => typeof x === "string") : [];
  return { address: typeof r.address === "string" ? r.address : "", verdict: r.verdict as Verdict, score: r.score, reasons, language };
}

/** Plain-language explanation of a verdict, in English or Hindi, with the national reporting steps. */
export function explain(req: ExplainRequest): Explanation {
  const { language, verdict, score } = req;
  return {
    language,
    explanation: `${SUMMARY[language][verdict]} ${SCORE_LINE[language](score)}`,
    nextSteps: NEXT_STEPS[language],
  };
}
