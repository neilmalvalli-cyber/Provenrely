import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanView } from "@/components/scan/scan-view";

export const metadata: Metadata = { title: "Scan" };

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanView />
    </Suspense>
  );
}
