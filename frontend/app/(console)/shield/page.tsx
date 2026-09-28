import type { Metadata } from "next";
import { ShieldView } from "@/components/shield/shield-view";

export const metadata: Metadata = { title: "Shield" };

export default function ShieldPage() {
  return <ShieldView />;
}
