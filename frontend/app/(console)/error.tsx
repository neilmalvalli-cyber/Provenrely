"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

/** Designed error state for any console page. */
export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="glass mx-auto mt-10 max-w-lg rounded-2xl p-8 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/[0.06]">
        <TriangleAlert className="size-5 text-amber-200" />
      </div>
      <h1 className="mt-5 text-[18px] font-medium text-fg">This view couldn&apos;t load</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">
        Nothing was changed. Try again, or go back to the overview.
        {error.digest && <span className="mt-2 block font-mono text-[12px] text-muted">ref {error.digest}</span>}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="secondary" onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
        <LinkButton href="/dashboard" variant="primary">
          Overview
        </LinkButton>
      </div>
    </div>
  );
}
