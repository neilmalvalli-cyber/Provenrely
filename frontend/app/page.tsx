import { ArrowRight, Landmark, ShieldCheck, UserRound } from "lucide-react";
import { preload } from "react-dom";
import { Architecture } from "@/components/landing/architecture";
import { ScrollHero } from "@/components/landing/hero/scroll-hero";
import { LogoIntro } from "@/components/landing/intro";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { STAGES } from "@/components/landing/sealing-stages";
import { SealingStory } from "@/components/landing/sealing-story";
import { Split } from "@/components/landing/split";
import { VerifyDemo } from "@/components/landing/verify-demo";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/navigation/site-nav";
import { LinkButton } from "@/components/ui/button";
import { FitWidth } from "@/components/ui/fit-width";
import { SectionHeader } from "@/components/ui/panel";
import { Reveal } from "@/components/ui/reveal";
import { PRODUCT_NAME } from "@/lib/config/brand";
import "@/components/console/console-theme.css";
import "@/components/layout/marble-background.css";

const AUDIENCES = [
  {
    icon: UserRound,
    title: "People about to pay",
    body: "Check an address before sending money, and read why it looks risky in English or Hindi — with the 1930 helpline and cybercrime.gov.in one tap away.",
  },
  {
    icon: Landmark,
    title: "Police cyber cells & investigators",
    body: "Issue a certificate for what you found. Anyone can check it against MST later, so the record holds up when it's challenged.",
  },
  {
    icon: ShieldCheck,
    title: "Exchanges & wallets",
    body: "Flag addresses tied to fraud in a shared registry, and let SafeSend stop transfers to them on-chain before the money moves.",
  },
];

/** The mark's shape beside each step (see components/landing/companion/scenes.ts). */
const HOW_MORPH = ["collect", "hash", "merkle", "chain"] as const;

/** What each step produces, for an example certificate — shown beside the step on desktop. */
const HOW_DETAIL = [
  null,
  <Detail
    key="certify"
    title="Certificate · example"
    rows={[
      ["Verdict", "High risk"],
      ["Score", "90 / 100"],
      ["Reasons", "3 indicators"],
      ["Hash", "0x89e1…7c4a"],
    ]}
  />,
  <Detail
    key="anchor"
    title="Anchor on MST · example"
    rows={[
      ["Written", "certificate hash only"],
      ["Contract", "ProvenrelyRegistry"],
      ["Block time", "UTC, from MST"],
      ["Status", "anchored"],
    ]}
  />,
  <Detail
    key="verify"
    title="Check & block · example"
    rows={[
      ["Verify", "certificates(hash) ≠ 0"],
      ["Edited copy", "hash never anchored"],
      ["Flag", "Investment scam"],
      ["SafeSend", "transfer reverted"],
    ]}
  />,
];

function Detail({ title, rows }: { title: string; rows: (readonly [string, string])[] }) {
  return (
    <Reveal delay={0.1}>
      <div className="glass rounded-2xl p-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{title}</div>
        <dl className="mt-4 divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-[13px] text-fg-2">{k}</dt>
              <dd className="flex items-center gap-2 font-mono text-[12.5px] text-fg">
                {v === "anchored" && <span className="size-1.5 rounded-full bg-ok" />}
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Reveal>
  );
}

function Stage({ index, title, body, icon: Icon }: { index: number; title: string; body: string; icon: (typeof STAGES)[number]["icon"] }) {
  return (
    <Reveal>
      <div className="flex items-center gap-3 text-fg">
        <span className="font-mono text-[11px] text-muted">{String(index + 1).padStart(2, "0")}</span>
        <Icon className="size-[18px]" />
        <span className="text-[17px] font-medium tracking-[-0.01em]">{title}</span>
      </div>
      <p className="text-title mt-4 text-balance text-fg-2">{body}</p>
    </Reveal>
  );
}

function Audience({ a, delay = 0 }: { a: (typeof AUDIENCES)[number]; delay?: number }) {
  return (
    <Reveal delay={delay} className="border-t border-line-strong pt-6">
      <a.icon className="size-5 text-fg-2" />
      <h3 className="mt-6 text-[17px] font-medium tracking-[-0.01em] text-fg">{a.title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{a.body}</p>
    </Reveal>
  );
}

export default function LandingPage() {
  // The intro artwork is only referenced from CSS; fetch it with the HTML instead.
  preload("/brand/intro-logo.webp", { as: "image", fetchPriority: "high" });
  preload("/brand/mark-640.webp", { as: "image" });
  return (
    <div className="console-theme landing-light relative isolate">
      {/* The same still marble as the console. */}
      <div className="marble-background marble-background--still" aria-hidden="true" />
      <LogoIntro />
      <SiteNav />
      <div className="relative z-10">
        {/* HERO — its mark becomes the page's companion (components/landing/hero) */}
        <ScrollHero />

        {/* PRODUCT — the mark becomes the workspace */}
        <Split
          id="product"
          morph="stack"
          border={false}
          left={
            <Reveal>
              <SectionHeader
                eyebrow="The console"
                title="Scan, explain, certify — in one place."
                description="Check an address, understand the verdict in plain language, and turn it into a certificate anchored on MST. Verify, Shield and Issuer sit right beside it."
              />
            </Reveal>
          }
          right={
            <FitWidth width={1000}>
              <ProductShowcase />
            </FitWidth>
          }
        />

        {/* VERIFY — a sealed document on its pedestal */}
        <Split
          id="verify"
          morph="doc"
          left={
            <Reveal>
              <SectionHeader
                eyebrow="Try it"
                title="Change one character. Watch it fail."
                description="A certificate is only valid if its exact hash was anchored on MST. This demo runs in your browser with an example certificate: check it, edit a single character, and check it again."
              />
            </Reveal>
          }
          right={
            <Reveal delay={0.1}>
              <FitWidth width={640}>
                <VerifyDemo />
              </FitWidth>
            </Reveal>
          }
        />

        {/* STATEMENT — a forwarded screenshot becomes one checkable record */}
        <Split
          morph="record"
          left={
            <Reveal>
              <p className="text-title text-balance text-muted lg:text-right">Most scam warnings are a forwarded screenshot nobody can check.</p>
            </Reveal>
          }
          right={
            <Reveal delay={0.1}>
              <p className="text-title text-balance text-muted">
                <span className="text-fg">{PRODUCT_NAME} turns a risk check into a certificate anyone can verify</span> — and a flag that can stop the
                transfer before it happens.
              </p>
            </Reveal>
          }
        />

        {/* HOW — each step beside the shape it describes (on small screens: the story version) */}
        <section id="how" className="relative scroll-mt-16 border-t border-line">
          <div className="hidden lg:block">
            {STAGES.map((st, i) => {
              const step = <Stage index={i} title={st.title} body={st.body} icon={st.icon} />;
              const detail = HOW_DETAIL[i];
              // every row has something on both sides: the step, and what it produces for an example certificate
              const header = (
                <Reveal>
                  <SectionHeader eyebrow="How it works" title="From a scan to a certificate anyone can check." />
                </Reveal>
              );
              const [left, right] = i === 0 ? [header, step] : i % 2 === 1 ? [step, detail] : [detail, step];
              return <Split key={st.key} morph={HOW_MORPH[i]} border={false} className="lg:min-h-[80vh]" left={left} right={right} />;
            })}
          </div>
          <div className="lg:hidden">
            <SealingStory />
          </div>
        </section>

        {/* AUDIENCES — a shield that holds up under challenge */}
        <Split
          morph="shield"
          left={
            <div className="space-y-12">
              <Reveal>
                <SectionHeader eyebrow="Who it's for" title="For anyone about to trust an address." />
              </Reveal>
              <Audience a={AUDIENCES[0]} />
            </div>
          }
          right={
            <div className="space-y-12">
              <Audience a={AUDIENCES[1]} delay={0.08} />
              <Audience a={AUDIENCES[2]} delay={0.16} />
            </div>
          }
        />

        {/* ARCHITECTURE — the certificate stays private, only its fingerprint leaves */}
        <Split
          id="security"
          morph="arch"
          left={
            <Reveal>
              <SectionHeader
                eyebrow="Architecture"
                title="Private certificate. Public fingerprint."
                description="The certificate stays with whoever holds it. The only thing written on MST is its hash — enough to prove it hasn't changed, and nothing about who asked."
              />
            </Reveal>
          }
          right={
            <Reveal delay={0.1}>
              <FitWidth width={980}>
                <Architecture />
              </FitWidth>
            </Reveal>
          }
        />

        {/* CTA — the S again (overflow-clip, not hidden: a scroll container would swallow its stop) */}
        <div className="relative overflow-clip">
          <Split
            morph="mark"
            left={
              <Reveal>
                <h2 className="text-headline text-balance text-fg">Check the address before the money moves.</h2>
                <p className="text-lede mt-5 max-w-xl text-fg-2">
                  Open the console to scan an address, issue a certificate, or verify one you were sent. Certificates and flags live on MST Testnet.
                </p>
              </Reveal>
            }
            right={
              <Reveal delay={0.1} className="flex flex-wrap gap-3">
                <LinkButton href="/dashboard" variant="primary" size="lg">
                  Open the console
                  <ArrowRight />
                </LinkButton>
                <LinkButton href="/scan" variant="secondary" size="lg">
                  Scan an address
                </LinkButton>
              </Reveal>
            }
          />
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
