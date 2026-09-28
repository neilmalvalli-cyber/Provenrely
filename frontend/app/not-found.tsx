import { LogoMark } from "@/components/brand/Logo";
import { Backdrop } from "@/components/layout/backdrop";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-void px-4">
      <Backdrop variant="hero" />
      <div className="relative text-center">
        <LogoMark className="mx-auto h-20 opacity-80" />
        <div className="mt-8 font-mono text-[12px] text-muted">404</div>
        <h1 className="mt-2 text-[28px] font-medium text-fg">No record at this address</h1>
        <p className="mt-2 text-[14px] text-fg-2">The page or case you are looking for does not exist.</p>
        <div className="mt-8 flex justify-center gap-2">
          <LinkButton href="/" variant="secondary">
            Home
          </LinkButton>
          <LinkButton href="/dashboard" variant="primary">
            Case ledger
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
