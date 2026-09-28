"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn, shortHash } from "@/lib/utils";
import { DecodeText } from "./decode-text";

export function HashDisplay({
  value,
  label,
  full = false,
  decode = false,
  head = 10,
  tail = 8,
  className,
}: {
  value: string;
  label?: string;
  full?: boolean;
  /** Resolve the characters in with a decode animation on first view. */
  decode?: boolean;
  head?: number;
  tail?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const shown = full ? value : shortHash(value, head, tail);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      {label && <div className="mb-1.5 text-[12.5px] text-muted">{label}</div>}
      <div className="group flex min-w-0 items-center gap-2 rounded-lg border border-line bg-black/25 px-3 py-2 transition-colors hover:border-line-strong">
        <code
          className={cn("min-w-0 flex-1 font-mono text-[13px] text-fg/90", full ? "break-all" : "truncate")}
          title={value}
        >
          {decode ? <DecodeText text={shown} /> : shown}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded p-1 text-muted opacity-60 transition hover:bg-white/5 hover:text-fg group-hover:opacity-100"
          aria-label={copied ? "Copied" : `Copy ${label ?? "value"}`}
        >
          {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function InlineHash({ value, head = 6, tail = 4, className }: { value: string; head?: number; tail?: number; className?: string }) {
  return (
    <code className={cn("font-mono text-[13px] text-fg-2", className)} title={value}>
      {shortHash(value, head, tail)}
    </code>
  );
}
