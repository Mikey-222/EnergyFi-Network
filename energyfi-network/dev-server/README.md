# EnergyFi Network — Frontend (dev-server)

Stellar-powered fintech: save into a community credit pool, borrow neighbourhood
loans from the same pool, and refer neighbours for instant rewards — all on
Stellar testnet with real USDC/EURC.

## Stack

- React 19 + TypeScript + Vite, TanStack Router (file-based routes in `src/routes/`)
- Tailwind CSS (mobile-first, dark UI)
- Stellar SDK 27 (`@stellar/stellar-sdk`, `@stellar/stellar-wallets-kit` for Freighter/other wallets)
- Soroban contract bindings generated from the Rust contracts (`src/contracts/`)
- Nitro (Cloudflare Workers preset) for the production build
- Built-in i18n (English, Hindi, Urdu, Spanish, Korean, Arabic) with RTL layout for Urdu/Arabic

## Getting started

```bash
npm install        # or bun install
npm run dev        # local dev server
npm run build      # production build → .output/ (Cloudflare Workers)
npx tsc --noEmit   # typecheck
npx eslint src     # lint
```

Connect a wallet (Freighter works best on testnet), then use the Circle faucet
(https://faucet.circle.com — USDC → Stellar Testnet) to fund yourself.

## Stellar integration layer (`src/lib/energyfi/`)

| File | Purpose |
|---|---|
| `config.ts` | Networks, USDC/EURC SACs + issuers, contract ids, loan catalog, referral constants |
| `signer.ts` | Singleton `StellarWalletsKit`, `connectWallet()`, `signTransactionXdr()` |
| `tokens.ts` | Horizon balance reads, `addTrustline()`, payment history |
| `contracts.ts` | Typed Soroban clients (`getCreditClient`, `getInstallmentsClient`, `getProjectClient`, `getReferralClient`), stroops helpers |
| `hooks.ts` | React hooks: `useCreditBalance`, `useCreditPrice`, `useProducts`, `useProduct`, `useFinancing`, `useInvestorState`, `useReferralState`, `useNotifications` |
| `activity.ts` | Payment history helpers: `cleanPayments` (filters contract-internal rows), day/time labels, `fmtAmount` |
| `profile.ts` | Per-wallet profile store (`energyfi.profiles` keyed by address), `language`/`currency` settings |
| `i18n.ts` | Translation dict + `useT(address)` hook → `{ translate, isRtl }`, `LANG_OPTIONS` |

Wallet state (address, balances, trustlines, sign) lives in
`src/components/energyfi/wallet-provider.tsx`.

## Language & currency

Settings live in **Profile → Language & currency** and are stored per wallet
(localStorage `energyfi.profiles`, keyed by address):

- **Language**: English, हिंदी, اردو, Español, 한국어, العربية. Urdu and Arabic
  render the whole app right-to-left (`dir="rtl"`); every untranslated string
  falls back to English. Add keys to the dict in `src/lib/energyfi/i18n.ts`.
- **Currency**: USDC or EURC (both live Circle testnet assets). The choice
  drives the wallet's primary balance card, units and faucet link.

Contract bindings under `src/contracts/<name>/` are generated from the Rust
wasm (`stellar contract bindings typescript`); compiled copies in
`packages/*/dist/` let Node scripts (e.g. seeding) reuse them. They ship with
an `eslint-disable` header — regenerate, don't hand-edit.

## On-chain flows

- **Borrow** (`/app/market` → Borrow) → `installments.start_financing` (sign loan) + `pay_installment` (monthly); admin `disburse_loan` pays the principal to the borrower from the pool; provider `withdraw` pays out repayments minus the 1% platform fee, which the admin can `claim_fees` on (`/app/admin`)
- **Save** (`/app/market` → Lend / Savings tab) → `project.invest` — 1 USDC/pool token; loan repayments deposited as revenue accrue pro-rata; `claim_dividends` pays interest out anytime
- **Refer** (`/app/profile/refer`) → `referral.register(referrer, referee, USDC|EURC)` records a
  **pending invite** — nothing is paid yet. The referee's wallet must confirm app usage
  (`referral.confirm_usage`, auto-triggered after their first invest/financing/installment
  flow, or via the unlock button), then `claim_referral` pays **0.0001** to both sides once.
  Max 5 referrals per wallet; rewards can no longer be farmed with empty addresses.
- **Top up** (`/app/wallet/topup/*`) → Circle faucet (SEP-24 anchor flow planned)

The `energy-credit` contract remains deployed as a dormant utility token; it is
no longer surfaced in the UI (fintech conversion, 2026-08-06).

## Admin console (`/app/admin`)

Operator tooling for the owner wallet
(`GBR5H3DVUZRMG2ESUBZP6SOASOBHKZCWR5VM6YB4FZG7MR3GBQOGOBV5`, the deploy
account). Access: connect that wallet in the app → **Profile → Admin console**;
the entry is hidden for every other address and the route shows a lock screen.

- **Pools**: live SAC balances — referral USDC, referral EURC, loan escrow,
  savings pool (stroops → USDC/EURC)
- **Stats**: share price, pool tokens sold, member referrals, APY, accrued
  platform fees
- **Fund**: transfer USDC/EURC from the owner wallet into the referral pools or
  the loan escrow, and `deposit_revenue` into the savings pool (all via the
  SACs, signed in-wallet)
- **Claim fees**: withdraw the accrued 1% platform fee (from provider
  withdrawals) to the owner wallet via `installments.claim_fees`
- **Activity**: recent transfers of the owner account with StellarExpert links

Gate is the `ADMIN_ADDRESS` constant in `src/lib/energyfi/config.ts`, which
matches the admin stored in each contract at deployment. On-chain ownership is
deploy-time fixed (no `transfer_admin` yet — see `contracts/README.md`), so the
constant and the contracts can only be changed together via redeploy.

## Scripts

```bash
DEPLOY_SECRET=<admin secret> node scripts/seed-onchain.mjs   # trustlines + register 4 loans + fund referral pools + loan escrow + revenue
DEPLOY_SECRET=<admin secret> node scripts/referral-demo.mjs  # referral v2 demo: register (no payout) → confirm usage → claim → both +0.0001
DEPLOY_SECRET=<admin secret> node scripts/e2e-smoke.mjs      # user journey: save → claim interest → buy credits (dormant)
```

Never commit secrets — `DEPLOY_SECRET` is passed as an env var only.

## Contract addresses (testnet)

See `contracts/README.md` in the repo root. Current ids in `src/lib/energyfi/config.ts`:
`energy-credit CB56C2Z5…7YC`, `installments (v3) CCTTXAZQ…OGDI`, `project CC3IKONP…GST`,
`referral (v2) CBURYW3CW…ABAE`, USDC SAC `CBIELTK6…DAMA` + EURC SAC `CCUUDM43…CGZ`
(official Circle testnet).

## Deploying to Cloudflare Workers

```bash
npm run build
npx wrangler --cwd . deploy     # requires `wrangler login` / CLOUDFLARE_API_TOKEN
```

## Layout

- `src/routes/` — all screens (TanStack Router file routes)
- `src/components/energyfi/` — shared UI (`ui.tsx`, `wallet-provider.tsx`)
- `scripts/` — on-chain seeding and E2E smoke test
- `contracts/` (repo root) — the four Soroban Rust contracts
