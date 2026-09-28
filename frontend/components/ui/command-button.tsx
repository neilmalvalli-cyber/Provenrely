"use client";

import { Loader2 } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { sleep } from "@/lib/utils";
import { Button } from "./button";
import { useToast } from "./toast";

/** Button that simulates an async action, then confirms with a toast. */
export function CommandButton({
  toast,
  description,
  delay = 700,
  children,
  ...props
}: ComponentProps<typeof Button> & { toast: string; description?: string; delay?: number }) {
  const push = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      {...props}
      disabled={busy || props.disabled}
      onClick={async () => {
        setBusy(true);
        await sleep(delay);
        setBusy(false);
        push({ title: toast, description });
      }}
    >
      {busy && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
