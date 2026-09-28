"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileUp, Flag, Loader2, RotateCcw } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { isAddress, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge, Card } from "@/components/console/kit";
import { PageHeader, PanelHeader } from "@/components/ui/panel";
import { explorer } from "@/lib/chain/explorer";
import { activeFlagsFromEvents, FLAG_REASONS, reasonLabel } from "@/lib/chain/flags";
import { mstTestnet } from "@/lib/chain/mst";
import { flagEvents, fromUnix, readRoles, registry, REGISTRY_READY, revokeEvents } from "@/lib/chain/registry";
import { isUserRejection, trackTx, txErrorMessage } from "@/lib/chain/tx";
import { cn, formatUtc, shortHash } from "@/lib/utils";

const MAX_EVIDENCE_BYTES = 50_000_000;

async function sha256File(file: File): Promise<Hex> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return `0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** yyyy-mm-dd → end of that day, UTC, in seconds. */
const expiryFromDate = (d: string) => BigInt(Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), 23, 59, 59) / 1000));
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

/** Issue and revoke flags. Only wallets the registry accepts as issuers can write; everyone can read. */
export function IssuerView() {
  const { address, status, chainId } = useAccount();
  const client = usePublicClient({ chainId: mstTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const connected = status === "connected" && !!address;
  const onMst = connected && chainId === mstTestnet.id;

  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState(FLAG_REASONS[0].code);
  const [evidence, setEvidence] = useState<{ name: string; hash: Hex } | { hashing: string } | null>(null);
  const [expiry, setExpiry] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<"flag" | Address | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Roles via OpenZeppelin AccessControl: hasRole(ISSUER(), wallet) and hasRole(DEFAULT_ADMIN_ROLE, wallet).
  const issuer = useQuery({
    queryKey: ["is-issuer", address],
    enabled: REGISTRY_READY && !!client && connected,
    queryFn: () => readRoles(client!, address!),
  });
  const canIssue = issuer.data?.issuer === true;
  // The contract lets only the flag's own issuer or an admin revoke it.
  const canRevoke = (flagIssuer: Address) => onMst && !!address && (issuer.data?.admin === true || flagIssuer.toLowerCase() === address.toLowerCase());

  const flags = useQuery({
    queryKey: ["active-flags"],
    enabled: REGISTRY_READY && !!client,
    queryFn: async () => {
      const [f, r] = await Promise.all([flagEvents(client!), revokeEvents(client!)]);
      return activeFlagsFromEvents(f, r);
    },
  });

  const subjectValid = isAddress(subject.trim(), { strict: false });
  const expiryValid = /^\d{4}-\d{2}-\d{2}$/.test(expiry) && expiryFromDate(expiry) > BigInt(Math.floor(Date.now() / 1000));
  const evidenceHash = evidence && "hash" in evidence ? evidence.hash : null;

  async function onEvidence(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_EVIDENCE_BYTES) return setFormError("Evidence file is too large to hash in the browser (max 50 MB).");
    setFormError(null);
    setEvidence({ hashing: file.name });
    try {
      setEvidence({ name: file.name, hash: await sha256File(file) });
    } catch {
      setEvidence(null);
      setFormError("Couldn't read that file.");
    }
  }

  async function write(kind: "flag" | "revoke", args: { subject: Address; reason?: number; evidenceHash?: Hex; expiry?: bigint }) {
    if (!client || !address) return;
    setBusy(kind === "flag" ? "flag" : args.subject);
    setFormError(null);
    try {
      // Simulate first so a rejection shows the contract's reason instead of a failed transaction.
      let hash: Hex;
      if (kind === "flag") {
        const call = { ...registry, functionName: "flag", args: [args.subject, args.reason!, args.evidenceHash!, args.expiry!] } as const;
        await client.simulateContract({ ...call, account: address });
        hash = await writeContractAsync({ ...call, chainId: mstTestnet.id });
      } else {
        const call = { ...registry, functionName: "revoke", args: [args.subject] } as const;
        await client.simulateContract({ ...call, account: address });
        hash = await writeContractAsync({ ...call, chainId: mstTestnet.id });
      }
      const receipt = await trackTx(client, hash, {
        pending: kind === "flag" ? "Flag pending…" : "Revoke pending…",
        success: kind === "flag" ? "Flag issued" : "Flag revoked",
        reverted: kind === "flag" ? "Flag reverted" : "Revoke reverted",
      });
      if (receipt.status === "success") {
        if (kind === "flag") {
          setSubject("");
          setEvidence(null);
          setExpiry("");
          setTouched(false);
        }
        void flags.refetch();
      }
    } catch (e) {
      if (isUserRejection(e)) toast("Cancelled");
      else {
        const msg = txErrorMessage(e);
        if (kind === "flag") setFormError(msg);
        toast.error(kind === "flag" ? "Flag not issued" : "Revoke failed", { description: msg });
      }
    } finally {
      setBusy(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!subjectValid || !evidenceHash || !expiryValid) return;
    void write("flag", { subject: subject.trim() as Address, reason, evidenceHash, expiry: expiryFromDate(expiry) });
  }

  const writeBlocker = !REGISTRY_READY
    ? "The registry isn't configured yet (NEXT_PUBLIC_REGISTRY_ADDRESS)."
    : !connected
      ? "Connect an issuer wallet to flag addresses."
      : !onMst
        ? "Switch your wallet to MST Testnet."
        : issuer.isLoading
          ? null
          : issuer.error
            ? `Couldn't check issuer access: ${issuer.error.message}`
            : !canIssue
              ? "This wallet isn't an issuer on the registry. You can view flags, but not issue or revoke them."
              : null;

  return (
    <>
      <PageHeader eyebrow="Issuer" title="Flag addresses" description="Issuers record fraud flags on MST. SafeSend blocks transfers to flagged addresses until the flag expires or is revoked." />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="overflow-clip">
          <PanelHeader
            label="Registry"
            title="Active flags"
            action={
              REGISTRY_READY ? (
                <Button size="sm" variant="ghost" onClick={() => void flags.refetch()} disabled={flags.isFetching}>
                  <RotateCcw className={cn(flags.isFetching && "animate-spin")} /> Refresh
                </Button>
              ) : undefined
            }
          />
          <div className="p-5 sm:p-6">
            {!REGISTRY_READY ? (
              <p className="text-[14px] text-muted">The registry isn&apos;t configured yet, so there are no flags to show.</p>
            ) : flags.isLoading ? (
              <p className="flex items-center gap-2 text-[14px] text-fg-2">
                <Loader2 className="size-4 animate-spin" /> Reading Flagged and Revoked events from MST…
              </p>
            ) : flags.error ? (
              <p className="text-[14px] text-red-300">Couldn&apos;t read flags: {flags.error.message}</p>
            ) : !flags.data?.length ? (
              <p className="text-[14px] text-muted">No active flags.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13.5px]">
                  <thead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    <tr>
                      <th className="pb-2 pr-4 font-normal">Address</th>
                      <th className="pb-2 pr-4 font-normal">Status</th>
                      <th className="pb-2 pr-4 font-normal">Reason</th>
                      <th className="pb-2 pr-4 font-normal">Issuer</th>
                      <th className="pb-2 pr-4 font-normal">Expires (UTC)</th>
                      <th className="pb-2 pr-4 font-normal">Tx</th>
                      <th className="pb-2 font-normal" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {flags.data.map((f) => (
                      <tr key={f.subject}>
                        <td className="py-2.5 pr-4 font-mono">
                          <a href={explorer.address(f.subject)} target="_blank" rel="noreferrer" className="hover:underline">
                            {shortHash(f.subject, 8, 6)}
                          </a>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone="danger">Active</Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-fg">{reasonLabel(f.reason)}</td>
                        <td className="py-2.5 pr-4 font-mono">
                          <a href={explorer.address(f.issuer)} target="_blank" rel="noreferrer" className="hover:underline">
                            {shortHash(f.issuer, 6, 4)}
                          </a>
                          {address && f.issuer.toLowerCase() === address.toLowerCase() && <span className="ml-1.5 rounded-full bg-panel-3 px-2 py-0.5 font-sans text-[11px] font-medium text-fg">you</span>}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">{f.expiry === 0n ? "No expiry" : formatUtc(fromUnix(f.expiry))}</td>
                        <td className="py-2.5 pr-4">
                          <a href={explorer.tx(f.txHash)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong px-3 font-mono text-[12px] text-fg-2 hover:text-fg">
                            {shortHash(f.txHash, 6, 4)} <ExternalLink className="size-3" />
                          </a>
                        </td>
                        <td className="py-2.5 text-right">
                          {canRevoke(f.issuer) && (
                            <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => void write("revoke", { subject: f.subject })}>
                              {busy === f.subject ? <Loader2 className="animate-spin" /> : null}
                              Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
        <Card variant="dark" className="self-start">
          <PanelHeader label="New flag" title="New flag" description="Record a fraud flag on MST." />
          <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
            {writeBlocker && (
              <p className="flex items-start gap-2.5 rounded-[var(--radius-tile)] bg-panel-2 px-4 py-3 text-[13.5px] text-fg-2">
                <Badge tone="warn" className="shrink-0">Read-only</Badge>
                <span className="min-w-0 [overflow-wrap:anywhere]">{writeBlocker}</span>
              </p>
            )}
            {issuer.isLoading && connected && REGISTRY_READY && (
              <p className="flex items-center gap-2 text-[13.5px] text-fg-2">
                <Loader2 className="size-4 animate-spin" /> Checking issuer access…
              </p>
            )}
            <fieldset disabled={!!writeBlocker || issuer.isLoading || busy !== null} className="space-y-4 disabled:opacity-60">
              <div>
                <Label htmlFor="subject">Address to flag</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                  className={cn("font-mono", touched && !subjectValid && "border-danger/60")}
                />
                {touched && !subjectValid && <p className="mt-2 text-[13px] text-red-300">Enter a 42-character address.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <select
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(Number(e.target.value))}
                    className="h-11 w-full rounded-lg border border-line-strong bg-black/30 px-3 text-[14px] text-fg outline-none focus:border-violet/60"
                  >
                    {FLAG_REASONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="expiry">Expires (end of day, UTC)</Label>
                  <Input id="expiry" type="date" min={tomorrow()} value={expiry} onChange={(e) => setExpiry(e.target.value)} className={cn(touched && !expiryValid && "border-danger/60")} />
                  {touched && !expiryValid && <p className="mt-2 text-[13px] text-red-300">Pick a date in the future.</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="evidence">Evidence file</Label>
                <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-dashed border-line-strong px-3.5 text-[14px] text-fg-2 hover:bg-white/[0.03]">
                  <FileUp className="size-4 shrink-0" />
                  <span className="truncate">{evidence ? ("hash" in evidence ? evidence.name : `Hashing ${evidence.hashing}…`) : "Choose a file"}</span>
                  <input id="evidence" type="file" onChange={onEvidence} className="sr-only" />
                </label>
                <p className="mt-2 text-[12.5px] text-muted">The file is hashed (SHA-256) in your browser and never uploaded. Only the hash goes on-chain.</p>
                {evidenceHash && <p className="mt-1 break-all font-mono text-[12.5px] text-fg-2">{evidenceHash}</p>}
                {touched && !evidenceHash && <p className="mt-1 text-[13px] text-red-300">Add an evidence file.</p>}
              </div>
              <Button type="submit" variant="primary" size="lg" className="h-11">
                {busy === "flag" ? <Loader2 className="animate-spin" /> : <Flag />}
                Issue flag
              </Button>
              {formError && <p className="text-[13.5px] text-red-300">{formError}</p>}
            </fieldset>
          </form>
        </Card>

      </div>
    </>
  );
}
