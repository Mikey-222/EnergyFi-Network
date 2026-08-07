// End-to-end borrow loop on Stellar testnet (installments v7 + project v2):
//   1. Admin (saver) invests 1 USDC in the pool -> stocks the pending 4,333,333-stroop
//      revenue that was routed before any shares were sold; claim proves it.
//   2. Fresh borrower: friendbot + USDC trustline, seeded to 18 USDC by admin.
//   3. Borrower invests 13 USDC (13 shares = 25%+ pledge for loan_50).
//   4. check_eligibility(loan_50) must be eligible.
//   5. start_financing + pay_installment(4.6 USDC) -> interest 4,333,333 stroops
//      auto-routed to the pool in the same transaction.
//   6. Admin claims dividends again (routed slice of the new revenue).
//   7. Provider withdraw (settled principal - 1% fee) + admin claim_fees.
// Phase B (escrow-funded disbursal + default lifecycle) needs the loan escrow topped
// up; the borrower keypair is printed for reuse.
// Requires DEPLOY_SECRET (secret key of the energyfi-deploy identity).
// Run: DEPLOY_SECRET=SB... node scripts/e2e-borrow-loop.mjs
import { Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE, Address } from "@stellar/stellar-sdk";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Project from "../packages/project/dist/index.js";
import * as Installments from "../packages/installments/dist/index.js";
import * as UsdcSac from "../packages/sac-usdc/dist/index.js";

// Route *.stellar.org through curl (undici TLS drops on this uplink; see phase B).
const curlHosts = /(horizon|soroban)-testnet\.stellar\.org$/;
const _fetch = globalThis.fetch;
const curlGate = async (url, opts) => {
  opts = opts || {};
  const u = new URL(url);
  if (!curlHosts.test(u.hostname)) return _fetch(url, opts);
  const dir = mkdtempSync(join(tmpdir(), "efi-curl-"));
  const bodyF = join(dir, "body");
  const args = ["-sS", "-m", "25", "-o", bodyF, "-w", "%{http_code}", "--http1.1", "-X", opts.method || "GET"];
  for (const [k, v] of Object.entries(opts.headers || {})) {
    if (/^(content-length|accept-encoding)$/i.test(k)) continue;
    args.push("-H", `${k}: ${v}`);
  }
  if (opts.body) {
    if (!Object.keys(opts.headers || {}).some((k) => /^content-type$/i.test(k)))
      args.push("-H", "Content-Type: application/json");
    args.push("-d", typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body));
  }
  args.push(String(url));
  const status = await new Promise((res, rej) => {
    execFile("/usr/bin/curl", args, { maxBuffer: 128 * 1024 * 1024, timeout: 45000 }, (err, stdout) => {
      if (err) rej(err);
      else res(stdout.trim() || "0");
    });
  });
  const body = readFileSync(bodyF);
  rmSync(dir, { recursive: true, force: true });
  return new Response(body, { status: Number(status) || 502 });
};
globalThis.fetch = async (url, opts) => {
  const max = 8;
  for (let i = 0; i < max; i++) {
    try {
      return await curlGate(url, opts);
    } catch (e) {
      if (i === max - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500 + i * 1200));
    }
  }
};

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const secret = process.env.DEPLOY_SECRET;
if (!secret) {
  console.error("Set DEPLOY_SECRET (see `stellar keys secret energyfi-deploy`)");
  process.exit(1);
}

// Live canonical addresses (2026-08-07).
const CONTRACT_IDS = {
  installments: "CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM",
  project: "CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA",
};

const deployKp = Keypair.fromSecret(secret);
const adminAddr = deployKp.publicKey();
const borrowerKp = process.env.BORROWER_SECRET ? Keypair.fromSecret(process.env.BORROWER_SECRET) : Keypair.random();
const borrowerAddr = borrowerKp.publicKey();
const horizon = new Horizon.Server(HORIZON_URL);
const usdc = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const toStroops = (n) => BigInt(Math.round(n * 1e7));
const fmt = (n) => {
  n = BigInt(n);
  const w = n / 10000000n;
  const f = n % 10000000n;
  return f === 0n ? w.toString() : `${w}.${f.toString().padStart(7, "0").replace(/0+$/, "")}`;
};
const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

const project = new Project.Client({
  rpcUrl: RPC_URL,
  contractId: CONTRACT_IDS.project,
  networkPassphrase: Networks.TESTNET,
  publicKey: adminAddr,
  signTransaction: deployKp,
});
const installments = new Installments.Client({
  rpcUrl: RPC_URL,
  contractId: CONTRACT_IDS.installments,
  networkPassphrase: Networks.TESTNET,
  publicKey: adminAddr,
  signTransaction: deployKp,
});
const usdcSac = new UsdcSac.Client({
  rpcUrl: RPC_URL,
  contractId: UsdcSac.networks.testnet.contractId,
  networkPassphrase: Networks.TESTNET,
  publicKey: adminAddr,
  signTransaction: deployKp,
});

async function contractUsdcBalance(contractId) {
  const res = await usdcSac.balance({ id: Address.fromString(contractId) });
  return Number(res.result) / 1e7;
}

async function usdcBalance(addr) {
  const account = await horizon.loadAccount(addr);
  const b = account.balances.find((x) => x.asset_code === "USDC" && x.asset_issuer === usdc.issuer);
  return b ? Number(b.balance) : 0;
}

async function waitForBalance(addr, expected, label, tries = 25) {
  for (let i = 0; i < tries; i++) {
    const bal = await usdcBalance(addr);
    if (bal >= expected - 1e-6) return bal;
    await new Promise((r) => setTimeout(r, 3000));
  }
  const bal = await usdcBalance(addr);
  throw new Error(`${label}: balance ${bal} did not reach ${expected}`);
}

async function fundBorrower(pledged) {
  const need = pledged ? 4.6 : 17.6;
  const existing = await usdcBalance(borrowerAddr);
  if (existing >= need) {
    log(`borrower funded (${existing.toFixed(4)} USDC) — ${pledged ? "pledge already made, installment affordable" : "reusing, no seed needed"}`);
    return;
  }
  if (existing > 0) {
    throw new Error(`borrower has ${existing.toFixed(4)} USDC (< 17.6 needed); top it up or use a fresh borrower`);
  }
  const res = await fetch(`https://friendbot.stellar.org?addr=${borrowerAddr}`);
  if (!res.ok) throw new Error(`friendbot failed: ${res.status}`);
  log(`friendbot funded borrower ${borrowerAddr.slice(0, 12)}…`);
  const account = await horizon.loadAccount(borrowerAddr);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: usdc }))
    .setTimeout(60)
    .build();
  tx.sign(borrowerKp);
  await horizon.submitTransaction(tx);
  log("borrower USDC trustline added");

  const adminBal = await usdcBalance(adminAddr);
  if (adminBal < 18) throw new Error(`admin has only ${adminBal.toFixed(4)} USDC — cannot seed a fresh borrower; pass BORROWER_SECRET to reuse one`);
  const adminAcc = await horizon.loadAccount(adminAddr);
  const seed = new TransactionBuilder(adminAcc, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: borrowerAddr, asset: usdc, amount: "18.0000000" }))
    .setTimeout(60)
    .build();
  seed.sign(deployKp);
  const res2 = await horizon.submitTransaction(seed);
  log(`seeded 18 USDC → borrower:`, res2.hash.slice(0, 16) + "…");
  await waitForBalance(borrowerAddr, 18, "borrower seed");
}

async function main() {
  log("=== EnergyFi E2E borrow loop ===");
  log(`admin:    ${adminAddr}`);
  log(`borrower: ${borrowerAddr}`);
  log(`borrower secret (for phase B): ${borrowerKp.secret()}`);

  const bal0 = await usdcBalance(adminAddr);
  log(`admin USDC balance: ${bal0.toFixed(4)}`);

  let tx;

  // --- 1. Saver invest -> folds the pending revenue ---------------------------
  const sold0 = (await project.total_sold()).result;
  const admin0 = (await project.get_investor({ investor: adminAddr })).result;
  const claimable0 = (await project.claimable({ investor: adminAddr })).result;
  let adminShares = 0n;
  if (sold0 === 0n) {
    log("— saver: admin invests 1 USDC (pending revenue folds in) —");
    tx = await project.invest({ investor: adminAddr, amount: toStroops(1) });
    await tx.signAndSend();
    adminShares = 1n;
    const claimable1 = (await project.claimable({ investor: adminAddr })).result;
    log(`claimable after invest: ${fmt(claimable1)} USDC (expect 0.4333333 — pending folded)`);
    if (claimable1 !== 4333333n) throw new Error(`fold mismatch: ${claimable1}`);
    log("— saver: claim dividends (must include the full pending fold) —");
    tx = await project.claim_dividends({ investor: adminAddr });
    await tx.signAndSend();
    log(`claim #1 paid: ${fmt(tx.result)} USDC (expect 0.4333333)`);
    if (tx.result !== 4333333n) throw new Error(`claim #1 mismatch: ${tx.result}`);
    await waitForBalance(adminAddr, bal0 - 1 + 0.4333333, "admin claim #1");
  } else {
    log(`pool already live: shares sold=${sold0}, admin shares=${admin0.shares}, claimable=${fmt(claimable0)} USDC`);
    log("(pending fold verified on 2026-08-06: claim paid 0.4333333 USDC)");
    adminShares = admin0.shares;
    if (claimable0 > 0n) {
      tx = await project.claim_dividends({ investor: adminAddr });
      await tx.signAndSend();
      log(`claimed stale remainder: ${fmt(tx.result)} USDC`);
    }
  }

  // --- 2/3/4/5. Borrower: fund, trustline, pledge, eligibility, start, pay -----
  const bState = (await project.get_investor({ investor: borrowerAddr })).result;
  const pledged = bState.shares >= 13n;
  let finPaid = 0n;
  try {
    finPaid = (await installments.get_financing({ buyer: borrowerAddr, product_id: "loan_50" })).result.installments_paid;
  } catch {
    // financing not started yet
  }

  if (finPaid > 0n) {
    log(`borrower already paid ${finPaid} installment(s) — skipping setup/pledge/start/pay`);
  } else {
    log("— borrower setup —");
    await fundBorrower(pledged);
    const bClient = new Project.Client({
      rpcUrl: RPC_URL,
      contractId: CONTRACT_IDS.project,
      networkPassphrase: Networks.TESTNET,
      publicKey: borrowerAddr,
      signTransaction: borrowerKp,
    });
    const bState0 = (await project.get_investor({ investor: borrowerAddr })).result;
    if (bState0.shares < 13n) {
      log("— borrower invests 13 USDC (13 shares; pledge 13 >= 12.5 required) —");
      tx = await bClient.invest({ investor: borrowerAddr, amount: toStroops(13) });
      await tx.signAndSend();
    } else {
      log(`borrower already pledged: ${bState0.shares} shares, ${fmt(bState0.invested)} USDC invested (skipping)`);
    }

    log("— check_eligibility(loan_50) —");
    const elig = (await installments.check_eligibility({ borrower: borrowerAddr, product_id: "loan_50" })).result;
    log(`eligible=${elig.eligible} defaulted=${elig.defaulted} already_started=${elig.already_started} ` +
      `savings=${fmt(elig.savings)} max_principal=${fmt(elig.max_principal)} principal=${fmt(elig.principal)} ` +
      `required_pledge=${fmt(elig.required_pledge)}`);
    if (!elig.eligible) throw new Error("borrower not eligible — aborting");

    const bInst = new Installments.Client({
      rpcUrl: RPC_URL,
      contractId: CONTRACT_IDS.installments,
      networkPassphrase: Networks.TESTNET,
      publicKey: borrowerAddr,
      signTransaction: borrowerKp,
    });
    log("— borrower starts loan_50 financing —");
    tx = await bInst.start_financing({ buyer: borrowerAddr, product_id: "loan_50" });
    await tx.signAndSend();

    log("— borrower pays installment 1 (4.6 USDC; interest routes to pool) —");
    const prodBefore = (await installments.get_product({ product_id: "loan_50" })).result;
    tx = await bInst.pay_installment({ buyer: borrowerAddr, product_id: "loan_50" });
    await tx.signAndSend();
    const prod = (await installments.get_product({ product_id: "loan_50" })).result;
    const fin = (await installments.get_financing({ buyer: borrowerAddr, product_id: "loan_50" })).result;
    const delta = prod.total_paid - prodBefore.total_paid;
    log(`product.total_paid: ${fmt(prodBefore.total_paid)} → ${fmt(prod.total_paid)} USDC (delta ${fmt(delta)} = corpus cut)`);
    log(`financing: installments_paid=${fin.installments_paid}, total_paid=${fmt(fin.total_paid)} USDC, disbursed=${fin.disbursed}`);
    if (delta !== 41666667n) throw new Error(`corpus delta mismatch: ${delta} (expect 41,666,667)`);
  }
  const sold = (await project.total_sold()).result;
  log(`shares sold: ${sold}`);
  const poolBal = await contractUsdcBalance(CONTRACT_IDS.project);
  log(`pool USDC balance (via SAC balance()): ${poolBal.toFixed(4)}`);

  // --- 6. Admin claims the routed slice ----------------------------------------
  const claimableNow = (await project.claimable({ investor: adminAddr })).result;
  if (claimableNow > 0n) {
    const routedPerShare = 4333333n / sold;
    log(`— saver: claim #2 (claimable ${fmt(claimableNow)} USDC; routed slice floor(4,333,333/${sold}) = ${fmt(routedPerShare)}) —`);
    tx = await project.claim_dividends({ investor: adminAddr });
    await tx.signAndSend();
    log(`claim #2 paid: ${fmt(tx.result)} USDC`);
    if (tx.result !== claimableNow) throw new Error(`claim #2 payout mismatch: ${tx.result} vs ${claimableNow}`);
    // Allow 1 stroop of pool dust from prior routes to be swept in with the slice.
    if (claimableNow < routedPerShare || claimableNow - routedPerShare > 1n)
      throw new Error(`claim #2 slice mismatch: ${claimableNow} vs ${routedPerShare}`);
  } else {
    log("no new claimable (payment already routed and claimed)");
  }

  // --- 7. Provider withdraw + platform fee -------------------------------------
  const prodNow = (await installments.get_product({ product_id: "loan_50" })).result;
  const settled = prodNow.total_paid - prodNow.withdrawn;
  if (settled > 0n) {
    const fee = settled / 100n; // 1% of settled corpus (floor)
    const payout = settled - fee;
    log(`— provider withdraw (settled ${fmt(settled)} USDC, fee ${fmt(fee)}, payout ${fmt(payout)}) —`);
    tx = await installments.withdraw({ provider: adminAddr, product_id: "loan_50" });
    const r = await tx.signAndSend();
    const applied = r?.result ?? tx.result;
    const prodAfter = (await installments.get_product({ product_id: "loan_50" })).result;
    log(`withdraw applied: ${applied ? `payout=${fmt(applied.payout)}, fee=${fmt(applied.fee)}` : "(result null, verifying via state)"}, withdrawn now ${fmt(prodAfter.withdrawn)} USDC`);
    if (prodAfter.withdrawn !== prodAfter.total_paid) {
      throw new Error(`withdraw did not settle: withdrawn ${prodAfter.withdrawn} of ${prodAfter.total_paid}`);
    }
    const owed = (await installments.fees_owed()).result;
    log(`fees_owed: ${fmt(owed)} USDC (expect ${fmt(fee)})`);
    if (owed !== fee) throw new Error(`fees_owed mismatch: ${owed} vs ${fee}`);
  } else {
    log("nothing left to withdraw (already settled)");
  }

  // --- 7b. Platform fees (standalone: claim whatever is owed) -------------------
  const owedNow = (await installments.fees_owed()).result;
  if (owedNow > 0n) {
    log(`— admin claims platform fees (${fmt(owedNow)} USDC) —`);
    tx = await installments.claim_fees({ admin: adminAddr, amount: owedNow });
    await tx.signAndSend();
    log(`fees claimed: ${fmt(tx.result)} USDC (verify: fee pool 0)`);
    const owedAfter = (await installments.fees_owed()).result;
    if (owedAfter !== 0n) throw new Error(`fees_owed after claim: ${owedAfter}`);
    log("fees_owed after: 0 USDC ✓");
  } else {
    log("no accrued fees to claim");
  }

  // --- Summary ------------------------------------------------------------------
  const instBal = await contractUsdcBalance(CONTRACT_IDS.installments);
  const poolBal2 = await contractUsdcBalance(CONTRACT_IDS.project);
  const adminBal = await usdcBalance(adminAddr);
  const borBal = await usdcBalance(borrowerAddr);
  log("");
  log("=== RESULTS ===");
  log(`admin USDC:      ${adminBal.toFixed(4)} (start ${bal0.toFixed(4)})`);
  log(`borrower USDC:   ${borBal.toFixed(4)} (seeded 18, pledge 13, paid 4.6)`);
  log(`installments bal: ${instBal.toFixed(4)} (expect 0 — everything settled)`);
  log(`pool bal:        ${poolBal2.toFixed(4)} (borrower pledge + admin share + routed)`);
  log(`borrower secret: ${borrowerKp.secret()}`);
  log("=== E2E BORROW LOOP COMPLETE (phase A) ===");
  log("Phase B (escrow-funded disbursal + default lifecycle) needs the loan escrow:");
  log(`  send >= 50 USDC from the faucet to installments contract ${CONTRACT_IDS.installments}`);
}

main().catch((e) => {
  console.error("E2E FAILED:", e?.message ?? e);
  console.error((e?.stack ?? "").split("\n").slice(0, 12).join("\n"));
  process.exit(1);
});
