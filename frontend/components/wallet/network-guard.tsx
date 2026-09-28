"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { MST_CONFIGURED, mstTestnet } from "@/lib/chain/mst";

/**
 * When the connected wallet is on another network, prompt the switch to MST Testnet once
 * automatically (wagmi adds the network to the wallet first if it doesn't know it), and keep a
 * banner with a manual switch until it's done.
 */
export function NetworkGuard() {
  const { status, chainId, address } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  const prompted = useRef<string | null>(null);
  const wrong = MST_CONFIGURED && status === "connected" && chainId !== mstTestnet.id;

  useEffect(() => {
    if (!wrong || !address) return;
    const key = `${address}:${chainId}`;
    if (prompted.current === key) return; // one automatic prompt per wallet + network
    prompted.current = key;
    switchChain({ chainId: mstTestnet.id });
  }, [wrong, address, chainId, switchChain]);

  if (!wrong) return null;
  return (
    <div role="status" className="no-print flex flex-wrap items-center gap-3 border-b border-warn/25 bg-warn/[0.07] px-4 py-2.5 sm:px-6">
      <AlertTriangle className="size-4 shrink-0 text-amber-300" />
      <p className="min-w-0 flex-1 text-[13px] text-amber-100">
        Your wallet is on another network. Switch to <span className="font-medium">{mstTestnet.name}</span> to sign transactions.
        {error && !isPending && <span className="text-amber-200/80"> The last switch didn&apos;t complete — try again from your wallet.</span>}
      </p>
      <Button size="sm" variant="secondary" disabled={isPending} onClick={() => switchChain({ chainId: mstTestnet.id })}>
        {isPending ? "Check your wallet…" : `Switch to ${mstTestnet.name}`}
      </Button>
    </div>
  );
}
