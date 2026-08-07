# EnergyFi — Level 4 Idea Overview

## Project

**EnergyFi — Stellar-powered energy access & tokenized solar financing for emerging markets.**

## The problem

Solar equipment is expensive upfront; energy access is a financing problem first. Buyers in emerging markets (e.g., Ethiopia, sub-Saharan Africa) cannot pay hundreds of dollars at once, and cross-border payments for equipment are slow and costly. Meanwhile, the capital to build community solar projects exists globally but has no frictionless way to reach them.

## The idea

EnergyFi connects three sides on one Stellar-based platform:

1. **Providers** — solar equipment sellers list products (kits, batteries, appliances) financed in monthly installments.
2. **Customers** — pay in USDC/EURC monthly installments, top up prepaid energy credit (kWh), and pay energy bills.
3. **Investors** — buy fractional, tokenized ownership in community solar projects and earn USDC dividends.

## Stellar use-case alignment

| Stellar use case | How EnergyFi uses it |
|---|---|
| **Payments** | USDC/EURC installments for solar kits, bill payments, merchant settlement to providers. Stablecoin rails settle in seconds at near-zero fees, replacing slow/costly local payment channels. |
| **Asset Tokenization** | Community solar projects are tokenized into fractional ownership assets (an investment asset). kWh energy credit is issued as a tokenized payment/utility asset with native asset controls (issue, freeze, revoke). |
| **On/Off-Ramps** | Wallet Top up / Cash out integrates anchors via SEP-24 (interactive) — users fund their wallet in fiat (USDC/EURC) and withdraw back to fiat, using Stellar Ramps standards (SEP-6/SEP-24). |
| **DeFi (Soroban)** | Rust smart contracts power the financing layer: installment escrow and repayment tracking, dividend distribution from project revenue, and fractional ownership settlement on-chain. |

## How it works (flow)

1. User connects a Stellar wallet (Freighter etc., via stellar-wallets-kit).
2. User tops up fiat → USDC/EURC through an anchor (SEP-24 on-ramp).
3. Customer selects a solar product and finances it in monthly USDC installments — escrow + repayment tracked by a Soroban contract.
4. Investor buys tokenized project shares; project revenue is distributed as USDC dividends by the contract.
5. User can cash out back to fiat through an anchor (SEP-24 off-ramp).

## Why Stellar

- Proven stablecoin rails (USDC, EURC) with 180+ country reach and 475K+ on/off-ramp locations
- Native asset issuance with compliance controls (freeze/clawback) — right fit for RWA tokenization
- SEP standards for ramps mean one integration reaches the whole anchor ecosystem
- Soroban smart contracts for the DeFi/financing layer

## Current status

- Levels 1–3 built the app shell: onboarding/KYC, marketplace (shop + invest), bill payments, provider portal, and a wallet with real Stellar integration (wallet connect via stellar-wallets-kit, Horizon balances, XLM payments) — in `dev-server/`.
- Balances/products/investments are still mock; everything is XLM-only today.

## Build plan for Levels 5–7

| Level | Scope |
|---|---|
| **5** | Real USDC/EURC on testnet everywhere: trustlines, asset conversion, real payment flows replacing mocks (installments, bills, merchant payout) |
| **6** | Soroban contracts: kWh energy-credit token, installment escrow/repayment, tokenized project ownership + automated USDC dividend distribution |
| **7** | End-to-end demo on testnet: fund via anchor (SEP-24) → finance a solar kit in USDC installments → invest in a project → receive dividends → cash out. Polish, docs, deployment. |
