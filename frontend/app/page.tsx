import { ArrowRight, Building2, Landmark, Scale } from "lucide-react";
import { preload } from "react-dom";
import { Architecture } from "@/components/landing/architecture";
import { ScrollHero } from "@/components/landing/hero/scroll-hero";
import { LogoIntro } from "@/components/landing/intro";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { EVIDENCE_ITEMS, STAGES } from "@/components/landing/sealing-stages";
import { SealingStory } from "@/components/landing/sealing-story";
import { Split } from "@/components/landing/split";
import { Starfield } from "@/components/landing/starfield";
import { VerifyDemo } from "@/components/landing/verify-demo";
import { Backdrop } from "@/components/layout/backdrop";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/navigation/site-nav";
import { LinkButton } from "@/components/ui/button";
import { FitWidth } from "@/components/ui/fit-width";
import { SectionHeader } from "@/components/ui/panel";
import { Reveal } from "@/components/ui/reveal";
import { getCase } from "@/data/cases";
import { formatNumber, mockHash } from "@/lib/utils";

const AUDIENCES = [
  {
    icon: Landmark,
    title: "Investigative units",
    body: "Hand prosecutors a record of exactly what was examined and when — with integrity that holds up under challenge.",
  },
  {
    icon: Building2,
    title: "Exchanges & compliance",
    body: "Document freeze decisions and sanctions exposure with evidence counterparties can verify independently.",
  },
  {
    icon: Scale,
    title: "Forensic & legal firms",
    body: "Deliver reports clients can check themselves, instead of asking them to take your word for it.",
  },
];

/** The mark's shape beside each sealing step (see components/landing/companion/scenes.ts). */
const HOW_MORPH = ["collect", "hash", "merkle", "chain"] as const;

/** What each sealing step produces for the demo case — shown beside the step on desktop. */
const CASE = getCase("PR-8842")!;
const short = (h: string, a = 8, b = 6) => `${h.slice(0, a)}…${h.slice(-b)}`;
const HOW_DETAIL = [
  null,
  <Detail
    key="hash"
    title="Fingerprints · SHA-256"
    rows={EVIDENCE_ITEMS.map((it, i) => [it.label, short(mockHash(`leaf-${i}-${it.label}`))])}
  />,
  <Detail
    key="commit"
    title="Merkle tree"
    rows={[
      ["Leaves", `${EVIDENCE_ITEMS.length} fingerprints`],
      ["Pair 1", short(mockHash("pair-0"))],
      ["Pair 2", short(mockHash("pair-1"))],
      ["Root", short(CASE.evidence.merkleRoot)],
    ]}
  />,
  <Detail
    key="anchor"
    title={`Anchor · ${CASE.id}`}
    rows={[
      ["Block", `#${formatNumber(CASE.evidence.blockHeight)}`],
      ["Registry contract", short(CASE.evidence.contract, 6, 4)],
      ["Relayer", CASE.evidence.relayer],
      ["Status", "finalized"],
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
                {v === "finalized" && <span className="size-1.5 rounded-full bg-ok" />}
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
    <div className="relative isolate bg-void">
      <LogoIntro />
      <Starfield />
      <SiteNav />
      <div className="relative z-10">
        {/* HERO — its mark becomes the page's companion (components/landing/hero) */}
        <ScrollHero />

        {/* PRODUCT — the mark becomes the workspace: layers of evidence */}
        <Split
          id="product"
          morph="stack"
          border={false}
          left={
            <Reveal>
              <SectionHeader
                eyebrow="The console"
                title="One workspace, from first trace to final proof."
                description="Everything an investigator does is captured as they do it — so the record you seal is the record you reviewed."
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
                title="Don't take our word for it."
                description="This is a real verification flow running in your browser. Check the hash, then change a single character and check it again."
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

        {/* STATEMENT — screenshot + spreadsheet become one sealed record */}
        <Split
          morph="record"
          left={
            <Reveal>
              <p className="text-title text-balance text-muted lg:text-right">Most on-chain evidence is a screenshot and a spreadsheet.</p>
            </Reveal>
          }
          right={
            <Reveal delay={0.1}>
              <p className="text-title text-balance text-muted">
                <span className="text-fg">Solidity turns it into a record whose integrity anyone can check</span> — without seeing the evidence
                itself.
              </p>
            </Reveal>
          }
        />

        {/* HOW — each step beside the shape it describes (on small screens: the original story) */}
        <section id="how" className="relative scroll-mt-16 border-t border-line">
          <div className="hidden lg:block">
            {STAGES.map((st, i) => {
              const step = <Stage index={i} title={st.title} body={st.body} icon={st.icon} />;
              const detail = HOW_DETAIL[i];
              // every row has something on both sides: the step, and what it produces for the demo case
              const header = (
                <Reveal>
                  <SectionHeader eyebrow="How sealing works" title="From findings to a proof anyone can check." />
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
                <SectionHeader eyebrow="Who it's for" title="For teams whose findings will be challenged." />
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

        {/* ARCHITECTURE — the bundle stays private, only its fingerprint leaves */}
        <Split
          id="security"
          morph="arch"
          left={
            <Reveal>
              <SectionHeader
                eyebrow="Architecture"
                title="Private evidence. Public integrity."
                description="Case data never leaves your organization. The only thing published is a fingerprint that proves it hasn't changed."
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
          <Backdrop variant="hero" />
          <Split
            morph="mark"
            left={
              <Reveal>
                <h2 className="text-headline text-sheen text-balance">Start the next case with the proof built in.</h2>
                <p className="text-lede mt-5 max-w-xl text-fg-2">
                  Explore the console with demo cases. Nothing here touches a real chain or real data.
                </p>
              </Reveal>
            }
            right={
              <Reveal delay={0.1} className="flex flex-wrap gap-3">
                <LinkButton href="/dashboard" variant="primary" size="lg">
                  Open the console
                  <ArrowRight />
                </LinkButton>
                <LinkButton href="/intake" variant="secondary" size="lg">
                  Run a demo intake
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
