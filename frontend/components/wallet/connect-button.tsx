"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { explorer } from "@/lib/chain/explorer";
import { mstTestnet } from "@/lib/chain/mst";
import { DUR, EASE } from "@/lib/motion";
import { cn, shortHash } from "@/lib/utils";
import { useDismiss } from "./use-dismiss";

/** A friendlier name than wagmi's generic "Injected". */
const walletName = (c: Connector) => (c.id === "injected" ? "Browser wallet" : c.name);

/** "User rejected" is the wallet's cancel button — not an error worth alarming anyone about. */
const isRejection = (e: unknown) => {
  const code = (e as { code?: number } | null)?.code;
  const name = (e as { name?: string } | null)?.name;
  return code === 4001 || name === "UserRejectedRequestError";
};

/**
 * Mobile in-app browsers (BridgeKey on Android included) may inject `window.ethereum` slightly
 * after the page loads, so check again on the standard `ethereum#initialized` event and once more
 * after a short delay.
 */
function useHasInjectedProvider() {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setHas(Boolean((window as { ethereum?: unknown }).ethereum));
    check();
    window.addEventListener("ethereum#initialized", check, { once: true });
    const t = window.setTimeout(check, 1500);
    return () => {
      window.removeEventListener("ethereum#initialized", check);
      window.clearTimeout(t);
    };
  }, []);
  return has;
}

/**
 * Connect with BridgeKey (or any injected EIP-1193 wallet). Right after connecting, NetworkGuard
 * prompts the switch to MST Testnet (adding the network to the wallet if it doesn't know it).
 */
export function ConnectButton({ className }: { className?: string }) {
  const toast = useToast();
  const { address, status, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const hasProvider = useHasInjectedProvider();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, ref, close);

  // Wallets that announce themselves by name (EIP-6963) replace the generic injected entry.
  const wallets = useMemo(() => {
    const named = connectors.filter((c) => c.id !== "injected");
    return named.length ? named : hasProvider ? connectors.filter((c) => c.id === "injected") : [];
  }, [connectors, hasProvider]);

  const start = (connector: Connector) => {
    setOpen(false);
    // Connect first; the network switch is NetworkGuard's job. Tying the two together would make
    // the whole connection fail whenever a wallet adds MST without switching to it (allowed by EIP-3085).
    connect(
      { connector },
      {
        onError: (e) =>
          toast(
            isRejection(e)
              ? { title: "Connection cancelled", tone: "info" }
              : { title: "Couldn't connect the wallet", description: e.message.split("\n")[0], tone: "info" },
          ),
      },
    );
  };

  const connected = status === "connected" && address;
  const onMst = connected && chainId === mstTestnet.id;

  if (!connected) {
    return (
      <div ref={ref} className={cn("relative", className)}>
        <Button
          variant="primary"
          size="sm"
          disabled={isPending || status === "reconnecting" || hasProvider === null}
          onClick={() => (wallets.length === 1 ? start(wallets[0]) : setOpen((o) => !o))}
          aria-haspopup={wallets.length === 1 ? undefined : "dialog"}
          aria-expanded={open}
        >
          <Wallet />
          {isPending ? "Connecting…" : status === "reconnecting" ? "Reconnecting…" : "Connect wallet"}
        </Button>
        <AnimatePresence>
          {open && (
            <motion.div
              role="dialog"
              aria-label="Connect a wallet"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR.fast, ease: EASE }}
              className="glass absolute right-0 top-[calc(100%+8px)] z-50 w-[min(300px,calc(100vw-32px))] rounded-xl p-2 shadow-2xl"
            >
              {wallets.length ? (
                wallets.map((c) => (
                  <button
                    key={c.uid}
                    onClick={() => start(c)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] text-fg hover:bg-white/[0.05]"
                  >
                    {c.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.icon} alt="" className="size-5 rounded" />
                    ) : (
                      <Wallet className="size-4 text-fg-2" />
                    )}
                    {walletName(c)}
                  </button>
                ))
              ) : (
                <div className="p-3 text-[13px] leading-relaxed text-fg-2">
                  <div className="mb-1 font-medium text-fg">No wallet found in this browser</div>
                  Open this page in the <span className="text-fg">BridgeKey</span> app&apos;s browser, or use a browser wallet with MST
                  Testnet added.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-white/[0.03] px-3 font-mono text-[12px] text-fg transition-colors hover:bg-white/[0.06]",
          open && "bg-white/[0.06]",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Wallet ${address}${onMst ? "" : ", wrong network"}`}
      >
        <span className={cn("size-1.5 rounded-full", onMst ? "bg-ok" : "bg-warn")} />
        {shortHash(address, 6, 4)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Wallet"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DUR.fast, ease: EASE }}
            className="glass absolute right-0 top-[calc(100%+8px)] z-50 w-[min(300px,calc(100vw-32px))] rounded-xl p-2 shadow-2xl"
          >
            <div className="px-3 pb-3 pt-2">
              <div className="text-[11.5px] text-muted">Connected wallet</div>
              <div className="mt-1 break-all font-mono text-[12px] text-fg">{address}</div>
              <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                <span className={cn("size-1.5 rounded-full", onMst ? "bg-ok" : "bg-warn")} />
                <span className={onMst ? "text-fg-2" : "text-amber-200"}>{onMst ? mstTestnet.name : "Wrong network"}</span>
              </div>
            </div>
            <div className="border-t border-line pt-1">
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(address).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  });
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-fg-2 hover:bg-white/[0.05] hover:text-fg"
              >
                {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy address"}
              </button>
              <a
                href={explorer.address(address)}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-fg-2 hover:bg-white/[0.05] hover:text-fg"
              >
                <ExternalLink className="size-4" />
                View on MSTScan
              </a>
              <button
                onClick={() => {
                  setOpen(false);
                  disconnect();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-fg-2 hover:bg-white/[0.05] hover:text-fg"
              >
                <LogOut className="size-4" />
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
