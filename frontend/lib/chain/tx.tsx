import type { ReactNode } from "react";
import { toast } from "sonner";
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, type Hex, type PublicClient, type TransactionReceipt } from "viem";
import { shortHash } from "@/lib/utils";
import { explorer } from "./explorer";

/** Decoded custom error or revert reason from any viem error, if there is one. */
export function revertOf(e: unknown): { name: string; args: readonly unknown[] } | null {
  if (!(e instanceof BaseError)) return null;
  const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
  if (!(r instanceof ContractFunctionRevertedError)) return null;
  if (r.data) return { name: r.data.errorName, args: r.data.args ?? [] };
  return r.reason ? { name: r.reason, args: [] } : null;
}

export const isUserRejection = (e: unknown) => e instanceof BaseError && e.walk((x) => x instanceof UserRejectedRequestError) !== null;

/** Plain-language text for the registry's custom errors (names from the generated ABI). */
const REVERT_TEXT: Record<string, string> = {
  AlreadyFlagged: "This address already has an active flag.",
  NotFlagged: "This address has no active flag to revoke.",
  NotAllowed: "Only the issuer who created this flag, or an admin, can revoke it.",
  BadExpiry: "The expiry must be in the future.",
  ZeroValue: "The zero address or an empty hash isn't allowed.",
  AlreadyAnchored: "This certificate is already anchored.",
  NotAnchored: "This certificate isn't anchored on MST.",
  BadAction: "Unknown custody action.",
  AccessControlUnauthorizedAccount: "This wallet doesn't have the role needed for this action.",
  RecipientFlagged: "The recipient is flagged — SafeSend blocked the transfer.",
  ZeroRecipient: "The zero address can't receive transfers.",
  TransferFailed: "The recipient refused the transfer.",
};

/** Short, readable message for a failed wallet or chain call. */
export function txErrorMessage(e: unknown): string {
  if (isUserRejection(e)) return "You cancelled the request in your wallet.";
  const rev = revertOf(e);
  if (rev) return REVERT_TEXT[rev.name] ? `${REVERT_TEXT[rev.name]} (${rev.name})` : `Reverted: ${rev.name}`;
  if (e instanceof BaseError) return e.shortMessage;
  return e instanceof Error ? e.message : "Something went wrong.";
}

const TxLink = ({ hash }: { hash: Hex }): ReactNode => (
  <a href={explorer.tx(hash)} target="_blank" rel="noreferrer" className="underline">
    {shortHash(hash, 10, 6)} on MSTScan
  </a>
);

/**
 * Follow a sent transaction with sonner toasts: pending → confirmed / reverted, each with an
 * explorer link. Resolves with the receipt (reverted receipts resolve too — check `status`).
 */
export async function trackTx(client: PublicClient, hash: Hex, labels: { pending: string; success: string; reverted: string }): Promise<TransactionReceipt> {
  const id = toast.loading(labels.pending, { description: <TxLink hash={hash} /> });
  try {
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (receipt.status === "success") toast.success(labels.success, { id, description: <TxLink hash={hash} /> });
    else toast.error(labels.reverted, { id, description: <TxLink hash={hash} /> });
    return receipt;
  } catch (e) {
    toast.error("Couldn't confirm the transaction", { id, description: <TxLink hash={hash} /> });
    throw e;
  }
}
