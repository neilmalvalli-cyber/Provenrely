"use client";

import { useBlockNumber } from "wagmi";
import { explorer } from "@/lib/chain/explorer";
import { MST_CONFIGURED, mstTestnet } from "@/lib/chain/mst";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Live MST Testnet status, read from the RPC (not the wallet), so it works before anyone
 * connects. A slow or unreachable RPC shows as such — never as a made-up block height.
 */
export function NetworkStatus({ className }: { className?: string }) {
  const { data: block, isPending, isError } = useBlockNumber({
    chainId: mstTestnet.id,
    watch: MST_CONFIGURED,
    query: { enabled: MST_CONFIGURED },
  });

  const state = !MST_CONFIGURED ? "unconfigured" : isError ? "error" : isPending ? "loading" : "ok";
  const label = { unconfigured: "Chain not configured", error: "RPC unreachable", loading: mstTestnet.name, ok: mstTestnet.name }[state];

  const body = (
    <>
      <span className={cn("size-1.5 rounded-full", state === "ok" ? "animate-pulse-soft bg-ok" : state === "loading" ? "bg-muted" : "bg-warn")} />
      <span className="text-[12.5px] text-fg-2">{label}</span>
      {state === "ok" && block !== undefined && <span className="font-mono text-[12px] tabular-nums text-muted">#{formatNumber(Number(block))}</span>}
      {state === "loading" && <span className="font-mono text-[12px] text-muted">…</span>}
    </>
  );

  const cls = cn("flex items-center gap-2 rounded-full border border-line px-3 py-1", className);
  return state === "ok" && block !== undefined ? (
    <a href={explorer.block(block)} target="_blank" rel="noreferrer" className={cn(cls, "transition-colors hover:border-line-strong")} title="Latest block on MSTScan">
      {body}
    </a>
  ) : (
    <div className={cls} title={state === "error" ? "The MST RPC did not respond; retrying automatically." : undefined}>
      {body}
    </div>
  );
}
