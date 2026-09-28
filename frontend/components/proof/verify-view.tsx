"use client";

import { CheckCircle2, ExternalLink, FileUp, Loader2, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge, Card } from "@/components/console/kit";
import { DataField, PageHeader, PanelHeader } from "@/components/ui/panel";
import { api, errorMessage } from "@/lib/api/client";
import { CanonicalError, certificateHash, isValidSalt } from "@/lib/cert/canonical";
import { explorer } from "@/lib/chain/explorer";
import { mstTestnet } from "@/lib/chain/mst";
import { findAnchorEvent, fromUnix, readAnchoredAt, REGISTRY_READY, type AnchorEvent } from "@/lib/chain/registry";
import { env } from "@/lib/config/env";
import { formatUtc } from "@/lib/utils";

/** What we need from a certificate file. `anchor` is informational only — the verdict never trusts it. */
type Loaded = { id: string | null; body: Record<string, unknown>; salt: string; recordedHash: string | null; source: string };

type Check =
  | { state: "checking" }
  | { state: "invalid"; message: string }
  | { state: "unconfigured"; hash: string }
  | { state: "error"; hash: string; message: string }
  | { state: "tampered"; hash: string }
  | { state: "valid"; hash: string; at: bigint; event: AnchorEvent | null };

type Scalar = string | number | boolean;
const isScalar = (v: unknown): v is Scalar => typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/** Parse pasted/uploaded JSON into a certificate. Throws a readable message on bad input. */
function parseCertificate(text: string, source: string): Loaded {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That isn't valid JSON. Paste or upload the certificate file exactly as exported.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("A certificate is a JSON object with body and salt.");
  const d = data as Record<string, unknown>;
  if (!d.body || typeof d.body !== "object" || Array.isArray(d.body)) throw new Error("The certificate has no body object.");
  if (typeof d.salt !== "string" || !isValidSalt(d.salt)) throw new Error("The certificate's salt must be 64 lowercase hex characters (no 0x).");
  const anchor = d.anchor && typeof d.anchor === "object" ? (d.anchor as Record<string, unknown>) : null;
  return {
    id: typeof d.id === "string" ? d.id : null,
    body: d.body as Record<string, unknown>,
    salt: d.salt,
    recordedHash: anchor && typeof anchor.certHash === "string" ? anchor.certHash.toLowerCase() : null,
    source,
  };
}

/**
 * Verify a certificate without trusting the backend: the hash is recomputed here from body + salt,
 * and the verdict comes only from certificates(hash) on MST (timestamp 0 = never anchored).
 */
export function VerifyView() {
  const params = useSearchParams();
  const certId = params.get("cert");
  const client = usePublicClient({ chainId: mstTestnet.id });

  const [paste, setPaste] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [tamper, setTamper] = useState(false);
  const [field, setField] = useState("");
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<Check>({ state: "checking" });

  const scalarKeys = loaded ? Object.keys(loaded.body).filter((k) => isScalar(loaded.body[k])).sort() : [];

  const load = useCallback((next: Loaded) => {
    const first = "verdict" in next.body && isScalar(next.body.verdict) ? "verdict" : (Object.keys(next.body).find((k) => isScalar(next.body[k])) ?? "");
    setLoaded(next);
    setLoadError(null);
    setTamper(false);
    setField(first);
    setValue(first ? String(next.body[first]) : "");
  }, []);

  function loadText(text: string, source: string) {
    try {
      load(parseCertificate(text, source));
    } catch (e) {
      setLoaded(null);
      setLoadError(errorMessage(e));
    }
  }

  // ?cert=<id>: fetch the file from the API. Only the file comes from there; the verdict below does not.
  useEffect(() => {
    if (!certId) return;
    let live = true;
    setFetching(true);
    api
      .getCertificate(certId)
      .then((c) => {
        if (live) load({ id: c.id, body: { ...c.body }, salt: c.salt, recordedHash: c.anchor?.certHash.toLowerCase() ?? null, source: "link" });
      })
      .catch((e) => live && setLoadError(`Couldn't load certificate ${certId}: ${errorMessage(e)}`))
      .finally(() => live && setFetching(false));
    return () => {
      live = false;
    };
  }, [certId, load]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) return setLoadError("That file is too large to be a certificate (max 1 MB).");
    loadText(await file.text(), `file ${file.name}`);
  }

  const verify = useCallback(async () => {
    if (!loaded) return;
    // The body actually hashed: as loaded, or with one field edited when the tamper toggle is on.
    let body = loaded.body;
    if (tamper && field) {
      const orig = loaded.body[field];
      let next: Scalar = value;
      if (typeof orig === "number" && /^-?\d+$/.test(value.trim())) next = Number(value.trim());
      if (typeof orig === "boolean" && (value === "true" || value === "false")) next = value === "true";
      body = { ...loaded.body, [field]: next };
    }
    setCheck({ state: "checking" });
    let hash: `0x${string}`;
    try {
      hash = await certificateHash(body, loaded.salt);
    } catch (e) {
      return setCheck({ state: "invalid", message: e instanceof CanonicalError ? `Not a valid certificate body: ${e.message}` : errorMessage(e) });
    }
    if (!REGISTRY_READY || !client) return setCheck({ state: "unconfigured", hash });
    try {
      const at = await readAnchoredAt(client, hash);
      if (at === 0n) return setCheck({ state: "tampered", hash });
      const event = await findAnchorEvent(client, hash).catch(() => null);
      setCheck({ state: "valid", hash, at, event });
    } catch (e) {
      setCheck({ state: "error", hash, message: errorMessage(e) });
    }
  }, [loaded, client, tamper, field, value]);

  // Re-verify when the certificate or the edited field changes (debounced while typing).
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => void verify(), tamper ? 300 : 0);
    return () => clearTimeout(t);
  }, [loaded, tamper, verify]);

  const hash = "hash" in check ? check.hash : null;
  const recordedMismatch = !tamper && hash !== null && loaded?.recordedHash ? hash !== loaded.recordedHash : false;

  return (
    <>
      <PageHeader
        eyebrow="Verify"
        title="Verify a certificate"
        description="The certificate's hash is recomputed in your browser and checked against MST. No account needed, and the verdict doesn't depend on our server."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <PanelHeader label="Step 1" title="Load a certificate" />
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <Label htmlFor="cert-file">Upload the exported JSON</Label>
                <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-dashed border-line-strong px-3.5 text-[14px] text-fg-2 hover:bg-white/[0.03]">
                  <FileUp className="size-4" /> Choose a .json file
                  <input id="cert-file" type="file" accept="application/json,.json" onChange={onFile} className="sr-only" />
                </label>
              </div>
              <div>
                <Label htmlFor="cert-paste">…or paste it</Label>
                <Textarea
                  id="cert-paste"
                  rows={6}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder='{"id":"cert_…","body":{…},"salt":"…"}'
                  spellCheck={false}
                  className="font-mono text-[12.5px]"
                />
                <Button className="mt-2" onClick={() => loadText(paste, "pasted JSON")} disabled={!paste.trim()}>
                  <ShieldCheck /> Verify pasted certificate
                </Button>
              </div>
              {fetching && (
                <p className="flex items-center gap-2 text-[13.5px] text-fg-2">
                  <Loader2 className="size-4 animate-spin" /> Loading certificate {certId}…
                </p>
              )}
              {loadError && <p className="text-[13.5px] text-red-300">{loadError}</p>}
              {loaded && (
                <p className="text-[13px] text-muted">
                  Loaded from {loaded.source}
                  {loaded.id ? ` · ${loaded.id}` : ""}
                </p>
              )}
            </div>
          </Card>

          {loaded && (
            <Card>
              <PanelHeader label="Step 2" title="Result" />
              <div className="space-y-5 p-5 sm:p-6">
                <VerdictBlock check={check} onRetry={() => void verify()} />

                <DataField label="Certificate hash (SHA-256, recomputed in your browser)" mono>
                  <span className="break-all">{hash ?? "—"}</span>
                </DataField>
                {recordedMismatch && (
                  <p className="flex items-start gap-2 text-[13px] text-amber-200">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <span className="break-all">The hash written in the file ({loaded.recordedHash}) doesn&apos;t match the recomputed one.</span>
                  </p>
                )}

                <div className="border-t border-line pt-5">
                  <label className="flex items-center gap-2 text-[14px] text-fg">
                    <input type="checkbox" checked={tamper} onChange={(e) => setTamper(e.target.checked)} className="size-4" />
                    Edit a field (see what tampering does)
                  </label>
                  {tamper && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)]">
                      <select
                        aria-label="Field"
                        value={field}
                        onChange={(e) => {
                          setField(e.target.value);
                          setValue(String(loaded.body[e.target.value] ?? ""));
                        }}
                        className="h-11 w-full rounded-lg border border-line-strong bg-black/30 px-3 text-[14px] text-fg outline-none focus:border-violet/60"
                      >
                        {scalarKeys.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <Input aria-label="New value" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} className="font-mono" />
                      <p className="text-[12.5px] text-muted sm:col-span-2">
                        Changing any character changes the hash, so it no longer matches what was anchored on MST. The edit stays in this browser.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card variant="dark">
            <PanelHeader label="How it works" title="What is checked" />
            <ol className="space-y-3 p-5 text-[13.5px] leading-relaxed text-fg-2">
              <li>
                <span className="font-mono text-violet-300">1.</span> The body is serialised canonically (sorted keys, no spaces) and prefixed with the salt.
              </li>
              <li>
                <span className="font-mono text-violet-300">2.</span> Its SHA-256 is computed in your browser.
              </li>
              <li>
                <span className="font-mono text-violet-300">3.</span> MST is asked when that exact hash was anchored (<code className="font-mono">certificates(hash)</code>). Never anchored means the
                content changed.
              </li>
            </ol>
          </Card>
          {env.useMocks && (
            <Card className="flex items-start gap-3 px-5 py-4 text-[13px] text-fg-2">
              <Badge tone="warn">Mock mode</Badge>
              <span>Sample certificates hash correctly but are not anchored on MST.</span>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function VerdictBlock({ check, onRetry }: { check: Check; onRetry: () => void }) {
  if (check.state === "checking")
    return (
      <p className="flex items-center gap-2 text-[14px] text-fg-2">
        <Loader2 className="size-4 animate-spin" /> Recomputing the hash and reading MST…
      </p>
    );
  if (check.state === "invalid") return <p className="text-[14px] text-red-300">{check.message}</p>;
  if (check.state === "unconfigured")
    return <p className="text-[14px] text-amber-200">Can&apos;t check MST: the registry contract isn&apos;t configured yet. The hash below was computed locally.</p>;
  if (check.state === "error")
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-red-300">Couldn&apos;t reach MST: {check.message}</p>
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  if (check.state === "tampered")
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[44px] font-semibold leading-none tracking-[-0.035em] text-fg sm:text-[56px]">TAMPERED</span>
          <Badge tone="danger">
            <XCircle className="size-3.5" /> Not anchored
          </Badge>
        </div>
        <div>
          <p className="mt-3 text-[14px] text-fg-2">This hash was never anchored on MST: the certificate was changed after it was issued, or it was never anchored.</p>
        </div>
      </div>
    );
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[44px] font-semibold leading-none tracking-[-0.035em] text-fg sm:text-[56px]">VALID</span>
        <Badge tone="ok">
          <CheckCircle2 className="size-3.5" /> Anchored on MST
        </Badge>
      </div>
      <div className="min-w-0">
        <p className="mt-3 text-[14px] text-fg-2">This exact certificate was anchored on MST at {formatUtc(fromUnix(check.at))} (block time, UTC).</p>
        {check.event && (
          <div className="mt-2 flex flex-wrap gap-4 font-mono text-[12.5px]">
            <a href={explorer.tx(check.event.txHash)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong px-3 text-fg-2 hover:text-fg">
              Anchor tx <ExternalLink className="size-3" />
            </a>
            <a href={explorer.block(check.event.blockNumber)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong px-3 text-fg-2 hover:text-fg">
              Block #{check.event.blockNumber.toString()} <ExternalLink className="size-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
