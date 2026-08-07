# EnergyFi Smart Contracts (Soroban)

Soroban (Rust) smart contracts powering the EnergyFi fintech layer on Stellar:
community savings/lending pool, neighbourhood loans, and referral rewards.
Testnet-first; mainnet deployment planned for Level 6.

## Workspace layout

| Contract | Crate | Purpose |
|---|---|---|
| `energy-credit/` | `energyfi-energy-credit` | Dormant utility token (prepaid credits). Kept deployed for the record; not surfaced in the UI since the fintech conversion (2026-08-06) |
| `installments/` | `energyfi-installments` | Loan products: registry, escrow, admin `disburse_loan` of principal to the borrower, monthly `pay_installment` with **automatic interest routing to the savers' pool**, provider withdrawal with platform fee, admin `claim_fees` (1% pool), **soft-collateral underwriting** (4× loan-to-savings cap, `mark_late`/`settle_default`/`clear_default`, permanent default flag, `check_eligibility`) |
| `project/` | `energyfi-project` | Savings/lending pool: USDC deposits → pool tokens, pro-rata interest distribution from loan repayments (`claim_dividends`), cross-contract `route_revenue` bound to the installments contract |
| `referral/` | `energyfi-referral` | Referral rewards (v2): `register` invites are pending; referee `confirm_usage` (app usage) unlocks, then `claim_referral` pays 0.0001 USDC (or 0.0001 EURC) to both sides once, max 5 referrals per wallet |

## Prerequisites

- Rust (stable/nightly)
- `stellar` CLI (renamed from `soroban`): `cargo install --locked stellar-cli@27.1.0` or
  precompiled binaries: https://github.com/stellar/stellar-cli/releases

## Build & test

```bash
cd energyfi-network/contracts
cargo test --release                 # run all unit tests
cargo build --release --target wasm32v1-none   # produce .wasm artifacts
```

Built artifacts land in `target/wasm32v1-none/release/*.wasm`.

## Deploy to testnet

```bash
# 1. Fund an account (e.g. your Freighter testnet account) with XLM on testnet.

# 2. Deploy the USDC Stellar Asset Contract (classic asset wrapper):
stellar contract asset deploy --asset "USDC:<ISSUER>" --source-account <ADMIN> --network testnet

# 3. Deploy contracts (constructor args pass through after `--`):
stellar contract deploy --wasm target/wasm32v1-none/release/energyfi_energy_credit.wasm \
  --source-account <ADMIN> --network testnet -- \
  --admin <ADMIN> --payment_asset <USDC_SAC> --kwh_price 15000000 --name "EnergyFi Credit" --symbol EFC

stellar contract deploy --wasm target/wasm32v1-none/release/energyfi_installments.wasm \
  --source-account <ADMIN> --network testnet -- \
  --admin <ADMIN> --payment_asset <USDC_SAC>

stellar contract deploy --wasm target/wasm32v1-none/release/energyfi_project.wasm \
  --source-account <ADMIN> --network testnet -- \
  --admin <ADMIN> --payment_asset <USDC_SAC> --share_price 10000000 --total_shares 1000 \
  --name "EnergyFi Lending Pool" --symbol SFE

stellar contract deploy --wasm target/wasm32v1-none/release/energyfi_referral.wasm \
  --source-account <ADMIN> --network testnet -- \
  --admin <ADMIN> --usdc_asset <USDC_SAC> --eurc_asset <EURC_SAC> --reward 100000

# 4. Fund the referral reward pools through the SACs (NOT Horizon payments —
#    contract balances live in the token contract):
stellar contract invoke --id <USDC_SAC> --source-account <ADMIN> --network testnet --send=yes -- \
  transfer --from <ADMIN> --to <REFERRAL_ID> --amount 10000000
stellar contract invoke --id <EURC_SAC> --source-account <ADMIN> --network testnet --send=yes -- \
  transfer --from <ADMIN> --to <REFERRAL_ID> --amount 10000000

# 4. Trustlines: recipients of minted USDC must trust USDC:<ISSUER> first:
stellar tx new change-trust --source-account <ACCOUNT> --network testnet --line "USDC:<ISSUER>"

# 5. Mint USDC via the SAC (admin = issuer):
stellar contract invoke --id <USDC_SAC> --source-account <ISSUER_IDENTITY> --network testnet --send=yes -- \
  mint --to <RECIPIENT> --amount <STROOPS>
```

## Addresses (testnet)

Deployed and initialized `2026-08-04` with `stellar-cli 27.1.0` (testnet, protocol 27).
All three EnergyFi contracts use the **official Circle testnet USDC** Stellar Asset
Contract, so users can self-fund via the [Circle faucet](https://faucet.circle.com)
(USDC → Stellar Testnet) — no custom issuer needed.

| Contract | Address |
|---|---|---|
| `energy-credit` (EnergyFi Credit / EFC, 0.15 USDC per kWh) | `CB56C2Z5LN5ACMY4T4GIVETTNJLNUMMSWSI4UEEZNP5KCBFOJ3PBM7YC` |
| `installments` (v7, secured loans + auto interest routing + defaults + payoff) | `CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM` |
| `project` (EnergyFi Lending Pool v2, auto revenue routing, 1 USDC/share, 1000 shares) | `CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA` |
| `referral` (v2, usage-gated 0.0001 USDC/EURC × 2 sides, max 5/wallet) | `CBURYW3CWH7L3R3RUADXCRNOQIOSKJEGDTBT5PPLS3ZMHKXCXDYFABAE` |
| USDC Stellar Asset Contract (official Circle, testnet) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| USDC issuer (official Circle, testnet) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| EURC Stellar Asset Contract (official Circle, testnet) | `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ` |
| EURC issuer (official Circle, testnet) | `GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO` |
| Deploy/admin account | `GBR5H3DVUZRMG2ESUBZP6SOASOBHKZCWR5VM6YB4FZG7MR3GBQOGOBV5` |

Registered loan products on `installments` v7 (re-registered 2026-08-07): `loan_50` (50 USDC
principal, 4.6/mo × 12, no deposit), `loan_100` (100, 9.2/mo × 12), `loan_200` (200, 18.4/mo × 12),
`loan_500` (500, 46/mo × 12). Total repayment ≈ principal + 10% flat; the interest of every
payment flows **automatically** into the lending pool (project contract) as saver income.

**Soft-collateral pledge requirements** (25% of principal in pool shares, enforced on-chain at
`start_financing` **and** `disburse_loan` from v6; shares are permanently locked so the pledge
can't shrink):

| Loan | Principal | Pledge required (25%) | Interest routed per payment (auto) |
|---|---|---|---|
| `loan_50` | 50 USDC | 12.50 USDC | 0.433 USDC |
| `loan_100` | 100 USDC | 25.00 USDC | 0.867 USDC |
| `loan_200` | 200 USDC | 50.00 USDC | 1.733 USDC |
| `loan_500` | 500 USDC | 125.00 USDC | 4.333 USDC |

### Verified on-chain (2026-08-05)

- Added `referral` contract (workspace member #4) + tests: double-sided payout, self-referral
  block, one-referrer-per-referee, 5-referrals cap, underfunded-pool revert — **20/20 tests pass**
- `installments` v2 redeploy: added `disburse_loan` (admin pays `price - deposit` principal to
  the borrower from the escrow/pool), `Financing.principal_outstanding` tracking, v2 version
  bump. Retired v1 address `CB7BRKNIL…WVS` (BNPL solar demo).
- Loan products registered via SDK seed script (`scripts/seed-onchain.mjs`), which also adds
  the EURC trustline and funds the referral pools through the SACs
- Referral pools funded: **3.0 USDC** (EURC pool pending user's faucet claim)
- **Referral payout verified on testnet** (`scripts/referral-demo.mjs`): registering a referee
  paid +0.01 USDC to the referrer AND +0.01 USDC to the referee (pool 3.0 → 2.98)
- Old v1 `project` bugfix history: `CDZVG2C5…DBL2` retired (holds ~20 testnet USDC, not recoverable)

### Verified on-chain (2026-08-06)

- **Automatic saver-income routing (project v2 + installments v5)** — the interest
  embedded in every loan payment now flows into the pool **inside the same
  transaction** as the repayment. No admin courier, no manual `deposit_revenue`
  (which remains only as a top-up path).
  - `project` v2 → `CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA`:
    new `route_revenue(router, amount)` — `router.require_auth()` binds it to the
    installments contract; revenue booked pro-rata (`rev_per_share`) or held
    `PendingRevenue` before the first share sale.
  - `installments` v6 → `CALB4E6HBUMXBI4IEXNTOH2SBGVNU3VO276JLRHZX3EF7PIHZ3MLB34N`:
    `pay_installment` routes `interest_cut = (months × monthly − price) / months`
    to the pool, then books it cross-contract; `record_payment` counts only the
    principal portion, so provider `withdraw` (1% fee) stays solvent.
  - **Live proof on testnet**: one loan_50 installment → buyer→contract 4,600,000
    stroops, contract→pool 4,333,333 (0.433 USDC interest), `[project, revenue]`
    event emitted, provider corpus exactly 41,666,667. Pool contract holds the
    routed USDC; pending-revenue fold covered by unit tests.
  - **E2E borrow loop run on testnet** (`dev-server/scripts/e2e-borrow-loop.mjs`):
    pending fold — revenue routed before the first share sale became claimable on
    invest (0.4333333 USDC paid out); borrower pledge — 13 shares → eligibility
    `eligible=true, savings=13, max_principal=52, principal=50, required_pledge=12.5`;
    auto-routing — payment 4.6 USDC, corpus delta exactly 41,666,667; saver claim
    of the routed slice exactly `floor(4,333,333/14) = 309,523` stroops; provider
    withdraw 8.2500001 USDC + 1% fee 833,333 stroops accrued; admin `claim_fees`
    drained the fee pool; installments contract balance 0.0000 afterwards (every
    stroop accounted).
  - **39/39 contract tests passing** (3 energy-credit · 15 installments · 8 project ·
    13 referral). `installments` v6 bump → **42/42** with the secured-collateral gate
    (2026-08-07). Old pool `CC3IKONPBZB7SC5LRAOR67JYQCJ7ABWQJQCUNJTZMCNPXXH4HF62WGST`
    still holds earlier deposits (app now points at the new pool).
- **`referral` v2 redeploy** → `CBURYW3CWH7L…FABAE`: rewards are now **usage-gated**.
  `register()` records a pending invite and pays nothing; the referee's own wallet
  calls `confirm_usage()` (the app does this automatically after their first real
  flow — invest, financing, installment — or via the unlock button on the refer
  page), then anyone calls `claim_referral()` which pays **0.0001 USDC/EURC** to
  both sides once, idempotently. Anti-farming: registering empty wallets earns
  nothing. Retired v1 address `CCSU4WLD…2ZB` (holds its old pools, not
  recoverable). New pools funded 1.0 USDC + 1.0 EURC.
- **13/13 referral tests** (usage gate, idempotent claim, wrong-currency block,
  public claim, registration guards, underfunded claim revert).
- **Referral v2 verified on testnet** (`scripts/referral-demo.mjs`): register →
  payout held; referee `confirm_usage` → claim → both wallets +0.0001 USDC.
- **`installments` v3 redeploy** → `CCTTXAZQ…OGDI`: added admin `claim_fees(admin, amount)`
  (admin-gated, capped at accrued fees) + `fees_owed()` view. Withdrawals now accrue the 1%
  fee into a `FeePool` ledger instead of stranding it in the contract balance. Fee claim
  verified by unit tests (claim, non-admin block, over-claim block). Retired v2 address
  `CDKJEZJI…6SVN` (holds the previous ~10 USDC escrow, not recoverable).
- All 4 loan products re-registered on v3 (provider = deploy account) via the seed script.
- Escrow re-funding for v3 pending a Circle faucet claim on the deploy account (~3.1 USDC
  usable; `LOAN_FUND_USDC=10` re-run once topped up).
- **29/29 contract tests passing** (3 energy-credit · 9 installments · 4 project · 13 referral).

### Verified on-chain (2026-08-07, v7)

- **`installments` v7 redeploy** → `CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM`:
  - `Financing.started_at` (ledger timestamp at `start_financing`) — powers the admin
    countdown (`next due = started_at + (paid + 1) × 30d`) and the borrower repay page.
  - **`payoff_loan(buyer, product_id)`** — borrower settles the remaining installments in one
    shot: single `remaining × monthly` transfer, same-tx interest routing
    (`remaining × interest_cut` → pool via `route_revenue`), schedule marked complete
    (`installments_paid = months`, `principal_outstanding = 0`, `late = 0`), panics
    `"financing complete"` on an already-settled loan.
  - All 4 products re-registered + `set_collateral_required(true)` on the new address.
  - **44/44 contract tests passing** (3 energy-credit · 20 installments · 8 project ·
    13 referral), including `financing_records_started_at` and
    `payoff_loan_settles_remaining_balance_at_once`.
  - **Live E2E on testnet**: borrow loop (eligibility → `start_financing` →
    `pay_installment` with exact 41,666,667 corpus delta → claim of the routed slice);
    then `payoff_loan` settled the remaining 11 installments of loan_50 in one shot
    (12/12, outstanding 0, total 55.2 USDC), routed the remaining interest to the pool,
    left the 4-stroop floor remainder in the provider corpus, and the second payoff was
    rejected. Retired: v6 `CALB4E6HB…B34N`, v5 `CCGR5DN…` (live, unreferenced).

### Verified on-chain (2026-08-04)

- Redeployed all 3 contracts against the official Circle USDC SAC
- Registered all 6 products via SDK seed script (`scripts/seed-onchain.mjs`)
- Added official-USDC trustline on the deploy account (Circle faucet funded 20 USDC)
- `deposit_revenue` 10 USDC into `project` dividend pool (pool held by contract)
- **Bugfix redeploy**: `project` re-deployed to `CC3IKONP…GST` after fixing a
  snapshot-ordering bug where revenue deposited *before* the first invest was
  unclaimable by anyone (see `test::revenue_deposited_before_first_invest_is_claimable`).
  Retired address: `CDZVG2C5…DBL2` (holds ~20 testnet USDC, not recoverable).

## Design notes

- **Auth**: all mutating calls use `Address::require_auth()`; admin-only calls are
  gated by the stored admin address (`disburse_loan` on `installments`,
  `deposit_revenue` on `project`, `set_price`/`consume_credits` on
  `energy-credit`). **Ownership is fixed at deployment**: the admin address is a
  constructor argument stored on-chain; there is no `transfer_admin` function yet
  (planned — see Roadmap), so rotating the owner means a redeploy. Current owner:
  `GBR5H3DVUZRMG2ESUBZP6SOASOBHKZCWR5VM6YB4FZG7MR3GBQOGOBV5` (the deploy account).
  User funds are unaffected by admin changes: pools/balances live under the
  contract addresses, not the admin.
- **Overflow safety**: all arithmetic uses checked operations.
- **Events**: contracts publish events (`credit/buy`, `product/register`, `loan/disbursed`,
  `project/invest`, `project/dividend`, `referral/joined`, `referral/paid_*`, ...) for the
  frontend to index.
- **Fee**: installments applies a 100 bps platform fee on provider withdrawals; the fee is
  accrued to a `FeePool` ledger and claimable by the admin via `claim_fees` (admin-gated,
  capped at what actually accrued — user funds are never payable).
- **Referral rewards (v2)**: the referral contract holds both USDC and EURC pools (funded through
  the SACs by admin); `register` records a pending invite and pays nothing; the referee's own
  wallet calls `confirm_usage`, then `claim_referral` pays 0.0001 USDC (or 0.0001 EURC) to both
  sides once in the chosen currency, reverting entirely if the pool is underfunded. Anti-Sybil:
  usage-gated payouts, self-referral blocked, one referee per wallet (first referrer wins),
  max 5 referees per referrer, idempotent claims.
- **Dividend math**: entitlements are computed from a cumulative-revenue
  denominator (`shares / total_shares * cumulative_revenue - claimed`), which
  avoids rounding drift as the pool grows.
- **TTL**: persistent storage is extended to 10k ledgers on write.

## Platform fee lifecycle — the 1% provider fee, end to end

This section walks through exactly where the admin's `Accrued platform fees` number
comes from, how it grows, and the precise conditions that must hold before the admin
can claim it. It exists because this is the most commonly misread number in the
console — the fee is **not** a tax on borrowers and **not** a cut of loan interest;
it is a **provider-side withdrawal fee** that only accrues when the loan provider
pulls settled principal out of the contract.

### Where the money actually goes when a borrower repays

Every repayment (installment or payoff) is split in the same transaction, by
`interest_per_installment = (months × monthly − price) / months` (floor):

| Component | Destination | Who earns it |
|---|---|---|
| `interest_cut` | routed live to the **savings pool** (`project` contract) via `route_revenue` | the savers / pledge holders — claimable as dividends |
| `monthly − interest_cut` | **provider corpus** (`product.total_paid`) | the loan provider (the admin, on this deployment) |
| nothing at this point | — | the admin fee pool is **untouched** |

So GAMFAIX's `loan_50` on v7, fully repaid (1 installment + payoff of the remaining
11):

```
pay_installment  4.60 → interest 0.433333 → pool   · principal 4.166667 → corpus
payoff_loan     50.60 → interest 4.766667 → pool   · principal 45.833334 → corpus
──────────────────────────────────────────────────────────────────────────────
corpus settled        = 50.0000004 USDC
interest to the pool  =  5.2000000 USDC   (becomes saver dividends, NOT admin fees)
```

The 4-stroop dust (50.0000004 vs 50.0000000) is the floor-routing remainder that
stays in the corpus — rounding is always directed against the system (see section 6).

### Where the 1% fee actually comes from

The fee is minted **only** when the provider calls `withdraw(provider, product_id)`:

```text
fee  = settled × FEE_BPS / 10000          // FEE_BPS = 100  →  1%
settled = product.total_paid − product.withdrawn
payout = settled − fee                    // sent to the provider's wallet
FeePool += fee                            // this is the admin's claimable
```

For the corpus above: `withdraw` on `loan_50` sends **49.5000004 USDC** to the admin
wallet and banks **~0.5000000 USDC (1%)** into the fee pool. That 0.50 — and only
that — is what shows up as `Accrued platform fees`.

Every 0.50 in the pool is therefore traceable to a specific borrower's repayments:
the fee is a 1% slice of the *principal* they repaid. GAMFAIX's 0.50 fee comes from
his 50 USDC principal; his 5.20 interest never touches the fee pool — it is already
inside the savings pool as saver income.

### Why savers' deposits (pledges) never accrue a fee

A borrower who invests pool shares as soft collateral ("saves money") triggers **no**
fee:

- The pledge is a `project.invest` — it mints pool tokens and increases saver
  claimables, nothing happens in the installments contract.
- Pledge shares are locked as collateral; they are never "withdrawn" through
  `installments.withdraw`, so `FeePool` never grows from them.
- The only path into the fee pool is `withdraw()` on a product corpus, which exists
  only after borrowers repay.

Short rule of thumb: **fees follow repayments that the provider withdraws**, not
deposits.

### The exact conditions for a successful `claim_fees`

All four must hold, or the call reverts (`claim_fees` at `lib.rs:525`):

1. **Caller is the stored admin** — the address baked in at deployment
   (`GBR5H3DVUZRMG2ESUBZP6SOASOBHKZCWR5VM6YB4FZG7MR3GBQOGOBV5`). Any other signer
   → `"not the admin"`.
2. **Amount is positive** — `amount > 0`, otherwise `"amount must be positive"`.
3. **Amount does not exceed the accrued pool** — `amount ≤ fees_owed()`, otherwise
   `"amount exceeds accrued fees"`. This is what makes repeated claiming impossible:
   the pool is drained by exactly the amount claimed, so a second claim on an empty
   pool fails.
4. **The contract holds real USDC** — `claim_fees` performs an actual SAC transfer
   from the installments contract to the admin; if the contract's balance can't
   cover `amount`, the transaction reverts.

Because of condition 3, the correct operation is **one claim per withdrawal**: claim
the full `fees_owed()` value (the admin console's "Claim all" does this) and the pool
returns to 0. It only refills after the next provider `withdraw`.

### The full lifecycle, with the admin console

```text
borrower repays (installment / payoff)
        │  interest → savings pool (saver dividends, never a fee)
        ▼
provider corpus grows (product.total_paid)
        │
admin presses "Withdraw (X USDC)"   ← added to the console (2026-08-07)
        │  99% → admin wallet, 1% → FeePool
        ▼
Accrued platform fees = 0.50 USDC   (was 0 before any withdrawal)
        │
admin presses "Claim (0.50 USDC)" / "Claim all"
        ▼
FeePool = 0 · admin wallet +0.50 USDC
        │
        └─ the cycle repeats only when the next repayment corpus is withdrawn
```

A fresh deployment shows `Accrued platform fees = 0 USDC` and a disabled claim
button **even with loans fully repaid** — that is correct behaviour, not a bug: no
`withdraw()` has been called, so nothing has accrued yet.

## Worked example — the GAMFAIX roundtrip (live on v7, 2026-08-07)

The most recent complete borrower lifecycle on the current contract (`loan_50`,
borrower `GAMFAIXVHCFIA73N4KZRTTNPGFPUHO4E45MROJOUCLYGHWACJZAKC7VD`). All numbers
are the actual on-chain values from the `pay_installment` + `payoff_loan` sequence:

**What the borrower paid out**

| Item | Amount (USDC) |
|---|---|
| 1 × installment | 4.60 |
| payoff (11 installments) | 50.60 |
| **Total paid out** | **55.20** |

**Where that 55.20 ended up**

| Bucket | Amount (USDC) | Recipient |
|---|---|---|
| Principal corpus → `withdraw` | 49.5000004 | admin **wallet** (their own capital returned) |
| 1% fee → `claim_fees` | 0.5000000 | admin (actual profit) |
| Interest → savings pool | 5.2000000 | savers / pledge-holders (dividends) |

**Reading the numbers**

- GAMFAIX's total paid = **55.20**. The admin "gained as claimed" = **50.00**
  (49.50 wallet + 0.50 fee). The **5.20** is already inside the savings pool —
  nobody "gets" it wholesale; the admin's slice is only pro-rata through their own
  pool shares, like any saver.
- **Net reality of these testnet runs:** the v7 loan was **never disbursed** — the
  escrow was not funded on v7 before the admin topped it up. So GAMFAIX paid 55.20
  without receiving a 50 principal *on that contract* (his earlier disbursals
  came from the v5/v6 contracts). The cycle gains full realism once the escrow is
  funded: top up the escrow, the borrower gets disbursed 50, repays 55.2, and the
  principal flows back to the provider via `withdraw`.

## Pledge lock — why the 13 USDC savings stake is not withdrawable

A borrower's pool-shares pledge (e.g. the 13 USDC GAMFAIX put in for `loan_50`)
**cannot be redeemed** under the current contracts. Two facts, from source:

1. **No withdrawal entry-point exists on `project`.** Its full public surface is
   `invest`, `deposit_revenue`, `route_revenue`, `claim_dividends` and read-only
   views (`project/src/lib.rs:98-347`). Savers can put money in and claim
   dividends, but there is no function to pull principal back out.
2. **`installments` depends on that.** `disburse_loan` re-checks the pledge with
   the comment: *"Shares are locked in the savings pool (no withdrawals), so the
   pledge cannot shrink after this check"* (`installments/src/lib.rs`). The
   entire underwriting model — 25% soft-collateral, 4× loan-to-savings cap —
   assumes the collateral is permanently locked; otherwise a borrower could
   pledge, take the loan, then drain the collateral out from under it.

For GAMFAIX this means: the 13 USDC is **his**, earning dividends from future
borrowers' repayments, but the principal is permanently pooled — he can claim the
interest any time, never the stake. This is a documented product limitation, not a
safety gap. Removing the lock (exit queues, time-staged redemption, loss-sharing
reserve) is a candidate v8 design; see the planning section below.

## Heading for v8 — what the next contract should add

v7 closes the *operational* loop (repay + fee claim + admin console). v8 is about
liquidity and risk, in priority order — all are additive (new functions) on a
redeploy, not breaking changes:

1. **Saver redemption** — allow exiting pool shares with a lock-up / exit queue,
   so pledge collateral becomes real liquidity (makes the "permanently locked
   pledge" section above obsolete). Needs the pooled-principal model to know what
   is committable at any time.
2. **Automatic escrow ("just-in-time lending")** — the contract should self-fund
   loan disbursals from the pool balance when liquidity allows, instead of asking
   the admin to top the escrow by hand; the 1%-fee cycle above then runs without
   admin liquidity operations.
3. **Time-based late → default** — today `mark_late`/`settle_default` are admin-
   triggered. On-chain grace-period math (next due = `started_at + (paid+1)×30d`)
   would auto-flag loans, with admin override still possible.
4. **Default-loss reserve** — an explicit write-off pool funded from fees, so
   book losses on defaults never touch saver principal silently.
5. **Pledge that scales with the loan** — current cap `pledge × 4 ≥ principal`
   works per loan; multi-loan concurrency would need aggregate-cap accounting.

No v8 work is started; this list is the agreed next batch once the v7 loop is
signed off.

## Security model & features (exhaustive)

### 1. Authentication & authorization (all contracts)

- Every state-changing function starts with `Address::require_auth()` — no operation can be
  performed on behalf of another account (no delegation, no keyless entry points).
- **Admin-gated functions** (caller must equal the admin address stored at construction):
  - `installments`: `disburse_loan`, `mark_late`, `settle_default`, `clear_default`,
    `claim_fees`, `deactivate_product`
  - `project`: `deposit_revenue` (manual top-up path only — see §3 routing)
  - `energy-credit`: `set_price`, `consume_credits`
- **Cross-contract auth**: `project.route_revenue(router, amount)` calls `router.require_auth()`.
  Only the installments contract itself — as the immediate caller passing its own address — can
  book saver revenue. A wallet or any other contract passing the router's address fails the check
  (unit test: `route_revenue_rejects_unknown_router`).
- **Ownership is fixed at deployment**: the admin is a constructor argument stored on-chain;
  there is no `transfer_admin` (see Roadmap), so rotating the owner means a redeploy. User funds
  live under the contract addresses, never the admin wallet — an admin change can't touch them.

### 2. Underwriting — soft collateral & defaults (installments v4)

- **Loan-to-savings cap**: principal ≤ 4× the borrower's pool shares (`LOAN_MULTIPLE = 4`,
  i.e. a 25% pledge), enforced in `disburse_loan` via a cross-contract read of the project pool
  (`get_investor` × `share_price`).
- **Pledge permanence**: pool shares are permanently locked (the pool has **no withdrawal
  function**), so the pledge cannot shrink after the check passes — the 4× cap is a hard
  guarantee for the life of the loan, not a point-in-time check.
- **Real eligibility verdict** (`check_eligibility(borrower, product_id)`): returns
  `{eligible, defaulted, already_started, savings, max_principal, principal, required_pledge}`.
  The frontend shows the actual reasons (exact shortfall, defaulted, already started) — no fake
  credit scores.
- **Default lifecycle**: `mark_late(admin, buyer, product)` (increments the late counter,
  feeds the borrower's "installment overdue" notification) → `settle_default(admin, buyer,
  product)` (writes the loan off, sets a **permanent** `Defaulted(borrower)` flag, indexes the
  account, emits `loan/defaulted` with the written-off outstanding) → `clear_default(admin,
  buyer)` (documented admin discretion).
- **Defaulted wallets are blocked everywhere**: `start_financing` panics
  (`"account defaulted"`), `check_eligibility` rejects permanently, and the admin console shows
  the flag. `settle_default` resets the late counter; `is_defaulted` backs the frontend
  notification + admin rows.
- **Borrower indexing**: `borrower_count/at` + `defaulted_count/at` power the admin
  "Loans & defaults" panel (per-loan status, mark/settle/clear actions).
- **Book-loss honesty**: v1 writes off the principal as a transparent book loss displayed in
  the admin console — no silent dilution of saver funds (pledge *burn* and the loan-loss
  reserve are the documented next phases, see `../docs/UNDERWRITING.md`).

### 3. Loan money-movement safety (installments v6)

- **Escrow separation**: loan principals disburse from the installments escrow (liquidity the
  admin injects), never directly from saver deposits; repayments flow back through the provider
  `withdraw`.
- **Secured loans (v6)**: products carry a `secured` flag; a provider can turn it on
  (`set_collateral_required`). For secured products, `start_financing` now requires the
  borrower to already hold `≥ 25%` of principal in pool savings (`pledge × LOAN_MULTIPLE ≥
  price − deposit`) or the whole transaction reverts — before v6 this was only enforced at
  `disburse_loan`, letting a 0-pledge wallet sign a loan. `disburse_loan` re-checks it too
  (defense in depth). Regression tests: `secured_loan_rejects_sign_without_pledge`,
  `secured_loan_starts_when_pledge_is_held`, `only_provider_can_flip_collateral_required`.
- **Automatic interest routing — real funds first**: each `pay_installment` transfers the exact
  interest portion `(months × monthly − price) / months` into the pool **before** booking it via
  `route_revenue`. Savers' claimable only ever grows from money already inside the pool; a
  routing failure reverts the whole payment.
- **Corpus integrity**: `record_payment` counts only `monthly − interest_cut` — the routed cut
  never enters the provider's settled corpus, so `withdraw` can never be left short of balance
  (test: `routed_interest_keeps_provider_withdraw_solvent`).
- **Disburse guards**: product active, financing exists, no double disburse, principal > 0,
  pledge cap passed.
- **Withdraw guards**: only the product's provider may withdraw; `settled = total_paid −
  withdrawn` (no double withdrawal); the 1% fee is withheld into a separate `FeePool` ledger.

### 4. Pool & dividend safety (project)

- **Invest guards**: amount > 0, at least one share, hard oversubscription cap (`total_shares`
  = 1000) — the pool can never mint more shares than issued.
- **Pending-revenue fold**: revenue booked before the first share sale is held in
  `PendingRevenue` and folded into `rev_per_share` at first invest — the first-investor trap is
  closed (regression test: `revenue_deposited_before_first_invest_is_claimable`).
- **Snapshot math**: entitlement = `shares × rev_per_share − snapshot − claimed` (fixed-point
  `SCALE`); new shares enter at the current accrual rate so no past revenue is owed; claims are
  idempotent (double-claim yields 0).
- **Real-funds-first**: revenue lands in the pool balance before it is booked; `claim_dividends`
  pays only what the pool actually holds.

### 5. Referral anti-abuse (referral v2)

- **Usage-gated payouts**: `register` records a pending invite and pays nothing; only the
  referee's own wallet's `confirm_usage` unlocks the payout (the app calls it automatically
  after a real flow — invest, financing, installment — or via the unlock button).
- **Idempotent claims**: `claim_referral` pays each side **once**, in exactly one currency.
- **Sybil guards**: self-referral blocked; one referrer per referee (first wins); hard cap of 5
  referees per wallet; registering empty wallets earns nothing.
- **Pool safety**: underfunded pool → full transaction revert (no partial payouts); wrong-
  currency claims blocked.

### 6. Accounting, arithmetic & operational safety

- **Checked arithmetic everywhere** (`checked_add/sub/mul/div`) — overflow reverts.
- **Rounding is always floor, directed against the system**: fees/interest floors leave dust in
  the pool, never minted; a claim's truncation dust stays with the pool (never more payable than
  received).
- **TTL hygiene**: persistent storage is extended to 10k ledgers on write (entries can't
  vanish mid-loan).
- **Full event surface** for transparency and indexers: `credit/buy`, `product/register`,
  `loan/disbursed`, `loan/late`, `loan/defaulted`, `loan/default_cleared`, `project/invest`,
  `project/revenue`, `project/dividend`, `referral/joined`, `referral/paid_*`.

### 7. Known limitations (honest position)

- Defaults are **admin-triggered** (no time-based grace yet) — deferred to the underwriting
  roadmap (`../docs/UNDERWRITING.md` §4).
- Pledge **burn** on default is not implemented (v1 sets a flag only; the borrower keeps their
  savings) — §0 "Deferred" in the underwriting doc.
- No **loan-loss reserve** yet — a default is a transparent book loss, not pre-funded.
- No `transfer_admin`; admin rotation requires a redeploy.
- No **KYC**; on testnet (free faucet money) no economic anti-sybil defense can be stressed —
  the demo proves the *mechanisms*, not sybil resistance (§8 of the underwriting doc).

### 8. Test coverage (security-critical)

**39/39 tests across 4 contracts** (3 energy-credit · 15 installments · 8 project · 13
referral). Notable cases: `route_revenue_rejects_unknown_router`, `route_revenue_before_first_
invest_is_pending`, `loan_requires_savings_pledge` (cap boundary), `mark_late_settle_and_clear_
default`, `installments_route_interest_to_pool_automatically` (exact stroop accounting),
`zero_interest_product_routes_nothing`, `routed_interest_keeps_provider_withdraw_solvent`,
`cannot_oversubscribe`, `amount_below_share_price_reverts`, fee cap/over-claim blocks,
`only_admin_can_claim_fees`, referral self-block + cap + idempotence + underfunded revert.

## Roadmap (contracts)

- [x] Unit tests for all four contracts (42 tests passing, 2026-08-07)
- [x] Deployed + verified on testnet (2026-08-04/05/06)
- [x] Soft-collateral underwriting slice v1: 4× loan-to-savings cap, default lifecycle, real eligibility (installments v4, 2026-08-06)
- [x] Automatic saver-income routing (project v2 + installments v5, 2026-08-06)
- [x] Secured-collateral gate enforced at sign time, not just at disburse (installments v6 + `set_collateral_required`, 2026-08-07; bypass probe now reverts on-chain, E2E re-verified on v6)
- [ ] Admin ownership transfer: `admin()` getter + admin-gated `transfer_admin(new_admin)` — lets the owner rotate the admin address without touching user funds (deferred; currently a redeploy is the only rotation path)
- [ ] Underwriting phase 2: pledge burn on default, loan-loss reserve + penalties, time-based grace (see `../docs/UNDERWRITING.md` §0 "Deferred")
- [ ] Gas optimization pass (key packing, TTL bumps)
- [ ] Fee-sponsorship wrapper (gasless first transactions) — Level 6 advanced feature
- [ ] Mainnet deployment + verification — Level 6
- [ ] Security review / audit — Level 6
