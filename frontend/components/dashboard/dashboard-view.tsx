"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Circle, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Address, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { Badge, Card, CardHeader, ProgressBar, ProgressRing, StatTile, Tile } from "@/components/console/kit";
import { api } from "@/lib/api/client";
import { explorer } from "@/lib/chain/explorer";
import { activeFlagsFromEvents, reasonLabel } from "@/lib/chain/flags";
import { mstTestnet } from "@/lib/chain/mst";
import { anchorEvents, flagEvents, fromUnix, REGISTRY_READY, revokeEvents, type FlagEvent, type RevokeEvent } from "@/lib/chain/registry";
import { env } from "@/lib/config/env";
import { cn, formatNumber, formatUtc, shortHash } from "@/lib/utils";

const RECENT = 5;
const DAY = 86_400;
/** Flag events carry no timestamp; only the newest ones get their block time read (for the chart and the list). */
const FLAG_TIMES = 60;

const QUICK = [
  { href: "/scan", label: "Scan an address", text: "Risk verdict, explained in English or Hindi." },
  { href: "/scan", label: "Issue a certificate", text: "Seal a scan result and anchor its hash on MST." },
  { href: "/verify", label: "Verify a certificate", text: "Recompute the hash and check it on MST." },
  { href: "/shield", label: "Test the Shield", text: "Send tMSTC with an on-chain block on flagged recipients." },
];

type FlagState = "active" | "revoked" | "expired";

/** Per subject: the latest flag and what happened to it (same rule as activeFlagsFromEvents). */
function flagStates(flags: FlagEvent[], revokes: RevokeEvent[]) {
  const latest = new Map<string, FlagEvent>();
  for (const f of flags) {
    const key = f.subject.toLowerCase();
    const prev = latest.get(key);
    if (!prev || f.blockNumber >= prev.blockNumber) latest.set(key, f);
  }
  const active = new Set(activeFlagsFromEvents(flags, revokes).map((f) => f.txHash));
  const state = (f: FlagEvent): FlagState => {
    if (active.has(f.txHash)) return "active";
    const revoked = revokes.some((r) => r.subject.toLowerCase() === f.subject.toLowerCase() && r.blockNumber >= f.blockNumber);
    return revoked ? "revoked" : "expired";
  };
  const counts = { active: 0, revoked: 0, expired: 0 };
  const issuers = new Set<Address>();
  for (const f of latest.values()) {
    const s = state(f);
    counts[s] += 1;
    if (s === "active") issuers.add(f.issuer.toLowerCase() as Address);
  }
  return { counts, subjects: latest.size, activeIssuers: issuers.size, state };
}

async function blockTimes(client: PublicClient, blocks: bigint[]) {
  const unique = [...new Set(blocks.map(String))].map(BigInt);
  const entries = await Promise.all(unique.map(async (b) => [String(b), (await client.getBlock({ blockNumber: b })).timestamp] as const));
  return new Map(entries);
}

/** Live overview: counts from the API, everything else from registry events on MST. Unavailable values show "—". */
export function DashboardView() {
  const client = usePublicClient({ chainId: mstTestnet.id });
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const anchors = useQuery({
    queryKey: ["anchor-events"],
    enabled: REGISTRY_READY && !!client,
    queryFn: () => anchorEvents(client!),
  });
  const flags = useQuery({
    queryKey: ["flag-events"],
    enabled: REGISTRY_READY && !!client,
    queryFn: async () => {
      const [all, revokes] = await Promise.all([flagEvents(client!), revokeEvents(client!)]);
      const times = await blockTimes(client!, all.slice(-FLAG_TIMES).map((f) => f.blockNumber)).catch(() => new Map<string, bigint>());
      return { all, revokes, times };
    },
  });

  const stat = (n: number | undefined) => (stats.isLoading ? "…" : n === undefined ? "—" : formatNumber(n));
  const health = flags.data ? flagStates(flags.data.all, flags.data.revokes) : null;
  const chainValue = (n: number | undefined) => (!REGISTRY_READY ? "—" : flags.isLoading ? "…" : n === undefined ? "—" : formatNumber(n));

  // Last 7 UTC days, oldest first.
  const today = Math.floor(Date.now() / 1000 / DAY);
  const days = Array.from({ length: 7 }, (_, i) => today - 6 + i);
  const perDay = (times: bigint[]) => days.map((d) => times.filter((t) => Math.floor(Number(t) / DAY) === d).length);
  const anchorSeries = anchors.data ? perDay(anchors.data.map((a) => a.timestamp)) : null;
  const flagSeries = flags.data
    ? perDay(flags.data.all.map((f) => flags.data!.times.get(String(f.blockNumber))).filter((t): t is bigint => t !== undefined))
    : null;
  const weekAnchors = anchorSeries?.reduce((a, b) => a + b, 0);

  const recentAnchors = anchors.data?.slice(-RECENT).reverse();
  const recentFlags = flags.data?.all.slice(-RECENT).reverse();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      {/* Overview */}
      <Card variant="dark" className="p-6 sm:p-7 lg:col-span-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-fg">Overview</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {stats.error
                ? `Stats unavailable: ${stats.error.message}`
                : stats.data
                  ? `${env.useMocks ? "Sample data · " : ""}Updated ${formatUtc(stats.data.updatedAt)}`
                  : "Registry counts"}
            </p>
          </div>
          <Link href="/issuer" className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-fg hover:bg-white/15" aria-label="Open Issuer">
            <ArrowUpRight className="size-[18px]" />
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-6">
          <StatTile size="lg" label="Flags issued" value={stat(stats.data?.flagsIssued)} />
          <StatTile size="lg" label="Certificates anchored" value={stat(stats.data?.certificatesAnchored)} />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-[12.5px] text-muted">
            <span>Anchored in the last 7 days</span>
            <span className="tabular-nums text-fg-2">
              {weekAnchors === undefined || !anchors.data ? "—" : `${formatNumber(weekAnchors)} of ${formatNumber(anchors.data.length)}`}
            </span>
          </div>
          <ProgressBar value={anchors.data?.length ? (weekAnchors ?? 0) / anchors.data.length : null} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <Tile className="bg-white/[0.07] p-3 sm:p-4">
            <StatTile label="Active flags" value={chainValue(health?.counts.active)} />
          </Tile>
          <Tile className="bg-white/[0.07] p-3 sm:p-4">
            <StatTile label="Transfers blocked" value={stat(stats.data?.transfersBlocked)} />
          </Tile>
          <Tile className="bg-white/[0.07] p-3 sm:p-4">
            <StatTile label="Active issuers" value={chainValue(health?.activeIssuers)} />
          </Tile>
        </div>
      </Card>

      {/* Registry health */}
      <Card className="flex flex-col lg:col-span-5">
        <CardHeader title="Registry health" subtitle="Flagged addresses whose latest flag is still active" />
        <div className="flex flex-1 flex-col items-center gap-6 p-6 sm:flex-row sm:justify-around">
          <ProgressRing value={health && health.subjects ? health.counts.active / health.subjects : null} size={148} label="active" />
          <ul className="w-full max-w-[200px] space-y-3 text-[13.5px]">
            {(
              [
                ["Active", health?.counts.active, "bg-fg"],
                ["Revoked", health?.counts.revoked, "bg-fg/40"],
                ["Expired", health?.counts.expired, "bg-fg/15"],
              ] as const
            ).map(([label, n, dot]) => (
              <li key={label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-fg-2">
                  <span className={cn("size-2.5 rounded-full", dot)} /> {label}
                </span>
                <span className="font-semibold tabular-nums text-fg">{chainValue(n)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-line pt-3 text-muted">
              <span>Flagged addresses</span>
              <span className="tabular-nums">{chainValue(health?.subjects)}</span>
            </li>
          </ul>
        </div>
        <ChainNote query={flags} />
      </Card>

      {/* Weekly activity */}
      <Card className="lg:col-span-8">
        <CardHeader
          title="Weekly activity"
          subtitle="Certificates anchored and flags issued per day (UTC), from MST events"
          action={
            <div className="flex items-center gap-4 text-[12.5px] text-fg-2">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-fg" /> Anchors
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-fg/50" /> Flags
              </span>
            </div>
          }
        />
        <div className="px-4 pb-5 pt-3 sm:px-6">
          <WeeklyChart days={days} anchors={anchorSeries} flags={flagSeries} loading={anchors.isLoading || flags.isLoading} />
        </div>
      </Card>

      {/* Quick actions */}
      <Card className="lg:col-span-4">
        <CardHeader title="Quick actions" subtitle="Everything the console does" />
        <ul className="space-y-1 p-3 sm:p-4">
          {QUICK.map((q) => (
            <li key={q.label}>
              <Link href={q.href} className="group flex items-center gap-3 rounded-[var(--radius-tile)] p-3 hover:bg-panel-2">
                <Circle className="size-5 shrink-0 text-fg/30 group-hover:text-fg" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-fg">{q.label}</span>
                  <span className="block truncate text-[12.5px] text-muted">{q.text}</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted group-hover:text-fg" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {/* Recent certificates */}
      <Card className="lg:col-span-6">
        <CardHeader title="Recent certificates" subtitle="CertificateAnchored on MST" />
        <Recent query={anchors} empty="No certificates anchored yet.">
          {recentAnchors?.map((a) => (
            <Row
              key={a.txHash}
              badge={<Badge tone="ok">Anchored</Badge>}
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
      </Card>

      {/* Recent flags */}
      <Card variant="dark" className="lg:col-span-6">
        <CardHeader title="Recent flags" subtitle="Flagged on MST" />
        <Recent query={flags} empty="No flags issued yet.">
          {recentFlags?.map((f) => {
            const s = health?.state(f);
            const at = flags.data?.times.get(String(f.blockNumber));
            return (
              <Row
                key={f.txHash}
                badge={s && <Badge tone={s === "active" ? "danger" : "neutral"}>{s === "active" ? "Active" : s === "revoked" ? "Revoked" : "Expired"}</Badge>}
                main={
                  <a href={explorer.address(f.subject)} target="_blank" rel="noreferrer" className="font-mono hover:underline">
                    {shortHash(f.subject, 8, 6)}
                  </a>
                }
                sub={
                  <>
                    {reasonLabel(f.reason)}
                    {at !== undefined && <> · {formatUtc(fromUnix(at))}</>} · expires {f.expiry === 0n ? "never" : formatUtc(fromUnix(f.expiry))}
                  </>
                }
                tx={f.txHash}
              />
            );
          })}
        </Recent>
      </Card>
    </div>
  );
}

/** Two series over seven days. No data → an empty state, never invented points. */
function WeeklyChart({ days, anchors, flags, loading }: { days: number[]; anchors: number[] | null; flags: number[] | null; loading: boolean }) {
  const W = 640, H = 200, PAD = { l: 28, r: 8, t: 12, b: 26 };
  const series = [anchors, flags].filter((s): s is number[] => s !== null);
  const max = Math.max(0, ...series.flat());
  const empty = !REGISTRY_READY || (!loading && (series.length === 0 || max === 0));
  const label = (d: number) => new Date(d * DAY * 1000).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });

  if (loading)
    return (
      <div className="flex h-[200px] items-center justify-center gap-2 text-[13.5px] text-fg-2">
        <Loader2 className="size-4 animate-spin" /> Reading MST…
      </div>
    );
  if (empty)
    return (
      <div className="flex h-[200px] flex-col items-center justify-center rounded-[var(--radius-tile)] border border-dashed border-line-strong text-center">
        <div className="text-[14px] font-medium text-fg">No activity this week</div>
        <p className="mt-1 max-w-xs text-[12.5px] text-muted">
          {REGISTRY_READY ? "Anchors and flags will appear here as they land on MST." : "The registry isn't configured yet."}
        </p>
      </div>
    );

  const top = Math.max(1, Math.ceil(max * 1.15));
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (days.length - 1);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, Math.round(top / 2), top];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Anchors and flags per day for the last seven days">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
          <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--color-muted)] text-[11px]">
            {t}
          </text>
        </g>
      ))}
      {days.map((d, i) => (
        <text key={d} x={x(i)} y={H - 6} textAnchor="middle" className="fill-[var(--color-muted)] text-[11px]">
          {label(d)}
        </text>
      ))}
      {anchors && (
        <>
          <path d={path(anchors)} fill="none" stroke="#0b0b0c" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {anchors.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="#fff" stroke="#0b0b0c" strokeWidth={2} />
          ))}
        </>
      )}
      {flags && <path d={path(flags)} fill="none" stroke="#0b0b0c" strokeOpacity={0.45} strokeWidth={2} strokeDasharray="5 5" strokeLinejoin="round" />}
    </svg>
  );
}

function ChainNote({ query }: { query: { isLoading: boolean; error: Error | null } }) {
  if (!REGISTRY_READY) return <p className="px-6 pb-5 text-[12.5px] text-muted">The registry isn&apos;t configured yet.</p>;
  if (query.error) return <p className="px-6 pb-5 text-[12.5px] text-red-300">Couldn&apos;t read MST: {query.error.message}</p>;
  return null;
}

function Recent({ query, empty, children }: { query: { isLoading: boolean; error: Error | null; data?: unknown }; empty: string; children: ReactNode }) {
  const msg = (text: ReactNode, cls = "text-muted") => <p className={`px-6 pb-6 pt-4 text-[14px] ${cls}`}>{text}</p>;
  if (!REGISTRY_READY) return msg("The registry isn't configured yet.");
  if (query.isLoading)
    return msg(
      <span className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Reading MST…
      </span>,
      "text-fg-2",
    );
  if (query.error) return msg(`Couldn't read MST: ${query.error.message}`, "text-red-300");
  const items = Array.isArray(children) ? children : [children];
  if (!items.filter(Boolean).length) return msg(empty);
  return <ul className="divide-y divide-line px-2 pb-3 pt-2 sm:px-3">{children}</ul>;
}

function Row({ main, sub, tx, badge }: { main: ReactNode; sub: ReactNode; tx: string; badge?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-3 text-[13.5px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-fg">{main}</span>
          {badge}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted">{sub}</div>
      </div>
      <a
        href={explorer.tx(tx)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line-strong px-3 font-mono text-[12px] text-fg-2 hover:text-fg"
      >
        {shortHash(tx, 6, 4)} <ExternalLink className="size-3" />
      </a>
    </li>
  );
}
