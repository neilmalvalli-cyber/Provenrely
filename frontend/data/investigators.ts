import type { Investigator } from "./types";

export const INVESTIGATORS: Record<string, Investigator> = {
  vance: { name: "Marcus Vance", role: "Lead Investigator", unit: "Digital Evidence Unit", initials: "MV" },
  rostova: { name: "Elena Rostova", role: "Special Agent", unit: "Financial Crimes", initials: "ER" },
  oconnor: { name: "Devlin O'Connor", role: "Inspector", unit: "Cross-Border Fraud", initials: "DO" },
  park: { name: "Hana Park", role: "Forensic Analyst", unit: "Digital Evidence Unit", initials: "HP" },
};

export const CURRENT_USER = INVESTIGATORS.vance;
