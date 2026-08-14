# EnergyFi-Network

Community energy finance on Stellar — savings, lending, and referral rewards built as a
family of Soroban smart contracts, with a web frontend that talks to them directly on
testnet.
![banner](docs/screenshots/banner.png)

## What it does

- **Savings pool** (`project`): a community lending pool with a fixed 1 USDC share price.
  Savers invest, the pool's only income is _real_ revenue — automatically routed saver
  interest from loan repayments (plus optional manual top-ups) — and dividends are claimed
  pro-rata from what the pool actually holds. Shares are permanently locked (no
  withdrawals): that permanence is what makes the soft-collateral pledge work.
- **Installment loans** (`installments`): pay-as-you-go loans (`loan_50` … `loan_500`) with
  soft-collateral underwriting — a borrower needs 25% of the principal in pool shares (a
  4× loan-to-savings cap), enforced on-chain at disbursal. Every `pay_installment` **routs
  the interest portion straight into the savings pool in the same transaction** (automatic,
  event-driven income — no admin courier). Default lifecycle: `mark_late` →
  `settle_default` (permanent flag) → `clear_default`. Providers withdraw settled principal
  minus a 1% platform fee.
- **Referral rewards** (`referral`): usage-gated payouts (a referee's own wallet must
  `confirm_usage`), with sybil guards (self-referral blocked, one referrer per referee,
  max 5 referees).
- **Energy credits** (`energy-credit`): buy kWh credits (1.5 USDC per kWh) for community
  energy settlements.

A full security model (auth, pledge integrity, routing solvency, rounding, events,
limitations) is documented in [`contracts/README.md`](contracts/README.md),
and the underwriting economics in [`docs/UNDERWRITING.md`](docs/UNDERWRITING.md).

## LIVE DEMO LINK

[Demo Link Website](https://energy-fi-network.vercel.app/)

## Layout

```
├── contracts/            # Soroban contracts (project, installments, referral, energy-credit)
│   └── README.md         # contract docs + exhaustive security model + deploy addresses
├── dev-server/           # web frontend + dev tooling
│   ├── src/              # React app (savings pool, loans & defaults, referral, credits)
│   │   └── lib/energyfi/ # config (contract IDs), pool-events, hooks, rpc
│   ├── packages/         # generated TypeScript clients for the contracts
│   └── scripts/          # seed-onchain, e2e smoke, referral demo
└── docs/UNDERWRITING.md  # lending & underwriting design
```

## Live on testnet (2026-08-08)

| Contract      | Version | Address                                                    |
| ------------- | ------- | ---------------------------------------------------------- |
| installments  | v8      | `CBG4I4CCMKG5PANFYMPP4RYQLOIUQKH3MJBSAR5ZE4NK7TUL6YXR6ELN` |
| project       | v2      | `CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA` |
| referral      | v2      | `CBURYW3CWH7L3R3RUADXCRNOQIOSKJEGDTBT5PPLS3ZMHKXCXDYFABAE` |
| energy-credit | v1      | `CB56C2Z5LN5ACMY4T4GIVETTNJLNUMMSWSI4UEEZNP5KCBFOJ3PBM7YC` |

v8 of `installments` was redeployed on 2026-08-08 with one behavioural fix: a **fully
repaid financing no longer blocks eligibility** — `check_eligibility` and
`start_financing` now treat a cleared loan (12/12 paid) as finished, so a borrower who
settled one loan can start another (previously the record existed forever and returned
`already_started=true`). Verified live right after deploy: `check_eligibility(GAMFAIX,
loan_50)` → `eligible=true, already_started=false`. The pool contract is untouched; the
old v7 contract (`CCVXQOO…44LM`) was retired with an empty balance (0.00 USDC).

## Verified contract call (2026-08-07, against the retired v7 contract)

> These transactions ran against the **previous** installments deployment (`CCVXQOO…44LM`,
> since replaced by v8) and remain verifiable on StellarExpert.

A live `payoff_loan` call against the installments contract, verifiable on
[StellarExpert](https://stellar.expert/explorer/testnet/tx/fdfbb3f10be2d0be740d5180144d20fdae7a29a0a8fe6360975564e10c944498):

- **Transaction hash:** `fdfbb3f10be2d0be740d5180144d20fdae7a29a0a8fe6360975564e10c944498`
- **Contract:** `CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM` (installments v7)
- **Function:** `payoff_loan(buyer, "loan_50")` — borrower `GAMFAIXVHC…C7VD` settled the
  remaining 11 installments of a 50 USDC loan (12/12 paid, 55.2 USDC total: 50 principal
  - 5.2 interest auto-routed to the savings pool)
- **Ledger:** 4008384 · protocol 27 · successful

Earlier in the same roundtrip: `start_financing`
(`a454d087c2f96629c2905e1696faea62e9f03a23f408f106a9cb7b2fad7d18c4`) and `pay_installment`
(`028a9cc1b1208b58ae6da139c51437163fcd3660a87520baca1c23c72ecec6ef`), both also
verifiable on StellarExpert.

## End-to-end demo — what you see in the admin console (verified 2026-08-06)

The borrow loop runs on testnet and can be followed live in the admin console. Here is
exactly what happens, from a real run:

1. **Safer invests.** Admin deposits 1 USDC into the pool → 1 pool share (shares are
   permanently locked; that permanence backs the soft-collateral rule).
2. **A borrower takes a loan.** The E2E borrower pledges 13 USDC (13 shares; 14 total)
   and is disbursed a **50 USDC** `loan_50`: `total_shares=14`, each share 1 USDC.
   That "Neighbourhood loan · 50" row in the console is this loan.
3. **Every `4.6 USDC` installment is split by the contract:**
   `4.166667` principal → corpus (provider-withdrawable), `0.433333` interest →
   **auto-routed into the savings pool in the same transaction** (no admin courier).
   The admin's 1 share earns a pro-rated slice: `floor(0.433333 / 14) ≈ 0.309` per
   installment, claimable from the pool ("claim interest").
4. **Provider withdrawal** takes settled corpus minus a **1% platform fee**; the fee
   collects in a vault the admin can `claim_fees` from.
5. **Default lifecycle:** `mark_late` → `settle_default` (permanently flags the borrower;
   `check_eligibility` rejects them with `defaulted=true`) → `clear_default` (documented
   admin override).

After a full run: escrow funded 50 → disbursed → 2 installments paid (outstanding
**45.4**), all settled corpus withdrawn, fee vault drained, `installments` contract
balances **0.0000**, pool USDC **14.8357**.

> Tip if the admin wallet looks "off": the same identity also receives testnet USDC from
> the Circle faucet (20 at a time) — faucet top-ups and interest claims live in the same
> wallet, so the wallet balance is not the pool economics. The on-chain pool/loan numbers
> above are the authoritative view.

## Running

```bash
# contracts
cd contracts
cargo test --workspace            # 44/44 tests across the four contracts

# frontend
cd dev-server
npm install
npm run dev
```

On-chain scripts need `DEPLOY_SECRET` (secret key of the `energyfi-deploy` identity, the
contracts' admin) and testnet USDC from the Circle faucet:

```bash
DEPLOY_SECRET=$(stellar keys secret energyfi-deploy) node scripts/e2e-borrow-loop.mjs
```

## Tests & CI

**44/44 contract unit tests pass** (3 energy-credit · 20 installments · 8 project · 13
referral) — see `contracts/README.md` §8 for the security-critical coverage list.

| Check                  | How to run                                 | Count     |
| ---------------------- | ------------------------------------------ | --------- |
| Soroban contract tests | `cargo test --workspace` (in `contracts/`) | 44 passed |
| Frontend typecheck     | `npx tsc --noEmit` (in `dev-server/`)      | 0 errors  |
| Frontend build         | `npm run build` (in `dev-server/`)         | passes    |

**CI/CD** runs every push to `main` and on pull requests via GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): it installs Rust + the
`@stellar/stellar-sdk`-based frontend, then runs the contract test suite, the frontend
typecheck, and the production build. Status badge:

[![CI](https://github.com/Mikey-222/EnergyFi-Network/actions/workflows/ci.yml/badge.svg)](https://github.com/Mikey-222/EnergyFi-Network/actions/workflows/ci.yml)

## Screenshots

Drop the PNG files into `docs/screenshots/` with the names below and they appear
in this README automatically.

### Wallet connected

![Wallet connected](docs/screenshots/wallet-connected.png)

### Wallet options available

The app connects through Stellar Wallet Kit, so any Stellar wallet can be used:

![Wallet options](docs/screenshots/wallet-options.png)

### Balance displayed

![Balance displayed](docs/screenshots/balance.png)

### CI/CD pipeline running

![CI/CD](docs/screenshots/pipeline.png)

### Successful testnet transaction

![Successful testnet transaction](docs/screenshots/tx-success.png)

### Transaction result

The app shows the outcome of every signed operation — a success banner with the
transaction hash (linked to StellarExpert) on confirmations, or an error message
describing what failed, so the user always knows whether their transaction
landed on-chain.

![Transaction result](docs/screenshots/tx-result.png)

### Mobile responsive UI

![Mobile UI](docs/screenshots/responsive-ui.png)

## Pitch deck & demo

- **Pitch deck:** https://gamma.app/docs/EnergyFi-Network-qby6v0bj7i0a57f
- **Demo video (full walkthrough):** https://youtu.be/vA_G6xIg7J8

## Testnet users (verifiable on Stellar Expert)

34 testnet wallets onboarded through the app, all verifiable on
[Stellar Expert (testnet)](https://stellar.expert/explorer/testnet):

| # | Address |
| - | ------- |
| 1 | `GBBANYQN6ET2V5A7Z4IP2VWBTYSGUDGZ522UCKVUAJ2C4XF6NNEOL7ZT` |
| 2 | `GAKBJ25VKX7TOUXCPHKKFWK7LFERR4WP5C5USMP5WS5ZCYB67PX4THUB` |
| 3 | `GDQJC4I7ND6LI36KU3WCXARCLQ7JJ5HKGBM67MCBROGG57ZABACR4SK2` |
| 4 | `GC3PHHDPOGQZD243G4PISLE274Q4W3ETL2NPNGBE5TNHEVWMWSP7RJKM` |
| 5 | `GCEPBDZAVKSWMODTNVHPTRBSPBZMOECIC7WP77KDNBSZBAZBQO4NO6J7` |
| 6 | `GCQQZZN5Q5HL372Q4PGO564FF7AXM2QHZUEBEFOFXX4FNYIR7PJDGJMK` |
| 7 | `GAFWFDVZ6LKOUTGQESFVEONFHKVBZXT4EVQREVKF5RW46JLMD2PVR27J` |
| 8 | `GAQ5JIAEZC23RWADY4JM7JH6CBISI4RKPFROJ3OCJ757Q77KMRTWJIDF` |
| 9 | `GBI3NZAFYX75V6FSKZ2NUSQSVKOSI457VC223ICOI6FAN2HR2HK77AOL` |
| 10 | `GDIYRLE42PYF37RSNPS7ZRC2JNTT3LN3H2S6RULYZ5ZR4UGVWN53CYPF` |
| 11 | `GC6LT7FKTJ2S6FOJFAPIKGUGQWPVQE7KGTHEFOBVSECBMU7GUIIXUDHV` |
| 12 | `GCDYTM6YONT5IT6YB5N46R6VNAQJ5BOHSN7YSPKHDJOUP4DEK4WEAJ3C` |
| 13 | `GDHH2XZPDWP6Y45T7SOLD5Y3JZ7PQW2ENLUIKBYTNZB2I5IJTP4BZ24Q` |
| 14 | `GCZYGOHXNAPJTGNBAHMZLRVSXUXWSEE7LTI5UWBJTEPFKYZSQEVC6ASF` |
| 15 | `GBO5LXAVADAR67O4NOF3ZLDAHRNYYDTW7HFECUY6VEKK5VLUW46TW5NF` |
| 16 | `GAWY4CIBREPHHCBRQSTR3UIFVOPWYRGV7EDFTV5544B64LYQO2XPPJBA` |
| 17 | `GDDKVIILHZVXF23OL6BUXZC6PJFTIPY2J7HX7U3HC7KWYCJL5JC66ETJ` |
| 18 | `GBINREP3QUWFY5HHGOEWEVQHMI64N3O24ZEJEEZD22JOFIB3OJ2WE4IB` |
| 19 | `GAXRZGEH2OBN7DHLQCE2RC63FJKF64MZLC2FVFSBMGGGSLL7AG75VREJ` |
| 20 | `GAXPDAHTX5LMMDI6B54BFRLOZ2O4EJPXBB6VB3PCKUIZOOWLVXLOBCQN` |
| 21 | `GCAYNBYVRXEV72IH4EHXIS2OBU4C74HPXFHDIIOWWNATZPT2VY2SW6PK` |
| 22 | `GBVJZALWL7PN6NYCIT4A2XRF6IHAVJDXE4EKNNXYSFVJUMSXZAFWAPGO` |
| 23 | `GBSELHWK36GG3ZIKBBYUJ64DYNIH4UWRNMR6PL5HVHL5MFYK7PZ52OA4` |
| 24 | `GAFJ3BDOY234WPDMOK6T3Y2U7BKE45Y4DIB2J5YWEKT72NI6H7LAEOP5` |
| 25 | `GCBGEWR3JLZJHT232FN4L243XGF5W42RG36SJ6V77UXAUJSRZRSAAWRV` |
| 26 | `GB7LC2ETACZVF4T7J5AXYZ2ASA25X2HQ342LFOUVKF57RIDV37BJ4ZK4` |
| 27 | `GAFZNT7PQGU4W4MU2B2DKDJC7Y3FFOGJ55ODSAQPS7BPI7R3GLDL32IK` |
| 28 | `GDKRFEO6WNIBDYJMHV5SWR3UNK5UJAFS5CE25JQJT4XZDSEHWSBNACHX` |
| 29 | `GC2NXXTCDDQXL66MUH46SBNF3YU3PE5O7VCZJP5BW6LROLUK6DDVU2MA` |
| 30 | `GBS2OA2THAZHNNANPWR2NXXXZPKTAJ2WOQFAWMUZKHCUKEAVTBQEH5L3` |
| 31 | `GAR42NJFT5TWRIC55NPHKHPAI4INPORFWCXC7IVSDOVP4VOG5E2U633W` |
| 32 | `GB6322XKTRZX7MQ2XHKMFO4WKXHGJZFMGJZPRU7DZSYQGXZYV2MHHHPA` |
| 33 | `GDXP4TAXOP4DZRKGVU5N667VZ77OWBEB53GQEP5QEPE66PMWM3PGWASM` |
| 34 | `GBGRMM55HLIVPCXMAEE4CO55LPRQTV5ZHSGSHHNXQBJDYNI3E7JE5THW` |
| 35 | `GD6JJH6KH7Z52KHNKZP6CIICHNVSYYJHYFSRQ7C535IFO32TFSMZAQFQ` |
| 36 | `GDGGUMOPRCRRPNXNTLW52LHSBVJNQMLLRXRQX5RMFH56GKEM5HJMHIR3` |
| 37 | `GDYXYYV63URVSWQMYRNG4DXXH3HUQOFXA2ZYSXDORCZFADJ72XRRSF6W` |
| 38 | `GBK3NB52NIF37BOVR2LQP2AKVIV52K2HOQXT775PLYV2X4EIOANCTTO4` |
| 39 | `GARQXEUQR3INJSIU5MNJS27YRHAMIY73TXTVYKETWBEHY2HRXYKDGATS` |
| 40 | `GBNKCAN3BSJVUHWC7QOS743AJMAXXPI5VYMZ6Y4BPEVZSV7UEZVJMLMP` |
| 41 | `GDKSFKCGVVXOFKB4JU745X2QBH3LDTCHMTXQA4LEQAAZCAVNT2BF4HGQ` |
| 42 | `GAZCNWQVJQ4AHEMBVS72AF22ZL6NWA2N6QJ76DUIOQGJDFJTKAMNDUF2` |
| 43 | `GBR5H3DVUZRMG2ESUBZP6SOASOBHKZCWR5VM6YB4FZG7MR3GBQOGOBV5` |
| 44 | `GAMFAIXVHCFIA73N4KZRTTNPGFPUHO4E45MROJOUCLYGHWACJZAKC7VD` |
| 45 | `GCVFFMQNNZN5Z4G5A2AK76Z2FRTJIR56MOYWCAPGORLZL6BFMXLPVLDU` |
| 46 | `GD2NHCZCVMBEFXHQHFJORC63ZZI2OAETD2FI53RYM5JTKPATB2ILPWE4` |
| 47 | `GCEKTOFZCQ3QKSGM633UMRCQFHCA7XRHMUX4JGKQGWCIPPOV5LNODGVO` |
| 48 | `GDKAPIPV4ALNPRHLYZCTF6HXVX63PI6EFGECZMJLL7MJCBUKFLKIPAPK` |
| 49 | `GDO3YERTAR5NU5MB4EXQV7QSUIF6OW7RSVPIC377SPNO4UOR25FFRUGN` |
| 50 | `GDHQCI2XBBOHXV7ITUKCQLBZWS353STAUGYTO2U7NYKIEZYEMMD2ZDSC` |

## User feedback & next improvements

We collect structured feedback from testnet users through our [Google Form](https://forms.gle/hUHBcXunGYpFvjJo9) — it captures the user's wallet address, email, name, product rating, and open feedback so every submission is traceable to a real on-chain user. All responses are exported and maintained as an Excel sheet for analysis and record-keeping:

- **Form:** https://forms.gle/hUHBcXunGYpFvjJo9
- **Responses (Excel):** `docs/feedback/energyfi-feedback.xlsx`
- **Feedback summary:** `docs/feedback/SUMMARY.md`

### How feedback drives the roadmap

Each item below was selected from the feedback collected so far, with the commit that implements it linked for traceability:

| Feedback theme | Planned change | Commit |
| -------------- | -------------- | ------ |
| [Theme — e.g. "confusing default flow"] | [Change — e.g. "guided first-time onboarding tour"] | [`<hash>`](https://github.com/Mikey-222/EnergyFi-Network/commit/<hash>) |
| [Theme] | [Change] | [`<hash>`](https://github.com/Mikey-222/EnergyFi-Network/commit/<hash>) |
| [Theme] | [Change] | [`<hash>`](https://github.com/Mikey-222/EnergyFi-Network/commit/<hash>) |

> Placeholder rows: replace each `[Theme]` / `[Change]` with the actual feedback theme and the implementing commit hash once shipped. See [`docs/ROADMAP.md`](docs/ROADMAP.md) L5 for the full iteration backlog.

## Status

Live on Stellar testnet with soft-collateral underwriting and automatic saver-interest
routing shipped (2026-08-06); installments redeployed to v8 on 2026-08-08 (repaid
borrowers are eligible again). Not audited; not mainnet — see the contracts README for
known limitations and the roadmap.
