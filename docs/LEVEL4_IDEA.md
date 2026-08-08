# EnergyFi — Level 4 Idea Submission

**EnergyFi: community energy finance on Stellar — savings, loans, and tokenized energy credit for underserved markets.**

---

## 1. Problem Statement

Energy access is a *financing* problem, not just a hardware one. Solar kits, batteries, home appliances, and community solar installations are expensive upfront, while consumers in emerging markets (Ethiopia, Nigeria, the Philippines, LatAm) live on small daily income and cannot pay hundreds of dollars at once. Local credit is scarce, informal loans are predatory, and cross-border payments for equipment are slow and expensive.

At the same time, small capital holders in the community have idle savings. There is no trusted, low-friction way for them to earn from financing their neighbours' energy purchases, and no neutral platform that connects:

- **borrowers** who need energy equipment on credit,
- **savers/investors** in the same community who want real yield,
- **providers** who sell the equipment and settle in stablecoins.

The result: energy access stays blocked by upfront cost and by credit gaps no bank will serve.

**EnergyFi solves this** with an open, transparent community-lending layer: savers fund a pool, borrowers sign instalment loans, and repayments are split in-contract (principal → provider, **interest → automatically into the savers' pool**), so credit flows in the community without a central lender and without an admin shuttling money around.

## 2. Why Stellar?

- **Stablecoin rails as the credit currency.** Loans need a value-stable medium — USDC and EURC (both native Stellar assets, Circle-issued) settle in seconds at near-zero fees, usable by wallets anywhere. No fast-moving volatile asset can back community credit.
- **Soroban contracts can enforce the whole credit lifecycle.** Installment escrow, repayment tracking, interest routing, and default flagging run in a single Rust contract — no bank, no third-party ledger. Cross-contract calls allow the loan contract to read the saver's pool balance directly to enforce soft-collateral pledges.
- **SEP standards for the future on/off Ramps.** User acquisition depends on getting fiat in and out — Stellar's anchor ecosystem (SEP-6/SEP-24) is the standard way, and the codebase is already wallet-kit integrated.
- **Community-native asset issuance.** Energy credit (kWh) can be issued as a tokenized utility asset with native controls; fractional community ownership can be issued as shares in the savings contract.
- **Proven real deployment path on (annotation) mainnet** — the same contracts run on testnet today.

## 3. Target Users

1. **Borrowers** — energy consumers (households, micro-vendors) without bank credit who need a solar kit, battery, or appliance on instalments, and who save in the community pool.
2. **Community savers/investors** — people with small idle balances who want real, transparent yield from the pool and see exactly where their funds are, share-by-share.
3. **Equipment providers** — solar shops who list products, who get paid in USDC automatically and have trustless repayment records.
4. **Community admins** — the local entity that operates the pool: registers products, disburse loans, flags defaults (with clear on-chain audit trail).

## 4. Technical Architecture

**Layer — Rust Soroban contracts (testnet-live, this repo, `contracts/`):**

| Contract | Role |
|---|---|
| `project` | Neighbourhood savings pool. Fixed 1 USDC share price; investors buy shares (permanently locked = collateral), dividends are claimed pro-rata from revenue actually routed in. |
| `installments` | Loan products registry (50/100/200/500 USDC, 12 months, no deposit), 25% pledge enforcement (4× loan-to-savings cap) via a **cross-contract read of the pool**, `pay_installment` with interest auto-routing to the pool in the same split, `payoff_loan`, disburses, default lifecycle `mark_late → settle_default → clear_default`, provider withdrawal (1% platform fee to the admin) |
| `referral` | Usage-gated referral payouts (invitee must confirm usage), sybil guards |
| `energy-credit` | kWh energy credit token (1.5 USDC/kWh) |

**Frontend (`dev-server/`, React + TanStack Router, Tailwind):** wallet connect via `@creit.tech/stellar-wallets-kit` (Freighter, Albedo, Lobstr, xBull…), live on-chain balances, marketplace, plan/review/eligibility/repay screens, activity + notifications feeds fed by contract events, **admin console** with per-loan status, amortization schedule, and one-click actions.

**Data flow:** frontend → Soroban RPC (simulate → sign with user's wallet → send) → contract events → picked up by hooks → activity/notifications. No backend; the on-chain ledger *is* the database. Admin wallet signs admin ops; everything else is user-signed.

**Verification:** 44/44 contract tests (`cargo test --workspace`), GitHub Actions CI (contracts + typecheck + build).

---

## 5. Complexity Evaluation

- **Soft-collateral underwriting across contracts.** `check_eligibility` (each borrow) reads the *project contract's* investor state (shares × current share price) to enforce the 25% pledge / 4× cap; `start_financing` re-enforces it; `disburse_loan` checks again. Three layers, one pledge definition.
- **Self-consistent money flow with rounding.** Every repayment splits into principal vs. per-installment interest and routes the interest *into the same pool that is the borrower's collateral* — rounding per operation is unit-tested (1-stroop dust floors documented).
- **The permanence paradox.** Shares are permanently locked — that permanence is the pledge. The design must never accidentally allow withdrawal of pool funds (there *is no* withdraw function — attacked deliberately).
- **Deterministic lifecycle state machine.** financed → late → defaulted(s) / cleared, balanced across borrower, saver, and admin views.
- **Frontend/chain state continuity.** Eligibility verdicts, pledges, and disbursal states must mirror what the contract actually allows (a UI bug once masked the real verdict — fixed).

---

## 6. Roadmap

### MVP (done on testnet, this repo)
- 4 Soroban contracts live on Stellar testnet (installments v8, project v2, referral v2, energy-credit v1)
- Real USDC borrow/repay loop with verified on-chain transactions (payoff_loan 12/12, ledger-4008384)
- SAVINGS pool with auto-routed saver interest + claimable dividends
- Full admin console (disburse, claim_fees, mark late / settle default / clear)
- Wallet integration, marketplace, activity + notifications, referral rewards
- 44/44 tests, GitHub Actions CI, README with verified txs; live demo: https://energy-fi-network.vercel.app

### User acquisition
- organic vs. curriculum/offline community pilots: run the borrower loop with real community organizers
- a public "proof-of-repayment" page (repaid loans & transparent interest) to build trust
- SEP-24 anchor on-ramp story for fiat → USDC

### Mainnet vision (post-Level-4)
- deploy the same verified contracts to mainnet
- SEP-24 on/off ramps, partner anchors, USDC issuance
- provider onboarding tooling; energy-credit (kWh) as the payment utility asset

---

*Repo: github.com/Mikey-222/EnergyFi-Network (open source, CI, security model + underwriting docs, testnet-live).*