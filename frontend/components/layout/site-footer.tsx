import { PRODUCT_NAME } from "@/lib/config/brand";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const COLS = [
  { title: "Console", links: [["Dashboard", "/dashboard"], ["Scan an address", "/scan"], ["Verify a certificate", "/verify"], ["Shield", "/shield"], ["Issuer", "/issuer"]] },
  { title: "Learn", links: [["How it works", "/#how"], ["Try verification", "/#verify"], ["Architecture", "/#security"]] },
  { title: "Get help", links: [["Report at cybercrime.gov.in", "https://cybercrime.gov.in"], ["Call helpline 1930", "tel:1930"]] },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-line bg-[#fff]/60 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-fg-2">
            Fraud checks for MST addresses. Scan an address, understand the verdict, and share a certificate anyone can verify on-chain.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <div className="mb-4 text-[13px] font-medium text-fg">{col.title}</div>
            <ul className="space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith("/") ? (
                    <Link href={href} className="text-[13px] text-fg-2 transition hover:text-fg">
                      {label}
                    </Link>
                  ) : (
                    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-[13px] text-fg-2 transition hover:text-fg">
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>© 2026 {PRODUCT_NAME}</span>
          <span className="font-mono text-[11px]">MST Testnet preview · landing examples are illustrative</span>
        </div>
      </div>
    </footer>
  );
}
