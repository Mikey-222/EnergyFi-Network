# Soft Collateral + Default Handling — Design Sketch

**Status:** sketch / proposal — not implemented
**Context:** EnergyFi is a credit-union / community-lending model digitized on-chain, *not* an Aave-style overcollateralized lending protocol. There is no collateral liquidation; eligibility is trust/reputation-based. This document designs the missing risk surface: what eligibility checks, and what happens on default.

Design goal: bolt onto the existing contracts (installments v3 + project pool + referral v2) rather than replace them.

---

## 0. Implemented slice (v1, live on testnet — 2026-08-06)

`contracts/installments` v4 (deployed: `CAFOTIUYXIN4MT32SUQORZWEJJGO7JA5TNIBKLTY5H2DGDD3U55GUDT7`) plus frontend:

- **`mark_late(admin, buyer, product_id)`** — admin flags a disbursed, incomplete loan as late (+1 per call); feeds the borrower "Loan installment overdue" notification.
- **`settle_default(admin, buyer, product_id)`** — admin writes a loan off; sets a permanent `Defaulted(borrower)` flag; publishes `loan/defaulted` event with the written-off outstanding.
- **`clear_default(admin, buyer)`** — admin override (documented admin discretion).
- **`is_defaulted` / `check_eligibility(borrower, product_id)`** — real on-chain verdict: not defaulted, no existing financing, pool savings ≥ 25% of principal (4x loan multiple). No funds move in v1 — the written-off principal is a transparent book loss shown in the admin console.
- **Borrower indexing** (`borrower_count`/`borrower_at`, `defaulted_count`/`defaulted_at`) — powers the admin "Loans & defaults" panel (Mark late / Settle default / Clear default per loan row).
- **Loan-to-savings cap enforced at `disburse_loan`** — cross-contract read of the project pool (`get_investor` × `share_price`); principal ≤ 4x savings. Shares are permanently locked in the pool (no withdrawals), so the pledge can't shrink after the check. A 500 USDC loan requires 125 USDC of pool savings.
- **Eligibility screen rewired** — no more fake 850 credit score; shows the real verdict + reasons, with "Save in the pool" CTA showing the exact shortfall.
- 12 installments tests (3 new: pledge cap, mark_late/settle/clear lifecycle, eligibility view); workspace 32/32 green.

**Deferred (remainder of this doc):** pledge *burn* on default (currently only a flag — the borrower keeps their savings), guarantor path, reserve + penalties, time-based grace (defaults are admin-triggered in v1), referrer-bonding, cluster detection, KYC. §9's term-deposit schedule is **superseded by §10** (automatic interest routing) — see the note there.

---

## 1. The idea in one line

Borrowers back loans with a **pledge of their own pool shares** (skin-in-the-game, no liquidation), and every loan feeds a **loan-loss reserve** so a default never silently vaporizes saver money — savers' downside is bounded and mostly pre-funded by borrowers themselves.

## 2. New state

**Project contract** (owns shares + pool USDC):

- `Pledge(pledger, borrower) -> shares` — a saver (`pledger`) pledges their shares to back `borrower`'s loan. No transfer; a ledger entry. Pledged shares' dividends still accrue but can't be claimed until release.
- `Reserve` — USDC stockpile for defaults (like a credit-union loan-loss fund).

**Installments contract** (owns loan lifecycle):

- `Defaulted(Address)` — permanent (until admin clears) reputation flag.
- `Penalty(Address)` — accrued late penalties.
- `LastPayment(Address)` — ledger timestamp for grace calculations.

## 2b. Who pledges — dual path (resolved)

- **Guarantor path (primary)**: any *other* saver pledges their shares to back a borrower — in practice the referrer. Converts referrals into an economic relationship: guarantor earns the existing referral reward plus a **1% guarantee fee** (paid from origination into the guarantor's claimable dividends), and carries real downside (their pledge burns on default).
- **Self path (fallback)**: a saver pledges their own shares — loan capacity scales with own skin in the game.
- **Neither → eligibility rejects** with a visible reason ("No guarantor pledge — ask a neighbour who saves").

**Pledge lifecycle:** `pledge` anytime before `disburse_loan` → locked at disburse → `unpledge` reverts while the backing loan is active (`disbursed`/`late`) → released in full (with accrued dividends) on full repayment → burned in full on default. No partial unlocks, no mid-loan exits.

## 3. Eligibility becomes real (replaces the fake 850-spinner)

New on-chain view `check_eligibility(borrower)` on installments, returned to the frontend:

1. `Defaulted(borrower)` absent — no history of default
2. No active loan already (one per wallet — already the model)
3. **A pledge ≥ 25% of principal** exists (self or guarantor — cross-contract read of the project contract)
4. Optional gate: arrived via a verified referral (cross-contract read of the referral contract) — the community-accountability hook

The screen shows the actual verdict + the three checked facts instead of a hardcoded approval.

**Cross-contract reads:** standard `env.invoke_contract` calls to public views (`pledged_value`, `confirmed`). Rule: the called view must not call `require_auth` (auth does not propagate to read frames); the default-status check lives in installments where the state is.

## 4. Default lifecycle

- **Grace**: primary rule is time-based — *any* installment unpaid for >30 days past its due date → defaultable (defeats pay-1-skip-2 ping-pong, since skipping two installments always crosses 30 days). Secondary: ≥2 missed in any trailing 6-installment window. Checked in `settle_default` (keeper/admin callable).
- **Penalty**: 1.5%/month on the overdue amount, accrued per late installment, payable on top of the installment. Penalties flow **into the reserve**, not to admin — savers get compensated for risk.
- **Settlement** (keeper/admin calls `project.settle_default(borrower)` — project verifies default status by cross-contract call to installments):
  1. **Pledge burns first**: the pledger's shares are burned at share price to cover the shortfall (borrower *or guarantor* loses their skin in the game)
  2. **Reserve covers next**: shortfall paid from reserve *up to its balance* → distributed to all savers as dividends (rev_per_share bump)
  3. **Remainder**: transparent book loss — admin console shows the uncovered shortfall; savers simply earn less revenue than projected (no forced dilution beyond what the reserve covers)
- `Defaulted(borrower)` set → eligibility permanently rejects; **unpledge of that pledge is void** (locked in).

**Reserve floor guard:** `disburse_loan` requires admin override when reserve < 5% of outstanding principal — protects the first loan cohort before fees accumulate.

## 5. Reserve funding (pre-funded defaults)

- **2% origination fee** on each disbursed principal → reserve
- **1% of every installment** → reserve (symmetric with the existing 1% admin withdraw fee)
- All **late penalties** → reserve

With ~2% origination + 1%/installment, a 12-month loan contributes ~14% of principal to the reserve before any default — a single 25%-pledge shortfall is fully covered by the pool's own economics, not by saver losses.

## 6. Loan math for the demo

| Parameter | Value |
|---|---|
| Min pledge | 25% of principal (self or guarantor) |
| Guarantee fee | 1% of principal → guarantor's dividends |
| Origination fee | 2% → reserve |
| Repayment reserve cut | 1% / installment |
| Late penalty | 1.5% / month overdue |
| Grace | >30 days past due, or 2 missed in any 6-installment window |
| Default flag | permanent (admin can clear) |
| Reserve floor | disburse needs admin override if reserve < 5% of outstanding principal |

## 7. Work breakdown

- Project contract: `pledge` / `unpledge` / `settle_default` / `reserve` / `pledged_value` view (+ cross-contract auth checks; read views must not call `require_auth`)
- Installments: penalty accrual, time-based default marking, `check_eligibility` view (reads project + referral), reserve payments on installments, reserve-floor guard on `disburse_loan`
- ~10–12 new contract tests, rebind, redeploy both contracts
- Frontend: eligibility screen rewired to the view (shows real verdict + missing pledge reason); admin gets "Settle default", reserve balance, and uncovered-shortfall display

## Deferred on purpose

- **KYC** (admin-set flag, off-chain) — the pseudonymous-wallet reputation hole stays open but is a known, labeled limitation rather than an unspecified one
- **Referral-as-hard-gate** (make verified referral a requirement) — easy to flip on later since the cross-contract read exists

## 8. Sybil & "borrow and run" — threat model

One user, many wallets, borrow max each, default, leave.

**Per-wallet economics** (loan 200 USDC):

| Wallet-pair (borrower + saver-guarantor) | USDC |
|---|---|
| Attacker invests pledge (25%) | −50 |
| Borrows and defaults | +200 |
| Pledge burns (covers shortfall) | −50 |
| Reserve pays (2% origination only — a defaulter never pays the 1%/installment cuts) | −4 |
| Pool book loss | ≈146 |
| Attacker net | **+150** |

**Consequences:** one default ≈ erases the reserve+interest of ~5 fully-repaid loans. The reserve is a smoothing tool, not a sybil defense; the pledge deters a real borrower from destroying their own reputation, not disposable wallets. The flat cap bounds *per-wallet* damage; sybils scale it linearly.

**Closing layers, in product-fit order:**

1. **Referrer-bonding** — referral reward + 1% guarantee fee escrowed until the referee's loan is fully repaid; default forfeits them and damages referrer standing (their next referees need bigger pledges). Vouching becomes economically expensive; sybil needs a whole fake neighborhood.
2. **Trust-graph restriction** — loans require a verified referral from a wallet with standing (no defaults 1–2 levels deep).
3. **Cluster detection (off-chain, admin risk view)** — same funding source, clustered timestamps, star-shaped referral graphs → flag before disburse.
4. **Warm-up** — borrower wallet needs saving/repayment history before first loan.
5. **KYC** (deferred above) — the only true per-identity cap; breaks pseudonymity.

**Honest position:** on testnet (free faucet money) no economic defense can be stressed — the demo proves the *mechanism* (pledge burn, reserve draw, book-loss visibility), not sybil resistance. On mainnet, flat cap + pledge + referrer-bonding bound damage per identity, with KYC as the terminal control.

## 9. Saver term-deposit schedule — the pool's clock (superseded by §10)

> **Superseded 2026-08-06.** This section asked the wrong question ("when will I be paid?") and answered it with a fixed schedule, which converts the pool into a bank with fixed deposit liabilities. §10 answers the same complaint with **automatic real income**: interest flows into the pool inside the repayment transaction itself. Keep this section only as the long-term product model for a *funded* pool, gated on the funding-floor analysis.

**Problem this solves:** today the pool is *event-driven* — a saver's claimable grows only when the admin happens to deposit revenue; there is no time dimension, and the principal is permanently locked. A saver cannot answer "when will I be paid, and do I get my money back?"

**Model:** the pool becomes a term-deposit / fixed-deposit product. Deposit amount selects a **tier → term + fixed rate**. The contract's own clock (`env.ledger().timestamp()`) opens the maturity window — no admin action needed at payout time.

| Tier | Deposit (USDC) | Term | Fixed rate (annualized) |
|---|---|---|---|
| T1 | 1–9 | 30 days | 8% |
| T2 | 10–99 | 60 days | 10% |
| T3 | 100–499 | 90 days | 12% |
| T4 | 500–999 | 180 days | 14% |
| T5 | 1000+ | 360 days | 16% |

Example: 1 USDC → T1 → 30 days → claim 1.0066 USDC (principal + interest); 500 USDC → T4 → 180 days → claim 534.2 USDC.

**Mechanics:**

- `invest(amount)` creates a **deposit lot** `{principal, started_at, term_secs, rate}` (per-deposit id, since lots mature independently). Shares remain the unit of claim as today.
- `claim_matured(lot_id)` — once `started_at + term_secs ≤ env.ledger().timestamp()`: pays **principal + fixed interest** from pool balance; lot marked claimed. Before maturity, claimable is 0 (fixed product; the variable `rev_per_share` revenue stream stays as a bonus on top if it exists).
- **Pledges (§2b) coexist:** a lot used as a loan pledge still matures on schedule; if a default burns the pledge, the lot is burned with it (saver loses principal + interest — the skin-in-the-game guarantee now has a real time-boxed value).
- The **loan-to-savings 4x cap (§0)** keeps working: shares/pledge value still measured as now; a locked-in lot can't exit early anyway, so the pledge can't shrink.

**Who funds the payout — the answer to "when the time reaches, admin adds USDC":**

- The admin seeds an **interest reserve once** (one-time `seed_reserve`), like a bank funding a CD book. From then on payouts are **mechanical** — the contract pays from the reserve + pool balance at maturity. Stellar has no cron/scheduler, and a payout that depends on a human remembering is a broken promise, so the *funding* happens up front and the *payment* is automatic.
- Loan repayments (1%/installment cut from §5) continuously refill the reserve — the loan book funds the fixed rates. That is the actual business model question: **the loan book must out-earn the fixed terms**, or the reserve shrinks.
- **Funding floor (extends §4's reserve-floor guard):** if `reserve + pool < Σ outstanding term liabilities`, the contract pauses new term deposits until funded — fixed-rate promises are never written the pool can't honor.

**Honesty rules (same standard as the projected APY, but time-boxed):**

- Rates are **fixed at deposit time** (snapshot in the lot — immune to later governance fiddling), but they are reserve-backed promises: if the loan book underperforms and the reserve can't cover a maturity, that lot pays **pro-rata with the shortfall shown as a visible book loss** in the admin console — no silent dilution of other savers, no hidden admin bailout.
- UI copy changes from "projected APY" to "fixed term rate, reserve-backed".

**Contract surface (project contract, v3):** `DepositLot` state, `invest` rework (lot creation + tier snapshot), `claim_matured`, `matured_balance` view, `reserve` + `seed_reserve`, funding-floor guard, pledge interaction with lots. ~8–10 new tests, rebind, redeploy, saver wallet UI gets a "My terms" view (each lot: tier, rate, maturity date, claim button).

**Status:** design only — not implemented. Gate question for the user: keep the pool as *pure lending income shares* (current) or convert to *term deposits* (this section)? The two change the saver promise materially and the admin's operational role (manual revenue drops vs. one-time reserve seed).

## 10. Automatic revenue routing — the pool pays itself (the right thing, 2026-08-06)

**Problem:** income reaches savers only through an admin courier loop — borrower pays installments → admin manually `withdraw`s from installments → admin manually `deposit_revenue`s into the pool. Nothing is automatic, and nothing is "real" until a human acts. The timing complaints (§9) are a symptom of this.

**Model:** the interest embedded in every loan payment **is** the savers' income, and it must flow into the pool inside the *same transaction* as the repayment. No courier, no projection, no admin dependency, no schedule.

**Product math (exact, not a fee guess):** total repaid = `months × monthly`; total interest = `total_repaid − price`. Each monthly payment carries `interest_cut = total_interest / months` (floor; sub-stroop remainder stays in the provider corpus). Examples: loan_200 → 18.4/mo, total 220.8, interest 20.8 → **1.73 USDC routed to the pool per payment**; loan_500 → 52/12 = 4.33/payment.

**Mechanics (installments v7 + project v2, both additive):**

`pay_installment` (installments v7), after the borrower pays `monthly` into the contract:
1. `interest_cut = (months × monthly − price) / months`
2. `token.transfer(installments → project_pool, interest_cut)` — real USDC moves, same tx
3. `project.route_revenue(installments, interest_cut)` — new view; `router.require_auth()` makes it callable *only* from the installments contract (cross-contract auth: the caller passes its own address; `require_auth` fails for any other immediate caller). Pools the existing `rev_per_share` bump + `PendingRevenue` path when no shares are sold yet.
4. `record_payment` counts only `monthly − interest_cut` — the routed cut **never enters the provider's settled corpus**, so `withdraw` (provider principal + 1% fee → FeePool) keeps working without balance shortfalls.

`payoff_loan` (installments v7): the borrower settles the **remaining** installments in one shot —
1. `remaining = months − installments_paid`; panics `"financing complete"` when `0` (idempotent guard).
2. `lump = remaining × monthly` — single `transfer` from the borrower into the contract.
3. Same same-tx interest routing: `remaining × interest_cut` to the pool via `route_revenue`.
4. Marks the schedule complete (`installments_paid = months`, `principal_outstanding = 0`, `late = 0`) and calls `record_payment(lump − cut)`.

Every financing also records `started_at` (ledger timestamp), powering the admin countdown (next installment due = `started_at + (paid+1)×30d`) and the borrower repay page.

Result: **savers' claimable grows in the same block the repayment lands** — real money already inside the pool before it is claimable. Admin `deposit_revenue` remains only as a manual top-up (demo/grants), no longer the designed income path.

**Why this is the right thing:**
- *Real* — claimable only grows when a borrower actually repays; the pool holds the funds first.
- *Automatic* — the repayment transaction completes the loop; no cron, no oracle, no human memory.
- *Timing dissolves* — income arrives exactly when repayments do; the UI shows real events, not schedules or APY projections.

**UI data model (wallet / claim page, replacing "projected APY"):**
- `claimable` — on-chain entitlement, unchanged.
- Event feed per saver, from on-chain events: "Borrower paid installment · your pool earned +X USDC" (real `RevenueDeposited` events), and "Loan disbursed" / "Borrower defaulted" context rows.
- Copy: "Interest from repaid loans" instead of "projected APY"; keep "principal stays locked in the pool".

**Status: IMPLEMENTED & LIVE (project v2 + installments v7, redeployed 2026-08-07).** Live smoke test on testnet: one `pay_installment` on loan_50 moved 4,333,333 stroops of interest into the pool in the same transaction (`[project, revenue]` event), provider corpus excluded the cut exactly (41,666,667 stroops after one payment). Pending-revenue fold into claimable is covered by tests and was verified on 2026-08-06 (claim 0.4333333 USDC). Secured-collateral gate (v6): `start_financing` now reverts for a 0-pledge wallet on secured products — verified on-chain 2026-08-07. Payoff/started_at (v7): a live `payoff_loan` on testnet settled the remaining 11 installments of loan_50 in one shot (12/12, outstanding 0), routed `11 × 1/12` of the interest to the pool, left a 4-stroop floor remainder in the corpus, and rejected a second payoff (`"financing complete"`) — E2E verified 2026-08-07.

Deployed addresses: project `CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA`, installments `CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM`. Superseded: v6 `CALB4E6HBUMXBI4IEXNTOH2SBGVNU3VO276JLRHZX3EF7PIHZ3MLB34N` and v5 `CCGR5DN…` (both remain live but are no longer referenced by the app).
