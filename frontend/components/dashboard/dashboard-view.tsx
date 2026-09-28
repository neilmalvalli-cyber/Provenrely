"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Flag, Loader2, ScanSearch, ShieldCheck, ShieldHalf } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePublicClient } from "wagmi";
import { GlassPanel, PageHeader, PanelHeader } from "@/components/ui/panel";
import { api } from "@/lib/api/client";
import { explorer } from "@/lib/chain/explorer";
import { reasonLabel } from "@/lib/chain/flags";
import { mstTestnet } from "@/lib/chain/mst";
import { anchorEvents, flagEvents, fromUnix, REGISTRY_READY } from "@/lib/chain/registry";
import { PRODUCT_NAME } from "@/lib/config/brand";
import { env } from "@/lib/config/env";
import { formatNumber, formatUtc, shortHash } from "@/lib/utils";

const RECENT = 5;

const LINKS = [
  { href: "/scan", label: "Scan", text: "Risk verdict for an address, explained in English or Hindi.", icon: ScanSearch },
  { href: "/verify", label: "Verify", text: "Check a certificate against its anchor on MST.", icon: ShieldCheck },
  { href: "/shield", label: "Shield", text: "Send tMSTC with an on-chain block on flagged recipients.", icon: ShieldHalf },
  { href: "/issuer", label: "Issuer", text: "Issue and revoke fraud flags.", icon: Flag },
];

/** Live overview: counts from the API, recent anchors and flags from MST. Unavailable numbers show "—". */
export function DashboardView() {
  const client = usePublicClient({ chainId: mstTestnet.id });
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const anchors = useQuery({
    queryKey: ["recent-anchors"],
    enabled: REGISTRY_READY && !!client,
    queryFn: async () => (await anchorEvents(client!)).slice(-RECENT).reverse(),
  });
  const flags = useQuery({
    queryKey: ["recent-flags"],
    enabled: REGISTRY_READY && !!client,
    queryFn: async () => (await flagEvents(client!)).slice(-RECENT).reverse(),
  });

  const stat = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n));

  return (
    <>
      <PageHeader eyebrow={PRODUCT_NAME} title="Dashboard" description="Live counts and the latest certificates and flags on MST." />

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Flags issued", stats.data?.flagsIssued],
            ["Certificates anchored", stats.data?.certificatesAnchored],
            ["Transfers blocked", stats.data?.transfersBlocked],
          ] as const
        ).map(([label, n]) => (
          <GlassPanel key={label}>
            <div className="p-5">
              <div className="text-[13px] text-muted">{label}</div>
              <div className="mt-2 font-mono text-[28px] tabular-nums text-fg">{stats.isLoading ? "…" : stat(n)}</div>
            </div>
          </GlassPanel>
        ))}
      </div>
      <p className="mt-2 px-1 text-[12.5px] text-muted">
        {stats.error
          ? `Stats unavailable: ${stats.error.message}`
          : stats.data
            ? `${env.useMocks ? "Sample data (mock mode) · " : ""}Updated ${formatUtc(stats.data.updatedAt)}`
            : null}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LINKS.map(({ href, label, text, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-2xl border border-line p-5 hover:border-white/10 hover:bg-white/[0.02]">
            <div className="flex items-center gap-2 text-[15px] font-medium text-fg">
              <Icon className="size-4 text-violet-300" /> {label}
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{text}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <GlassPanel>
          <PanelHeader title="Recent certificates" action={<span className="text-[12.5px] text-muted">CertificateAnchored on MST</span>} />
          <Recent query={anchors} empty="No certificates anchored yet.">
            {anchors.data?.map((a) => (
              <Row
                key={a.txHash}
                main={<span className="font-mono">{shortHash(a.certHash, 10, 8)}</span>}
                sub={
                  <>
                    subject{" "}
                    <a href={explorer.address(a.subject)} target="_blank" rel="noreferrer" className="font-mono hover:underline">
                      {shortHash(a.subject, 6, 4)}
                    </a>{" "}
                    · {formatUtc(fromUnix(a.timestamp))}
                  </>
                }
                tx={a.txHash}
              />
            ))}
          </Recent>
        </GlassPanel>

        <GlassPanel>
          <PanelHeader title="Recent flags" action={<span className="text-[12.5px] text-muted">Flagged on MST</span>} />
          <Recent query={flags} empty="No flags issued yet.">
            {flags.data?.map((f) => (
              <Row
                key={f.txHash}
                main={
                  <a href={explorer.address(f.subject)} target="_blank" rel="noreferrer" className="font-mono hover:underline">
                    {shortHash(f.subject, 8, 6)}
                  </a>
                }
                sub={
                  <>
                    {reasonLabel(f.reason)} · expires {f.expiry === 0n ? "never" : formatUtc(fromUnix(f.expiry))}
                  </>
                }
                tx={f.txHash}
              />
            ))}
          </Recent>
        </GlassPanel>
      </div>
    </>
  );
}

function Recent({ query, empty, children }: { query: { isLoading: boolean; error: Error | null; data?: unknown[] }; empty: string; children: ReactNode }) {
  const msg = (text: ReactNode, cls = "text-muted") => <p className={`p-5 text-[14px] ${cls}`}>{text}</p>;
  if (!REGISTRY_READY) return msg("The registry isn't configured yet.");
  if (query.isLoading)
    return msg(
      <span className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Reading MST…
      </span>,
      "text-fg-2",
    );
  if (query.error) return msg(`Couldn't read MST: ${query.error.message}`, "text-red-300");
  if (!query.data?.length) return msg(empty);
  return <ul className="divide-y divide-line">{children}</ul>;
}

function Row({ main, sub, tx }: { main: ReactNode; sub: ReactNode; tx: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3 text-[13.5px]">
      <div className="min-w-0">
        <div className="truncate text-fg">{main}</div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted">{sub}</div>
      </div>
      <a href={explorer.tx(tx)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-mono text-[12px] text-violet-300 hover:text-violet-200">
        {shortHash(tx, 6, 4)} <ExternalLink className="size-3" />
      </a>
    </li>
  );
}
