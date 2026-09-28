import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyView } from "@/components/proof/verify-view";

export const metadata: Metadata = { title: "Verify certificate" };

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyView />
    </Suspense>
  );
}
