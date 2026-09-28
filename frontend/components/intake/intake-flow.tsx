"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, FolderKanban, Lock, RotateCcw, ScanSearch } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { HashRing } from "@/components/proof/hash-ring";
import { SEVERITY, SeverityBadge } from "@/components/ui/badges";
import { Button, LinkButton } from "@/components/ui/button";
import { RiskGauge } from "@/components/ui/charts";
import { HashDisplay } from "@/components/ui/hash-display";
import { Input, Label, Textarea } from "@/components/ui/input";
import { DataField, GlassPanel, PanelHeader } from "@/components/ui/panel";
import { INTAKE_PRESETS, SCAN_STEPS, SEAL_STEPS, type IntakePreset } from "@/data/intake";
import { CURRENT_USER } from "@/data/investigators";
import { saveSessionSeal } from "@/lib/session-seals";
import { cn, formatNumber, formatUtc, mockHash, shortHash } from "@/lib/utils";
import { ProgressSteps } from "./progress-steps";
import { Stepper } from "./stepper";

const STEPS = ["Target", "Analysis", "Review", "Seal", "Sealed"];
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

type Findings = Omit<IntakePreset, "label">;

/** Stable, address-derived findings for addresses that aren't presets. */
function analyse(address: string): Findings {
  const preset = INTAKE_PRESETS.find((p) => p.address.toLowerCase() === address.toLowerCase());
  if (preset) return preset;
  const h = mockHash(address);
  const score = 45 + (parseInt(h.slice(2, 4), 16) % 45);
  return {
    address,
    riskScore: score,
    flags: [
      { name: "Cross-bridge routing", severity: score > 75 ? "high" : "medium", description: "Value moved across a bridge within 10 blocks of receipt." },
      { name: "Peel-chain pattern", severity: "medium", description: "Sequential small transfers to fresh wallets." },
      { name: "Young counterparties", severity: "low", description: "Most counterparties are under 30 days old." },
    ],
    summary: "Automated trace found bridge routing and peel-chain activity. Review the indicators before sealing.",
  };
}

export function IntakeFlow() {
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState("");
  const [title, setTitle] = useState("");
  const [touched, setTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [sealedAt, setSealedAt] = useState<string | null>(null);

  const valid = ADDRESS_RE.test(address.trim());
  const findings = useMemo(() => (valid ? analyse(address.trim()) : null), [address, valid]);
  const caseId = useMemo(() => `PR-${(parseInt(mockHash(address).slice(2, 6), 16) % 9000) + 1000}`, [address]);
  const hashes = useMemo(
    () => ({
      evidence: mockHash(`ev-${address}-${summary}`),
      merkle: mockHash(`mk-${address}-${summary}`),
      sig: mockHash(`sg-${address}`, 65),
      tx: mockHash(`tx-${address}-${summary}`),
      block: 6918244 + (parseInt(mockHash(address).slice(2, 4), 16) % 40),
    }),
    [address, summary],
  );

  const toReview = useCallback(() => {
    setSummary(findings?.summary ?? "");
    setStep(2);
  }, [findings]);
  const toSealed = useCallback(() => {
    const at = new Date().toISOString();
    saveSessionSeal({ caseId, evidence: hashes.evidence, merkle: hashes.merkle, tx: hashes.tx, block: hashes.block, sealedAt: at, target: address });
    setSealedAt(at);
    setStep(4);
  }, [caseId, hashes, address]);

  function reset() {
    setStep(0);
    setAddress("");
    setTitle("");
    setTouched(false);
    setReviewed(false);
    setSealedAt(null);
  }

  return (
    <div>
      <div className="mb-6">
        <Stepper steps={STEPS} current={step === STEPS.length - 1 ? STEPS.length : step} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <GlassPanel>
                <PanelHeader label="Step 1" title="Register the target" />
                <form
                  className="space-y-5 p-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setTouched(true);
                    if (valid) setStep(1);
                  }}
                >
                  <div>
                    <Label htmlFor="addr">Target address</Label>
                    <Input
                      id="addr"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      onBlur={() => setTouched(true)}
                      placeholder="0x…"
                      spellCheck={false}
                      autoComplete="off"
                      className={cn("font-mono", touched && address && !valid && "border-danger/60 focus:border-danger/60 focus:ring-danger/10")}
                      aria-invalid={touched && !valid}
                      aria-describedby="addr-help"
                    />
                    <p id="addr-help" className={cn("mt-2 text-[13px]", touched && address && !valid ? "text-red-300" : "text-muted")}>
                      {touched && address && !valid ? "Enter a 42-character hex address starting with 0x." : "Ethereum address (EOA or contract)."}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="title">Case title (optional)</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bridge drain — victim report 88-3104" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <DataField label="Network">Ethereum · Sepolia</DataField>
                    <DataField label="Trace depth">2 hops</DataField>
                    <DataField label="Lead">{CURRENT_USER.name}</DataField>
                  </div>
                  <div className="flex justify-end border-t border-line pt-5">
                    <Button type="submit" variant="primary" disabled={!address}>
                      <ScanSearch />
                      Run analysis
                    </Button>
                  </div>
                </form>
              </GlassPanel>

              <GlassPanel>
                <PanelHeader label="Quick start" title="Sample targets" />
                <ul className="space-y-2 p-3">
                  {INTAKE_PRESETS.map((p) => {
                    const active = address.toLowerCase() === p.address.toLowerCase();
                    return (
                      <li key={p.address}>
                        <button
                          onClick={() => {
                            setAddress(p.address);
                            setTouched(true);
                          }}
                          className={cn(
                            "w-full rounded-xl border p-3.5 text-left transition",
                            active ? "border-violet/50 bg-violet/[0.07]" : "border-line hover:border-white/10 hover:bg-white/[0.02]",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[14px] text-fg">{p.label}</span>
                            <span className="font-mono text-[12px]" style={{ color: p.riskScore >= 70 ? "#FCA5A5" : "#86EFAC" }}>
                              {p.riskScore}
                            </span>
                          </div>
                          <code className="mt-1 block font-mono text-[12px] text-muted">{shortHash(p.address, 10, 8)}</code>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </GlassPanel>
            </div>
          )}

          {step === 1 && (
            <GlassPanel className="mx-auto max-w-2xl">
              <PanelHeader label="Step 2" title="Analysing target" action={<code className="font-mono text-[12px] text-muted">{shortHash(address, 8, 6)}</code>} />
              <div className="p-5 sm:p-6">
                <ProgressSteps steps={SCAN_STEPS} onDone={toReview} stepMs={850} />
              </div>
            </GlassPanel>
          )}

          {step === 2 && findings && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <GlassPanel>
                  <PanelHeader label="Step 3" title={title || "Review findings"} />
                  <ul className="divide-y divide-line">
                    {findings.flags.map((f) => (
                      <li key={f.name} className="flex gap-4 px-5 py-4">
                        <span className="mt-1.5 h-8 w-[3px] shrink-0 rounded-full" style={{ background: SEVERITY[f.severity].color }} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-[14.5px] text-fg">{f.name}</span>
                            <SeverityBadge severity={f.severity} />
                          </div>
                          <p className="mt-1 text-[13.5px] text-fg-2">{f.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </GlassPanel>
                <GlassPanel>
                  <PanelHeader label="Narrative" title="Investigator summary" />
                  <div className="space-y-4 p-5">
                    <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} aria-label="Investigator summary" />
                    <label className="flex cursor-pointer items-start gap-3 text-[14px] text-fg-2">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                        className="mt-0.5 size-4 accent-violet-500"
                      />
                      I have reviewed these findings and approve them for sealing. The summary above will be included in the evidence bundle.
                    </label>
                    <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-5">
                      <Button variant="ghost" onClick={() => setStep(0)}>
                        <ArrowLeft />
                        Change target
                      </Button>
                      <Button variant="primary" disabled={!reviewed || !summary.trim()} onClick={() => setStep(3)}>
                        <Lock />
                        Seal evidence
                      </Button>
                    </div>
                  </div>
                </GlassPanel>
              </div>
              <GlassPanel>
                <PanelHeader label="Assessment" title="Risk score" />
                <div className="px-5 pb-5 pt-7">
                  <RiskGauge score={findings.riskScore} />
                  <div className="mt-6 space-y-3 border-t border-line pt-5">
                    <HashDisplay label="Target" value={address} />
                    <div className="grid grid-cols-2 gap-4">
                      <DataField label="Snapshot" mono>
                        #{formatNumber(hashes.block - 2)}
                      </DataField>
                      <DataField label="Indicators" mono>
                        {findings.flags.length}
                      </DataField>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </div>
          )}

          {step === 3 && (
            <GlassPanel className="mx-auto max-w-2xl" glow>
              <PanelHeader label="Step 4" title="Sealing evidence" action={<span className="font-mono text-[12px] text-muted">{caseId}</span>} />
              <div className="p-5 sm:p-6">
                <ProgressSteps
                  steps={SEAL_STEPS}
                  stepMs={800}
                  onDone={toSealed}
                  render={(k) =>
                    ({
                      hash: shortHash(hashes.evidence, 18, 12),
                      merkle: `root ${shortHash(hashes.merkle, 14, 10)}`,
                      sign: `sig ${shortHash(hashes.sig, 14, 10)}`,
                      anchor: `tx ${shortHash(hashes.tx, 14, 10)}`,
                      confirm: `included in block #${formatNumber(hashes.block)}`,
                    })[k]
                  }
                />
              </div>
            </GlassPanel>
          )}

          {step === 4 && sealedAt && (
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 flex flex-col items-center text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="grid size-14 place-items-center rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07]"
                >
                  <CheckCircle2 className="size-7 text-emerald-300" />
                </motion.div>
                <h2 className="text-title mt-5 text-fg">Evidence sealed</h2>
                <p className="mt-2 max-w-md text-[14px] text-fg-2">
                  {caseId} is anchored. Any change to the bundle will now fail verification.
                </p>
              </div>
              <GlassPanel glow className="overflow-hidden">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/[0.07] to-transparent [animation-delay:250ms]" />
                <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr_auto]">
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                    <DataField label="Case" mono>
                      {caseId}
                    </DataField>
                    <DataField label="Block" mono>
                      #{formatNumber(hashes.block)}
                    </DataField>
                    <DataField label="Sealed" mono>
                      {formatUtc(sealedAt).slice(0, 16)}
                    </DataField>
                    <DataField label="Signed by">{CURRENT_USER.name}</DataField>
                    <DataField label="Relayer" mono>
                      sldt-relayer-02.eth
                    </DataField>
                    <DataField label="Risk" mono>
                      {findings?.riskScore}
                    </DataField>
                  </div>
                  <HashRing hash={hashes.evidence} className="hidden md:block" />
                </div>
                <div className="space-y-3 border-t border-line bg-black/20 p-5 sm:p-6">
                  <HashDisplay label="Evidence hash" value={hashes.evidence} decode />
                  <HashDisplay label="Merkle root" value={hashes.merkle} decode />
                  <HashDisplay label="Anchor transaction" value={hashes.tx} decode />
                </div>
              </GlassPanel>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button variant="ghost" onClick={reset}>
                  <RotateCcw />
                  New intake
                </Button>
                <LinkButton href="/cases" variant="secondary">
                  <FolderKanban />
                  Case ledger
                </LinkButton>
                <LinkButton href={`/verify?hash=${hashes.evidence}`} variant="primary">
                  <FileCheck2 />
                  Verify this proof
                  <ArrowRight />
                </LinkButton>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
