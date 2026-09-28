import { PRODUCT_NAME } from "@/lib/config/brand";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const COLS = [
  { title: "Platform", links: [["Console", "/dashboard"], ["Case ledger", "/cases"], ["New intake", "/intake"], ["Explorer", "/explorer"]] },
  { title: "Proof", links: [["Verify a proof", "/verify"], ["Sample attestation", "/proof/PR-8842"], ["How sealing works", "/#how"]] },
  { title: "Company", links: [["Architecture", "/#security"], ["Sign in", "/login"]] },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-fg-2">
            Evidence infrastructure for on-chain investigations. Trace activity, seal findings and share proofs anyone can verify.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <div className="mb-4 text-[13px] font-medium text-fg">{col.title}</div>
            <ul className="space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-fg-2 transition hover:text-fg">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>© 2026 {PRODUCT_NAME}</span>
          <span className="font-mono text-[11px]">Interface preview · all cases and chain data are simulated</span>
        </div>
      </div>
    </footer>
  );
}
