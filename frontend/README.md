# Provenrely — frontend

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, framer-motion + GSAP, wagmi + viem on MST Testnet.

## Run

```bash
cp .env.example .env.local   # then edit values
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # type-check (tsc --noEmit)
```

Set `NEXT_PUBLIC_USE_MOCKS=true` to run every API call against clearly labelled sample data (no backend needed).
The backend contract is in [`../backend/README.md`](../backend/README.md).

## Structure

```
app/          routes; (console)/ holds the sidebar app shell
components/   ui/ (design system), landing/, layout/, navigation/, feature folders
lib/          config (brand, env), chain (MST + wagmi), formatting helpers
data/         sample data, used only in labelled mock mode
```

## Design system

- Tokens (colour, fluid type scale, motion) live in `app/globals.css` under `@theme`; motion is mirrored in
  `lib/motion.ts` (three durations, one easing curve).
- Violet only for things you can act on; status colours only for status; everything else neutral.
- Geist + Geist Mono.
- The product name lives in one constant: `lib/config/brand.ts`.
