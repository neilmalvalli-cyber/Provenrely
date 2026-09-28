"use client";

import { BadgeCheck, Download, ExternalLink, Loader2, Share2, TriangleAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePublicClient } from "wagmi";
import { Card } from "@/components/console/kit";
import { VERDICT_LABEL, VerdictBadge } from "@/components/scan/verdict";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api/client";
import type { Certificate, CustodyAction } from "@/lib/api/types";
import { certificateHash } from "@/lib/cert/canonical";
import { explorer } from "@/lib/chain/explorer";
import { mstTestnet } from "@/lib/chain/mst";
import { custodyEvents, findAnchorEvent, fromUnix, readAnchoredAt, REGISTRY_READY, type CustodyEvent } from "@/lib/chain/registry";
import { PRODUCT_WORDMARK } from "@/lib/config/brand";
import { env } from "@/lib/config/env";
import { formatUtc, shortHash } from "@/lib/utils";

type Anchor =
  | { state: "checking" }
  | { state: "unconfigured" }
  | { state: "error"; message: string }
  | { state: "none" }
  | { state: "anchored"; at: bigint; txHash: `0x${string}` | null; blockNumber: bigint | null };

const ACTION_NAME: Record<number, string> = { 1: "Shared", 2: "Exported" };

function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 bg-[var(--doc-bg)] px-5 py-4">
      <div className="text-[11.5px] text-[var(--doc-muted)]">{label}</div>
      <div className={`mt-1 break-words text-[13.5px] text-[var(--doc-fg)] ${mono ? "font-mono text-[12.5px]" : ""}`}>{children}</div>
    </div>
  );
}

function Hash({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="mt-1.5 flex items-start gap-2 rounded-[var(--radius-tile)] border border-line bg-panel-2 px-3.5 py-2.5">
        <code className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-fg">{value}</code>
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="shrink-0 text-fg-2 hover:text-fg" aria-label={`${label} on MSTScan`}>
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}

/** A certificate: its fields, its hash (recomputed here), its anchor (read from MST), QR to verify, custody. */
export function CertificateView({ id }: { id: string }) {
  const toast = useToast();
  const client = usePublicClient({ chainId: mstTestnet.id });
  const [cert, setCert] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "done"; data: Certificate }>({ status: "loading" });
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [anchor, setAnchor] = useState<Anchor>({ state: "checking" });
  const [custody, setCustody] = useState<{ status: "loading" | "idle" } | { status: "error"; message: string } | { status: "done"; data: CustodyEvent[] }>({ status: "idle" });
  const [busy, setBusy] = useState<CustodyAction | null>(null);
  const [verifyUrl, setVerifyUrl] = useState(`/verify?cert=${encodeURIComponent(id)}`);

  useEffect(() => setVerifyUrl(`${window.location.origin}/verify?cert=${encodeURIComponent(id)}`), [id]);

  useEffect(() => {
    let live = true;
    api
      .getCertificate(id)
      .then(async (c) => {
        if (!live) return;
        setCert({ status: "done", data: c });
        setHash(await certificateHash(c.body, c.salt));
      })
      .catch((e) => live && setCert({ status: "error", message: errorMessage(e) }));
    return () => {
      live = false;
    };
  }, [id]);

  const loadChain = useCallback(async () => {
    if (!hash) return;
    if (!REGISTRY_READY || !client) return setAnchor({ state: "unconfigured" });
    setAnchor({ state: "checking" });
    try {
      const at = await readAnchoredAt(client, hash);
      if (at === 0n) return setAnchor({ state: "none" });
      const ev = await findAnchorEvent(client, hash).catch(() => null);
      setAnchor({ state: "anchored", at, txHash: ev?.txHash ?? null, blockNumber: ev?.blockNumber ?? null });
      setCustody({ status: "loading" });
      custodyEvents(client, hash, ev?.blockNumber ?? 0n)
        .then((data) => setCustody({ status: "done", data }))
        .catch((e) => setCustody({ status: "error", message: errorMessage(e) }));
    } catch (e) {
      setAnchor({ state: "error", message: errorMessage(e) });
    }
  }, [hash, client]);

  useEffect(() => void loadChain(), [loadChain]);

  async function custodyAction(action: CustodyAction, c: Certificate) {
    setBusy(action);
    try {
      let copied = true;
      if (action === "share") {
        // Share sheet → clipboard → show the link. Only a cancelled share sheet stops here; a refused
        // clipboard (in-app browsers, non-HTTPS) must not block logging the share.
        let shared = false;
        if (navigator.share) {
          const outcome = await navigator.share({ title: `Certificate ${c.id}`, url: verifyUrl }).then(
            () => "shared" as const,
            (e: unknown) => (e instanceof DOMException && e.name === "AbortError" ? ("cancelled" as const) : ("failed" as const)),
          );
          if (outcome === "cancelled") return;
          shared = outcome === "shared";
        }
        if (!shared) copied = (await navigator.clipboard?.writeText(verifyUrl).then(() => true, () => false)) ?? false;
      } else {
        const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${c.id}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      const receipt = await api.logCustody(c.id, action);
      toast({
        title: action === "share" ? "Shared — custody logged" : "Exported — custody logged",
        description: copied ? `tx ${shortHash(receipt.txHash, 10, 6)}` : `Copy this link to share it: ${verifyUrl}`,
      });
      void loadChain();
    } catch (e) {
      toast({ title: "Custody wasn't logged", description: errorMessage(e), tone: "info" });
    } finally {
      setBusy(null);
    }
  }

  if (cert.status === "loading")
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[14px] text-[var(--doc-muted)]">
        <Loader2 className="size-4 animate-spin" /> Loading certificate…
      </div>
    );
  if (cert.status === "error")
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <div className="text-[17px] font-medium text-[var(--doc-fg)]">Certificate not available</div>
        <p className="mt-2 text-[14px] text-[var(--doc-fg-2)]">{cert.message}</p>
      </div>
    );

  const c = cert.data;
  const b = c.body;
  const recordMatches = hash !== null && c.anchor ? hash === c.anchor.certHash.toLowerCase() : null;
  const txHash = anchor.state === "anchored" ? (anchor.txHash ?? c.anchor?.txHash ?? null) : null;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px] print:block">
      {env.useMocks && (
        <p className="no-print flex items-center gap-2.5 rounded-[var(--radius-card)] bg-[#fff] px-5 py-3 text-[13px] text-fg-2 shadow-[var(--shadow-card)] xl:col-span-2">
          <span className="size-2 shrink-0 rounded-full bg-warn" />
          Sample certificate (mock mode): its hash is real and verifiable, but it is not anchored on MST.
        </p>
      )}
      <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--doc-line)] bg-[var(--doc-bg)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-6 border-b border-[var(--doc-line)] p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--doc-accent)]">
              <BadgeCheck className="size-4" /> Risk certificate
            </div>
            <h1 className="mt-2 break-all font-mono text-[18px] text-[var(--doc-fg)] sm:text-[20px]">{c.id}</h1>
            <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <div className="text-[12.5px] text-[var(--doc-muted)]">Verdict</div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="text-[40px] font-semibold leading-none tracking-[-0.035em] text-[var(--doc-fg)]">{VERDICT_LABEL[b.verdict]}</span>
                  <VerdictBadge verdict={b.verdict} />
                </div>
              </div>
              <div>
                <div className="text-[12.5px] text-[var(--doc-muted)]">Risk score</div>
                <div className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-[var(--doc-fg)]">
                  {b.score}
                  <span className="text-[16px] font-medium text-[var(--doc-muted)]"> / 100</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--doc-line)] p-6 sm:p-8">
          <h2 className="mb-3 text-[14px] font-medium text-[var(--doc-fg)]">Reasons</h2>
          <ul className="space-y-1.5">
            {b.reasons.map((r) => (
              <li key={r} className="text-[14px] leading-relaxed text-[var(--doc-fg-2)]">
                • {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-px border-b border-[var(--doc-line)] bg-[var(--doc-line)] sm:grid-cols-2">
          <Field label="Address" mono>
            <a href={explorer.address(b.address)} target="_blank" rel="noreferrer" className="hover:underline">
              {b.address}
            </a>
          </Field>
          <Field label="Scan time (UTC)" mono>
            {formatUtc(b.scannedAt)}
          </Field>
          <Field label="Issuer">{b.issuer}</Field>
          <Field label="Anchored at (block time, UTC)" mono>
            {anchor.state === "anchored" ? formatUtc(fromUnix(anchor.at)) : "—"}
          </Field>
        </div>

        <div className="border-b border-[var(--doc-line)] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[14px] font-medium text-[var(--doc-fg)]">Chain of custody</h2>
            <div className="no-print flex gap-2">
              {(["share", "export"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => custodyAction(a, c)}
                  disabled={busy !== null}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--doc-line)] px-4 text-[13px] text-[var(--doc-fg)] hover:bg-[var(--doc-inset)] disabled:opacity-50"
                >
                  {busy === a ? <Loader2 className="size-4 animate-spin" /> : a === "share" ? <Share2 className="size-4" /> : <Download className="size-4" />}
                  {a === "share" ? "Share" : "Export JSON"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 text-[13.5px] text-[var(--doc-fg-2)]">
            {anchor.state !== "anchored" ? (
              <p>Custody events are read from MST once the certificate is anchored.</p>
            ) : custody.status === "loading" ? (
              <p className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Reading custody events from MST…
              </p>
            ) : custody.status === "error" ? (
              <p className="text-red-600">Couldn&apos;t read custody events: {custody.message}</p>
            ) : custody.status === "done" && custody.data.length === 0 ? (
              <p>No shares or exports logged yet.</p>
            ) : custody.status === "done" ? (
              <ul className="divide-y divide-[var(--doc-line)] rounded-[var(--radius-tile)] border border-[var(--doc-line)]">
                {custody.data.map((e) => (
                  <li key={`${e.txHash}-${e.action}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="text-[var(--doc-fg)]">{ACTION_NAME[e.action] ?? `Action ${e.action}`}</span>
                    <a href={explorer.address(e.actor)} target="_blank" rel="noreferrer" className="font-mono text-[12px] hover:underline">
                      {shortHash(e.actor, 6, 4)}
                    </a>
                    <span className="font-mono text-[12px]">{formatUtc(fromUnix(e.timestamp))}</span>
                    <a href={explorer.tx(e.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] text-[var(--doc-accent)] hover:underline">
                      {shortHash(e.txHash, 8, 6)} <ExternalLink className="size-3" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-6 text-[12px] text-[var(--doc-muted)] sm:p-8">
          <span>Verify independently: recompute SHA-256(salt + canonical body) and read certificates(hash) on MST (timestamp 0 = not anchored).</span>
          <span className="shrink-0 font-mono tracking-[0.2em]">{PRODUCT_WORDMARK}</span>
        </div>
      </article>
      <Card variant="dark" className="overflow-hidden xl:sticky xl:top-10">
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <h2 className="text-[17px] font-semibold text-fg">Proof</h2>
          <p className="mt-0.5 text-[13px] text-muted">Hash, anchor status and a link anyone can check</p>
          <div className="mt-4">
            <AnchorBadge anchor={anchor} txHash={txHash} />
          </div>
        </div>
            <div className="space-y-4 border-t border-line px-5 py-5 sm:px-6">
            <Hash label="Certificate hash (SHA-256, recomputed in your browser)" value={hash ?? "computing…"} />
            {recordMatches === false && (
              <p className="flex items-center gap-2 text-[13px] text-red-300">
                <TriangleAlert className="size-4" /> This does not match the hash recorded by the issuer — the certificate was altered.
              </p>
            )}
            {txHash ? <Hash label="Anchor transaction" value={txHash} href={explorer.tx(txHash)} /> : <Hash label="Anchor transaction" value="—" />}
            {anchor.state === "anchored" && anchor.blockNumber !== null && (
              <a href={explorer.block(anchor.blockNumber)} target="_blank" rel="noreferrer" className="inline-block font-mono text-[12.5px] text-fg-2 hover:underline">
                Block #{anchor.blockNumber.toString()}
              </a>
            )}
          </div>

        <div className="flex items-center gap-4 border-t border-line px-5 py-5 sm:px-6">
          <div className="rounded-[var(--radius-tile)] bg-[#fff] p-2.5">
            <QRCodeSVG value={verifyUrl} size={104} />
          </div>
          <p className="text-[12.5px] leading-relaxed text-muted">Scan to verify this certificate on any phone. No account needed.</p>
        </div>
      </Card>
    </div>
  );
}

function AnchorBadge({ anchor, txHash }: { anchor: Anchor; txHash: `0x${string}` | null }) {
  const base = "inline-flex min-h-7 items-center gap-1.5 rounded-[14px] border px-3 py-1 text-[12.5px] leading-snug";
  if (anchor.state === "anchored")
    return (
      <a
        href={txHash ? explorer.tx(txHash) : env.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className={`${base} border-line-strong text-fg-2 hover:text-fg hover:underline`}
      >
        <span className="size-2 rounded-full bg-ok" /> Anchored on MST
      </a>
    );
  const text = {
    checking: "Checking MST…",
    unconfigured: "Anchor not checked — registry not configured",
    none: "Not anchored on MST",
    error: "Couldn't reach MST",
  }[anchor.state];
  const dot = anchor.state === "none" || anchor.state === "error" ? "bg-danger" : anchor.state === "checking" ? "bg-muted" : "bg-warn";
  return (
    <span className={`${base} border-line-strong text-fg-2`}>
      <span className={`size-2 shrink-0 rounded-full ${dot}`} /> {text}
    </span>
  );
}
