# EnergyFi — Stellar Builder Challenge Roadmap (Levels 4–7)

Master plan for taking EnergyFi from a prototype to a launched, growing product on
Stellar. Each level lists the official requirements, current status, and concrete
tasks with owners/evidence.

- Repo: `https://github.com/<org>/EnergyFi-Network` (public)
- App: `dev-server/` (TanStack Start + React + Tailwind, Stellar SDK)
- Contracts: `contracts/` (Soroban, Rust) — 4 contracts live on testnet
- Status legend: ✅ done · 🔧 in progress · ⬜ todo · 🎯 next milestone

**Current direction (fintech conversion, 2026-08-06):** EnergyFi is a fintech app on
Stellar — **Save** (deposit USDC into the community pool, earn interest from loan
repayments, claim anytime), **Borrow** (neighbourhood loans: principal disbursed on-chain
via `disburse_loan`, repaid in monthly installments), and **Refer** (0.01 USDC/EURC to
BOTH sides, max 5 per wallet). All energy-only surfaces (system monitoring, bill pay,
provider portal, credit purchase) were removed from the UI; the `energy-credit` contract
stays deployed as a dormant utility token. No contracts needed redeploying — the pool,
loans and referral were already generic fintech primitives.

---

## Level 4 — Green Belt: Production-Ready MVP

**Goal: production-quality MVP on testnet with 10+ real users, monitoring, and docs.**

### L4.1 Production MVP (frontend + architecture)
- [x] App shell, onboarding/KYC, wallet, marketplace exist (L1–3); bill-pay + provider portal built at L1–3 then removed in the fintech conversion (2026-08-06)
- [ ] 🎯 Stable smart-contract architecture: create `contracts/` Soroban workspace
- [ ] 🎯 Mobile responsive: Tailwind already mobile-first; verify every screen at 360px
- [ ] 🎯 Loading states: skeletons/spinners on all async screens (wallet, payments, invest)
- [ ] 🎯 Error handling: wallet errors, payment failures, Horizon downtime → friendly UI + retry

### L4.2 Real Stellar integration (replace mocks)
- [x] Soroban contracts: energy credit (kWh) token, installment escrow + loans, project/lending-pool tokenization + dividends, referral rewards (USDC + EURC pools)
- [x] Contract deployment on Stellar testnet + addresses in README (2026-08-04, redeployed to official Circle USDC):
  `energy-credit CB56C2Z5…7YC`, `installments (v2) CDKJEZJI…6SVN`, `project CC3IKONP…GST`, `referral CCSU4WLD…2ZB`, USDC SAC `CBIELTK6…DAMA`, EURC SAC `CCUUDM43…CGZ`
- [x] Unit tests: 29/29 passing, zero warnings (referral v2: usage-gated payouts, idempotent
      claim, wrong-currency block, public claim; installments v3: admin fee claims; plus
      self-ref block, one-referrer-per-wallet, 5-max cap, underfunded-pool revert)
- [x] On-chain E2E verified (pre-pivot legs): mint USDC → buy credits → invest → revenue → dividends
- [x] Contract bindings generated (TS) and integrated: `dev-server/src/contracts/`, typed clients in `src/lib/energyfi/`
- [x] Real balances (USDC/EURC/XLM) + trustline helper + Horizon payment history in wallet provider
- [x] Buy credits flow (energy-credit `buy_credits`), financing flow (`start_financing` + `pay_installment`),
      invest + claim dividends flow (project contract), products read live from chain
- [x] **Credit marketplace pivot (2026-08-05)**: borrow side = neighbourhood loans (principal disbursed to
      borrower via `disburse_loan`, repaid monthly); lend side = EnergyFi Lending Pool shares earning
      interest from repayments. Marketplace tabs renamed Borrow/Lend.
- [x] **Referral program live on-chain (2026-08-05)**: `referral` contract pays 0.01 USDC (or 0.01 EURC)
      to BOTH the referrer and the referred neighbour instantly; max 5 referrals per wallet; pools
      funded by admin (USDC 2.98 + EURC 1.0 on-chain); verified on testnet (`scripts/referral-demo.mjs`)
- [x] **Full fintech conversion (2026-08-06)**: home = savings/loans/referral dashboard; savings
      UI wraps the pool (deposit → tokens, claim interest); system/*, bill pay, provider/*,
      `wallet/buy` and market categories removed from the app; onboarding/landing copy reframed.
      No contract changes needed.
- [x] **Admin console (2026-08-06)**: `/app/admin` gated to the owner address (`ADMIN_ADDRESS`
      in `config.ts` = deploy account `GBR5H3DV…OBV5`): live pool balances (referral USDC/EURC,
      escrow, savings pool), stats (share price, tokens sold, APY), fund actions (refill pools
      via SAC transfer, `deposit_revenue`), activity feed with explorer links.
- [x] **Admin fee revenue (2026-08-06)**: `installments` v3 redeploy → `CCTTXAZQ…OGDI` adds an
      admin-gated `claim_fees` + `fees_owed` — the 1% provider-withdrawal fee now accrues to a
      `FeePool` ledger and is claimable from the admin console ("Platform fees" card).
- [x] **Usage-gated referrals (2026-08-06)**: `referral` v2 redeploy → `CBURYW3CW…ABAE`.
      `register` records a pending invite and pays nothing (was: instant 0.01 to both).
      The referee's own wallet must confirm app usage (`confirm_usage` — auto-triggered after
      their first invest/financing/installment flow, or the unlock button on the refer page),
      then `claim_referral` pays **0.0001 USDC/EURC** to both sides once. Rewards can no longer
      be farmed with empty wallet addresses; pools re-funded 1.0 USDC + 1.0 EURC; v2 flow
      verified on testnet (`scripts/referral-demo.mjs`).
      All 4 loan products re-registered on v3; escrow re-fund pending faucet top-up
      (`LOAN_FUND_USDC=10`).
- [ ] 🎯 **Borrow-loop E2E on-chain (next)**: `start_financing` → `disburse_loan` (principal to
      borrower) → `pay_installment` → `withdraw` (1% fee) → `deposit_revenue` → `claim_dividends`.
      Installments is now v3 (`CCTTXAZQ…OGDI`); escrow re-fund awaits a USDC faucet claim on
      the deploy account (~3.1 USDC usable). Awaits user confirmation to run against a fresh
      friendbot borrower.
- [ ] Top up / Cash out flows via anchor simulation (SEP-24) with real testnet movements

### L4.3 User onboarding (10+ real users)
- [ ] 🎯 Google Form: name, email, wallet address, product rating + feedback (shareable link in app)
- [ ] 🎯 Onboard 10+ testnet users; record wallet interactions (Horizon account activity as proof)
- [ ] 🎯 Feedback summary doc (`docs/feedback-l4.md`)

### L4.4 Product quality & ops
- [ ] 🎯 Production deployment: Vercel/Cloudflare (dev-server already has `.wrangler/`)
- [ ] 🎯 Monitoring: Sentry or similar error tracking; simple analytics (page views, wallet connects)
- [ ] 🎯 README: setup, architecture, deployment, contract addresses, screenshots
- [ ] 🎯 15+ meaningful commits, public repo

### L4.5 Demo & review
- [ ] 🎯 Demo video (walkthrough of full user flow)
- [ ] 🎯 Screenshots: product UI, mobile responsive, analytics/monitoring

---

## Level 5 — Blue Belt: Growth & Iteration

**Goal: 50 testnet users, features driven by feedback, pitch deck.**

### L5.1 User growth
- [ ] ⬜ Scale onboarding to 50 testnet users with real transaction activity
- [x] Referral program live (on-chain `referral` contract, 0.01 USDC/EURC × 2 sides, 5 max per wallet)
- [ ] ⬜ Active-usage proof: weekly on-chain activity (installments paid, dividends claimed)

### L5.2 Product iteration
- [ ] ⬜ Collect feedback via Google Form; export responses → Excel sheet
- [ ] ⬜ Add 1–2 features requested by users; document each change with a commit link
- [ ] ⬜ Improve UX/UI and onboarding flow based on feedback
- [ ] ⬜ Link exported Excel sheet in README (user feedback section)
- [ ] ⬜ README "Next improvements" section with git commit links per change

### L5.3 Presentation
- [ ] ⬜ Pitch deck (PPT): problem, solution, market opportunity, architecture, growth strategy, roadmap
- [ ] ⬜ Full product walkthrough video showcasing real use cases

### L5.4 Technical
- [ ] ⬜ 20+ meaningful commits, updated documentation

---

## Level 6 — Black Belt: Mainnet Launch

**Goal: live on mainnet, 20+ verified users, security review, ecosystem presence.**

### L6.1 Mainnet deployment
- [ ] ⬜ Deploy Soroban contracts to Stellar mainnet; publish addresses in README
- [ ] ⬜ Public production app live (Vercel/other)
- [ ] ⬜ Real on-chain transaction activity on mainnet

### L6.2 Real adoption
- [ ] ⬜ 20+ verified mainnet users (verified = KYC + funded account + 1 tx)
- [ ] ⬜ Transaction proof (Horizon/StellarExpert screenshots)

### L6.3 Security
- [ ] ⬜ Pick one: smart contract audit (e.g., via community) OR security review approved by mentors
- [ ] ⬜ Include review findings + fixes in repo docs

### L6.4 Marketing & ecosystem
- [ ] ⬜ Twitter/X launch thread + demo content, tag @StellarOrg, @buildonstellar
- [ ] ⬜ One ecosystem contribution: technical blog OR workshop OR tutorial OR OSS PR OR community session

### L6.5 Advanced feature (choose ≥1)
- [ ] ⬜ **Fee sponsorship** — gasless txs via fee bump (best fit: sponsors first user txs)
- [ ] ⬜ **SEP-24/SEP-31 anchor integration** — real anchor for cross-border flows
- [ ] ⬜ **Multisig** — multi-party approval for provider/treasury operations
- [ ] ⬜ **Account abstraction** — smart wallet with custom auth

### L6.6 Docs & checklist
- [ ] ⬜ 30+ meaningful commits, full docs, user guide, demo video, contract addresses, audit proof, X post link

---

## Level 7 — Master Track: Founder

**Goal: sustainable growth, retention, product-market fit, brand.**

- [ ] ⬜ 30+ meaningful commits (cumulative)
- [ ] ⬜ Live production app (Vercel or other)
- [ ] ⬜ 50+ new mainnet users; mainnet transaction proof
- [ ] ⬜ User feedback sheet (Google Form export, updated) linked in README
- [ ] ⬜ Product improvement commit links in README
- [ ] ⬜ Monthly growth report (docs/growth-reports/YYYY-MM.md): users, tx volume, retention, feedback themes, next steps
- [ ] ⬜ Social media growth: 50+ followers on X; product update posts
- [ ] ⬜ Community contribution proof (continued)
- [ ] ⬜ Updated documentation

---

## Cross-cutting backlog

| Area | Item | Level |
|---|---|---|
| Contracts | Soroban workspace: `contracts/` (energy-credit, installments, project, referral) | L4 |
| Contracts | Testnet deployment script + addresses in README | L4 |
| Contracts | Tests for each contract (`soroban test`) | L4 |
| Contracts | Admin ownership transfer (`admin()` + `transfer_admin`) — deferred; owner is deploy-time fixed (owner = `GBR5H3DV…OBV5`, hardcoded `ADMIN_ADDRESS` gate) | L6 |
| Contracts | Gas optimization pass (storage keys, bump/extends) | L5 |
| Contracts | Mainnet deployment + verified addresses | L6 |
| Contracts | Audit / security review | L6 |
| Frontend | Replace mock data imports with live API/contract state | L4 |
| Frontend | Skeleton loaders + error boundaries everywhere | L4 |
| Frontend | SEP-24 anchor flow (deposit/withdraw) | L4→L6 |
| Frontend | Referral program live (done at L4, 2026-08-05) | L4 |
| Ops | Sentry error tracking + analytics events (connect, pay, invest) | L4 |
| Ops | Vercel/Cloudflare production deploy + custom domain | L4 |
| Ops | Uptime + tx monitoring dashboards | L6 |
| Growth | Google Form (feedback + onboarding) | L4 |
| Growth | Excel export linked in README | L5 |
| Growth | Pitch deck | L5 |
| Growth | X launch thread + demo | L6 |
| Growth | Community contribution (blog/tutorial/workshop/OSS) | L6 |
| Growth | Monthly growth reports | L7 |
| Docs | README overhaul (setup, arch, contracts, deploy, feedback) | L4 |
| Docs | User guide | L6 |

## Evidence checklist (all levels, one place)

- [ ] Public GitHub repo
- [ ] README with complete docs + Excel feedback link
- [ ] 15 / 20 / 30+ meaningful commits (L4 / L5 / L6)
- [ ] Live deployed app (testnet L4 → mainnet L6)
- [ ] Contract addresses: testnet (L4) + mainnet (L6)
- [ ] Demo videos: L4 MVP walkthrough, L5 full walkthrough, L6 launch demo
- [ ] Screenshots: UI, mobile responsive, analytics/monitoring
- [ ] User proofs: 10+ (L4), 50 testnet (L5), 20+ mainnet (L6), 50+ new mainnet (L7)
- [ ] Feedback: Google Form + Excel export + improvement commit links
- [ ] Pitch deck (L5)
- [ ] Audit/security review proof (L6)
- [ ] X/Twitter launch post link (L6)
- [ ] Community contribution link (L6)
- [ ] Monthly growth report (L7)
- [ ] 50+ followers proof (L7)
