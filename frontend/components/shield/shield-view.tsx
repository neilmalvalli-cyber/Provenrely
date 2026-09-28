"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatEther, isAddress, parseEther, type Address, type Hex } from "viem";
import { useAccount, useBalance, usePublicClient, useWriteContract } from "wagmi";
import { safeSendAbi } from "@/abi/safe-send";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DataField, GlassPanel, PageHeader, PanelHeader } from "@/components/ui/panel";
import { explorer } from "@/lib/chain/explorer";
import { reasonLabel } from "@/lib/chain/flags";
import { MST_CONFIGURED, mstTestnet } from "@/lib/chain/mst";
import { fromUnix, readFlag, REGISTRY_READY } from "@/lib/chain/registry";
import { isUserRejection, revertOf, trackTx, txErrorMessage } from "@/lib/chain/tx";
import { env } from "@/lib/config/env";
import { cn, formatUtc } from "@/lib/utils";

/**
 * Fixed gas limit for SafeSend.send. Passing it means the wallet doesn't need to estimate gas, so a
 * transfer to a flagged recipient is actually mined and reverts on-chain (visible on MSTScan)
 * instead of being refused by the wallet's pre-flight estimate.
 */
const SEND_GAS = 150_000n;
const SAFESEND_READY = MST_CONFIGURED && env.safeSendAddress !== null;

type Phase =
  | { state: "idle" }
  | { state: "signing" }
  | { state: "pending"; hash: Hex }
  | { state: "confirmed"; hash: Hex }
  | { state: "reverted"; hash: Hex; reason: string | null }
  | { state: "failed"; message: string };

function describeRevert(rev: { name: string; args: readonly unknown[] } | null): string | null {
  if (!rev) return null;
  if (rev.name === "RecipientFlagged") return `RecipientFlagged(${String(rev.args[0] ?? "")}) — SafeSend blocked the transfer because the recipient is flagged.`;
  return rev.name;
}

/** Send tMSTC through SafeSend, with a pre-send flag check that warns but doesn't block. */
export function ShieldView() {
  const { address, status, chainId } = useAccount();
  const client = usePublicClient({ chainId: mstTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const balance = useBalance({ address, chainId: mstTestnet.id, query: { enabled: !!address && MST_CONFIGURED } });

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });

  const toValid = isAddress(to.trim(), { strict: false });
  const recipient = toValid ? (to.trim() as Address) : null;
  let value: bigint | null = null;
  try {
    value = /^\d*\.?\d+$/.test(amount.trim()) ? parseEther(amount.trim()) : null;
  } catch {
    value = null;
  }
  const amountValid = value !== null && value > 0n;
  const overBalance = value !== null && balance.data ? value > balance.data.value : false;

  const flag = useQuery({
    queryKey: ["flag", recipient?.toLowerCase()],
    queryFn: () => readFlag(client!, recipient!),
    enabled: REGISTRY_READY && !!client && !!recipient,
  });
  // the contract decides: getFlag returns `active` (exists, not revoked, not expired)
  const flagged = flag.data?.active ?? false;

  const connected = status === "connected" && !!address;
  const onMst = connected && chainId === mstTestnet.id;
  const busy = phase.state === "signing" || phase.state === "pending";

  async function send(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!recipient || !amountValid || value === null || !address || !client || !env.safeSendAddress) return;
    const call = { address: env.safeSendAddress, abi: safeSendAbi, functionName: "send", args: [recipient], value } as const;
    setPhase({ state: "signing" });
    try {
      const hash = await writeContractAsync({ ...call, chainId: mstTestnet.id, gas: SEND_GAS });
      setPhase({ state: "pending", hash });
      const receipt = await trackTx(client, hash, {
        pending: "Transfer pending…",
        success: "Transfer confirmed",
        reverted: "Transfer reverted on-chain",
      });
      if (receipt.status === "success") return setPhase({ state: "confirmed", hash });
      // Receipts carry no revert data: replay the call at that block to decode the custom error.
      const reason = await client
        .simulateContract({ ...call, account: address, blockNumber: receipt.blockNumber })
        .then(() => null)
        .catch((err: unknown) => describeRevert(revertOf(err)));
      setPhase({ state: "reverted", hash, reason });
    } catch (err) {
      if (isUserRejection(err)) {
        toast("Transfer cancelled");
        return setPhase({ state: "idle" });
      }
      const rev = describeRevert(revertOf(err));
      const message = rev ? `Your wallet refused to send it: ${rev}` : txErrorMessage(err);
      toast.error("Transfer not sent", { description: message });
      setPhase({ state: "failed", message });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Shield"
        title="Send tMSTC safely"
        description="Transfers go through SafeSend, which checks the recipient against the flag registry and reverts on-chain if it is flagged."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {!SAFESEND_READY && (
            <GlassPanel className="border-amber-400/20">
              <p className="p-5 text-[14px] text-amber-200 sm:p-6">
                SafeSend isn&apos;t configured yet (NEXT_PUBLIC_SAFESEND_ADDRESS). You can check a recipient, but sending is disabled.
              </p>
            </GlassPanel>
          )}

          <GlassPanel>
            <form onSubmit={send} className="space-y-4 p-5 sm:p-6">
              <div>
                <Label htmlFor="to">Recipient</Label>
                <Input
                  id="to"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPhase({ state: "idle" });
                  }}
                  onBlur={() => setTouched(true)}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                  className={cn("font-mono", touched && to && !toValid && "border-danger/60")}
                  aria-invalid={touched && !!to && !toValid}
                />
                {touched && to && !toValid && <p className="mt-2 text-[13px] text-red-300">Enter a 42-character address: 0x followed by 40 hex characters.</p>}
              </div>
              <div>
                <Label htmlFor="amount">Amount (tMSTC)</Label>
                <Input
                  id="amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setPhase({ state: "idle" });
                  }}
                  onBlur={() => setTouched(true)}
                  placeholder="0.0"
                  inputMode="decimal"
                  autoComplete="off"
                  className={cn("font-mono", touched && amount && !amountValid && "border-danger/60")}
                  aria-invalid={touched && !!amount && !amountValid}
                />
                <p className="mt-2 text-[13px] text-muted">
                  Balance: <span className="font-mono">{balance.data ? `${formatEther(balance.data.value)} tMSTC` : "—"}</span>
                </p>
                {touched && amount && !amountValid && <p className="mt-1 text-[13px] text-red-300">Enter an amount greater than 0 (up to 18 decimals).</p>}
                {overBalance && <p className="mt-1 text-[13px] text-red-300">That is more than your balance.</p>}
              </div>

              {recipient && <FlagCheck loading={flag.isLoading} error={flag.error} data={flag.data} flagged={flagged} />}

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Button
                  type="submit"
                  variant={flagged ? "danger" : "primary"}
                  size="lg"
                  className="h-11"
                  disabled={!SAFESEND_READY || !onMst || busy || !recipient || !amountValid || overBalance}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Send />}
                  {flagged ? "Send anyway" : "Send"}
                </Button>
                {!connected && <span className="text-[13px] text-muted">Connect your wallet to send.</span>}
                {connected && !onMst && <span className="text-[13px] text-amber-200">Switch your wallet to MST Testnet to send.</span>}
                {flagged && onMst && <span className="text-[13px] text-muted">SafeSend will revert this on-chain; you only pay gas.</span>}
              </div>
            </form>
          </GlassPanel>

          <Outcome phase={phase} />
        </div>

        <GlassPanel>
          <PanelHeader label="How it works" title="What SafeSend does" />
          <ol className="space-y-3 p-5 text-[13.5px] leading-relaxed text-fg-2">
            <li>
              <span className="font-mono text-violet-300">1.</span> Before you send, we read <code className="font-mono">getFlag(recipient)</code> from the registry and warn you.
            </li>
            <li>
              <span className="font-mono text-violet-300">2.</span> The transfer calls <code className="font-mono">SafeSend.send(to)</code> from your wallet.
            </li>
            <li>
              <span className="font-mono text-violet-300">3.</span> If the recipient is flagged, the contract reverts with <code className="font-mono">RecipientFlagged</code> and your tMSTC stays with you.
            </li>
          </ol>
        </GlassPanel>
      </div>
    </>
  );
}

function FlagCheck({ loading, error, data, flagged }: { loading: boolean; error: Error | null; data: Awaited<ReturnType<typeof readFlag>> | undefined; flagged: boolean }) {
  if (!REGISTRY_READY) return <p className="text-[13.5px] text-amber-200">Flag check unavailable: the registry isn&apos;t configured yet.</p>;
  if (loading)
    return (
      <p className="flex items-center gap-2 text-[13.5px] text-fg-2">
        <Loader2 className="size-4 animate-spin" /> Checking the flag registry…
      </p>
    );
  if (error) return <p className="text-[13.5px] text-red-300">Couldn&apos;t check the flag registry: {error.message}</p>;
  if (!data) return null;
  if (!flagged)
    return (
      <p className="flex items-center gap-2 text-[13.5px] text-emerald-300">
        <ShieldCheck className="size-4" /> No active flag on this recipient.
      </p>
    );
  return (
    <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">
      <div className="flex items-center gap-2 text-[14.5px] font-medium text-red-200">
        <ShieldAlert className="size-4" /> This recipient is flagged
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <DataField label="Reason">{reasonLabel(data.reason)}</DataField>
        <DataField label="Issuer" mono>
          <a href={explorer.address(data.issuer)} target="_blank" rel="noreferrer" className="break-all hover:underline">
            {data.issuer}
          </a>
        </DataField>
        <DataField label="Expires (UTC)" mono>
          {data.expiry === 0n ? "No expiry" : formatUtc(fromUnix(data.expiry))}
        </DataField>
      </div>
    </div>
  );
}

function Outcome({ phase }: { phase: Phase }) {
  if (phase.state === "idle") return null;
  const link = (hash: Hex) => (
    <a href={explorer.tx(hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12.5px] text-violet-300 hover:text-violet-200">
      {hash} <ExternalLink className="size-3 shrink-0" />
    </a>
  );
  const box = (tone: string, title: string, body?: React.ReactNode) => (
    <GlassPanel className={tone}>
      <div className="space-y-2 p-5 sm:p-6">
        <div className="text-[15px] font-medium text-fg">{title}</div>
        {body && <div className="break-all text-[13.5px] text-fg-2">{body}</div>}
      </div>
    </GlassPanel>
  );
  switch (phase.state) {
    case "signing":
      return box("", "Confirm the transfer in your wallet…");
    case "pending":
      return box("", "Pending on MST…", link(phase.hash));
    case "confirmed":
      return box("border-emerald-400/20", "Transfer confirmed", link(phase.hash));
    case "reverted":
      return box(
        "border-red-400/20",
        "Reverted on-chain — nothing was sent",
        <>
          <p className="mb-2">{phase.reason ?? "The revert reason couldn't be decoded."}</p>
          {link(phase.hash)}
        </>,
      );
    case "failed":
      return box("border-red-400/20", "Not sent", phase.message);
  }
}
