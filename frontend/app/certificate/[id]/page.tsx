import type { Metadata } from "next";
import { CertificateView } from "@/components/certificate/certificate-view";
import { DocShell } from "@/components/proof/doc-shell";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Certificate ${decodeURIComponent(id)}` };
}

export default async function CertificatePage({ params }: Props) {
  const { id } = await params;
  const certId = decodeURIComponent(id);
  return (
    <DocShell verifyHref={`/verify?cert=${encodeURIComponent(certId)}`}>
      <CertificateView id={certId} />
    </DocShell>
  );
}
