import type { Metadata } from "next";
import { IssuerView } from "@/components/issuer/issuer-view";

export const metadata: Metadata = { title: "Issuer" };

export default function IssuerPage() {
  return <IssuerView />;
}
