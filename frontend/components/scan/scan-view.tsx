"use client";

import { ExternalLink, FileCheck2, Languages, Loader2, Phone, ScanSearch } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, StatTile } from "@/components/console/kit";
import { DataField, PageHeader, PanelHeader } from "@/components/ui/panel";
import { api, errorMessage } from "@/lib/api/client";
import type { Explanation, Language, ScanResult } from "@/lib/api/types";
import { explorer } from "@/lib/chain/explorer";
import { env } from "@/lib/config/env";
import { cn, formatUtc } from "@/lib/utils";
import { VERDICT_LABEL, VerdictBadge } from "./verdict";

type Async<T> = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "done"; data: T };

const LANGS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
];

/** Scan an address → verdict, score, reasons → plain-language explanation → issue a certificate. */
export function ScanView() {
  const router = useRouter();
  const params = useSearchParams();
  const [address, setAddress] = useState(params.get("address") ?? "");
  const [touched, setTouched] = useState(false);
  const [scan, setScan] = useState<Async<ScanResult>>({ status: "idle" });
  const [language, setLanguage] = useState<Language>("en");
  const [explain, setExplain] = useState<Async<Explanation>>({ status: "idle" });
  const [issuing, setIssuing] = useState<Async<null>>({ status: "idle" });
  const valid = isAddress(address.trim(), { strict: false });

  async function runScan(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!valid) return;
    setScan({ status: "loading" });
    setExplain({ status: "idle" });
    setIssuing({ status: "idle" });
    try {
      setScan({ status: "done", data: await api.scan(address.trim()) });
    } catch (err) {
      setScan({ status: "error", message: errorMessage(err) });
    }
  }

  async function runExplain(result: ScanResult) {
    setExplain({ status: "loading" });
    try {
      setExplain({ status: "done", data: await api.explain({ ...result, language }) });
    } catch (err) {
      setExplain({ status: "error", message: errorMessage(err) });
    }
  }

  async function issue(result: ScanResult) {
    setIssuing({ status: "loading" });
    try {
      const cert = await api.createCertificate({ address: result.address, language });
      router.push(`/certificate/${encodeURIComponent(cert.id)}`);
    } catch (err) {
      setIssuing({ status: "error", message: errorMessage(err) });
    }
  }

  return (
    <>
      <PageHeader eyebrow="Scan" title="Check an address" description="Get a risk verdict for any MST address, explained in plain language, and issue a certificate anchored on MST." />

      <div className="space-y-4">
        <Card>
          <form onSubmit={runScan} className="p-5 sm:p-6">
            <Label htmlFor="address">Address</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                inputMode="text"
                className={cn("font-mono", touched && address && !valid && "border-danger/60")}
                aria-invalid={touched && !valid}
              />
              <Button type="submit" variant="primary" size="lg" className="h-11" disabled={scan.status === "loading"}>
                {scan.status === "loading" ? <Loader2 className="animate-spin" /> : <ScanSearch />}
                Scan
              </Button>
            </div>
            {touched && address && !valid && <p className="mt-2 text-[13px] text-red-300">Enter a 42-character address: 0x followed by 40 hex characters.</p>}
          </form>
        </Card>

        {scan.status === "loading" && (
          <Card>
            <div className="flex items-center gap-3 p-6 text-[14px] text-fg-2">
              <Loader2 className="size-4 animate-spin" /> Scanning the address…
            </div>
          </Card>
        )}

        {scan.status === "error" && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
              <p className="text-[14px] text-red-200">{scan.message}</p>
              <Button size="sm" onClick={() => runScan()}>
                Try again
              </Button>
            </div>
          </Card>
        )}

        {scan.status === "idle" && (
          <p className="px-1 text-[13.5px] text-muted">Enter an address to scan it. Nothing is written on-chain until you issue a certificate.</p>
        )}

        {scan.status === "done" && (
          <>
            <Card>
              <PanelHeader
                label="Result"
                title="Result"
                action={env.useMocks ? <span className="text-[12px] text-amber-200">Sample data</span> : undefined}
              />
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <div className="text-[13px] text-muted">Verdict</div>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-[44px] font-semibold leading-none tracking-[-0.035em] text-fg sm:text-[56px]">{VERDICT_LABEL[scan.data.verdict]}</span>
                      <VerdictBadge verdict={scan.data.verdict} />
                    </div>
                  </div>
                  <StatTile label="Risk score" value={<>{scan.data.score}<span className="text-[18px] font-medium text-muted"> / 100</span></>} />
                </div>
                <ul className="mt-5 space-y-2">
                  {scan.data.reasons.map((r) => (
                    <li key={r} className="flex gap-2.5 text-[14px] leading-relaxed text-fg">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-fg-2" />
                      {r}
                    </li>
                  ))}
                  {scan.data.reasons.length === 0 && <li className="text-[14px] text-muted">No specific reasons were returned.</li>}
                </ul>
                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
                  <DataField label="Address" mono>
                    <a href={explorer.address(scan.data.address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all hover:text-violet-200">
                      {scan.data.address} <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </DataField>
                  <DataField label="Scanned" mono>
                    {formatUtc(scan.data.scannedAt)}
                  </DataField>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <PanelHeader label="Explain" title="What this means" />
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="sm:w-60">
                    <Label htmlFor="lang">Language</Label>
                    <select
                      id="lang"
                      value={language}
                      onChange={(e) => {
                        setLanguage(e.target.value as Language);
                        setExplain({ status: "idle" });
                      }}
                      className="h-11 w-full rounded-lg border border-line-strong bg-black/30 px-3 text-[14px] text-fg outline-none focus:border-violet/60"
                    >
                      {LANGS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button className="h-11" onClick={() => runExplain(scan.data)} disabled={explain.status === "loading"}>
                    {explain.status === "loading" ? <Loader2 className="animate-spin" /> : <Languages />}
                    Explain
                  </Button>
                </div>

                {explain.status === "error" && <p className="mt-4 text-[13.5px] text-red-200">{explain.message}</p>}
                {explain.status === "done" && (
                  <div className="mt-5 space-y-4" lang={explain.data.language}>
                    <p className="text-[15px] leading-relaxed text-fg">{explain.data.explanation}</p>
                    <ul className="space-y-1.5">
                      {explain.data.nextSteps.map((s) => (
                        <li key={s} className="text-[14px] text-fg-2">
                          → {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* the two official channels are always shown, whatever the API returns */}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] text-fg hover:bg-white/[0.05]"
                  >
                    <ExternalLink className="size-4" /> Report at cybercrime.gov.in
                  </a>
                  <a href="tel:1930" className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] text-fg hover:bg-white/[0.05]">
                    <Phone className="size-4" /> Call helpline 1930
                  </a>
                </div>
              </div>
            </Card>

            <Card variant="dark">
              <div className="flex h-full flex-col justify-between gap-5 p-5 sm:p-6">
                <div>
                  <div className="text-[17px] font-semibold text-fg">Issue a certificate</div>
                  <p className="mt-1 text-[13.5px] text-fg-2">
                    Seals this verdict into a certificate whose hash is anchored on MST, so anyone can check it later.
                  </p>
                  {issuing.status === "error" && <p className="mt-2 text-[13.5px] text-red-200">{issuing.message}</p>}
                </div>
                <Button variant="primary" className="self-start" onClick={() => issue(scan.data)} disabled={issuing.status === "loading"}>
                  {issuing.status === "loading" ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
                  {issuing.status === "loading" ? "Issuing…" : "Issue certificate"}
                </Button>
              </div>
            </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
