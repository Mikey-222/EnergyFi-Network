// Phase B of the E2E borrow loop (escrow-funded disbursal + default lifecycle):
//   1. Fund the loan_50 escrow from admin to the installments contract (50 USDC).
//   2. Admin disburse_loan(loan_50) to the borrower (pledge 13 USDC >= 12.5) — the
//      loan finally becomes a real disbursed loan.
//   3. Borrower pays installment 2 with the freshly disbursed principal — interest
//      auto-routes to the pool again.
//   4. Admin mark_late -> settle_default (permanent flag) -> clear_default,
//      verifying the defaulted borrower can't start new financings in between.
//   5. Provider withdraws the newly settled corpus (1% fee), admin claims fees.
// Requires DEPLOY_SECRET + BORROWER_SECRET (the GAMFAIX… keypair from phase A).
// Run: DEPLOY_SECRET=SB... BORROWER_SECRET=SB... node scripts/e2e-borrow-phase-b.mjs
import { Keypair, Horizon, Networks, Address } from "@stellar/stellar-sdk";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The WI-FI uplink drops undici's TLS connections to *.stellar.org (curl works).
// Route those hosts through curl for reliability; everything else -> native fetch.
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
  if (process.env.DEBUG_FETCH === "1")
    console.log("[curl]", opts.method, "hdr:", JSON.stringify(opts.headers ?? {}), "body:", String((opts.body ?? "")).slice(0, 120));
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

const _fetch2 = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const max = 8;
  const dbg = process.env.DEBUG_FETCH === "1";
  for (let i = 0; i < max; i++) {
    if (dbg) console.log(`[fetch #${i}] ${String(url).slice(0, 70)}`);
    try {
      const r = await curlGate(url, opts);
      if (dbg) console.log(`[fetch #${i}] ok ${r.status}`);
      return r;
    } catch (e) {
      if (dbg) console.log(`[fetch #${i}] ERR ${e.message} ${e.cause?.code ?? ""}`);
      if (i === max - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500 + i * 1200));
    }
  }
};
import * as Installments from "../packages/installments/dist/index.js";
import * as Project from "../packages/project/dist/index.js";
import * as UsdcSac from "../packages/sac-usdc/dist/index.js";

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const secret = process.env.DEPLOY_SECRET;
if (!secret) { console.error("Set DEPLOY_SECRET"); process.exit(1); }
if (!process.env.BORROWER_SECRET) { console.error("Set BORROWER_SECRET (phase-A borrower)"); process.exit(1); }

const CONTRACT_IDS = {
  installments: "CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM",
  project: "CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA",
};

const adminKp = Keypair.fromSecret(secret);
const adminAddr = adminKp.publicKey();
const borrowerKp = Keypair.fromSecret(process.env.BORROWER_SECRET);
const borrowerAddr = borrowerKp.publicKey();
const horizon = new Horizon.Server(HORIZON_URL);
const fmt = (n) => (Number(BigInt(n)) / 1e7).toFixed(7);
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const inst = new Installments.Client({
  rpcUrl: RPC_URL, contractId: CONTRACT_IDS.installments, networkPassphrase: Networks.TESTNET,
  publicKey: adminAddr, signTransaction: adminKp,
});
const project = new Project.Client({
  rpcUrl: RPC_URL, contractId: CONTRACT_IDS.project, networkPassphrase: Networks.TESTNET,
  publicKey: adminAddr, signTransaction: adminKp,
});
const sac = new UsdcSac.Client({
  rpcUrl: RPC_URL, contractId: UsdcSac.networks.testnet.contractId, networkPassphrase: Networks.TESTNET,
  publicKey: adminAddr, signTransaction: adminKp,
});
const bInst = new Installments.Client({
  rpcUrl: RPC_URL, contractId: CONTRACT_IDS.installments, networkPassphrase: Networks.TESTNET,
  publicKey: borrowerAddr, signTransaction: borrowerKp,
});

async function sacBalance(addr) {
  const r = await sac.balance({ id: Address.fromString(addr ?? adminAddr) });
  return Number(r.result) / 1e7;
}

async function usdcBalance(addr) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`${HORIZON_URL}/accounts/${addr}`);
      if (!res.ok) throw new Error(`horizon ${res.status}`);
      const a = await res.json();
      const b = a.balances.find((x) => x.asset_code === "USDC");
      return b ? Number(b.balance) : 0;
    } catch (e) {
      if (i === 4) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function tokenBalance(contractId) {
  const r = await sac.balance({ id: Address.fromString(contractId) });
  return Number(r.result) / 1e7;
}

async function main() {
  log("=== EnergyFi E2E Phase B: escrow-funded disbursal + default lifecycle ===");
  log(`admin: ${adminAddr}`);
  log(`borrower: ${borrowerAddr}`);
  log(`admin USDC: ${(await usdcBalance(adminAddr)).toFixed(4)}`);

  // --- 1. Fund escrow (only if the disbursal hasn't happened yet) --------------
  const fin0 = (await inst.get_financing({ buyer: borrowerAddr, product_id: "loan_50" })).result;
  log(`financing pre-disbursal: installments_paid=${fin0.installments_paid}, disbursed=${fin0.disbursed}, outstanding=${fmt(fin0.principal_outstanding)}`);

  if (!fin0.disbursed) {
    const instBal = await sacBalance(CONTRACT_IDS.installments);
    if (instBal < 50) {
      log("→ funding escrow (50 USDC) from admin ...");
      const tx = await sac.transfer({ from: adminAddr, to: CONTRACT_IDS.installments, amount: 500000000n });
      await tx.signAndSend();
      await new Promise((r) => setTimeout(r, 4000));
      const after = await tokenBalance(CONTRACT_IDS.installments);
      console.log(`installments contract USDC: ${after.toFixed(4)}`);
    } else {
      log(`escrow already funded (${instBal.toFixed(4)} USDC)`);
    }
  }

  // --- 2. Disburse --------------------------------------------------------------
  if (!fin0.disbursed) {
    log("— admin disburse_loan(loan_50 → borrower) —");
    const tx = await inst.disburse_loan({ buyer: borrowerAddr, product_id: "loan_50" });
    await tx.signAndSend();
    log("disbursed (event loan/disbursed)");
  } else {
    log("already disbursed (skipping)");
  }
  const fin1 = (await inst.get_financing({ buyer: borrowerAddr, product_id: "loan_50" })).result;
  log(`financing: disbursed=${fin1.disbursed}, outstanding=${fmt(fin1.principal_outstanding)} (expect 50)`);
  if (!fin1.disbursed || ![500000000n, 454000000n].includes(fin1.principal_outstanding)) throw new Error("disbursal failed");
  log(`borrower USDC: ${(await usdcBalance(borrowerAddr)).toFixed(4)} (expect ~50.4 — principal in) `);

  // --- 3. Borrower pays installment 2 (from the disbursed principal) -----------
  if (fin1.installments_paid < 2n) {
    log("— borrower pays installment 2 (4.6 USDC; interest routes to pool) —");
    const pBefore = (await inst.get_product({ product_id: "loan_50" })).result;
    const tx = await bInst.pay_installment({ buyer: borrowerAddr, product_id: "loan_50" });
    await tx.signAndSend();
    const pAfter = (await inst.get_product({ product_id: "loan_50" })).result;
    log(`ccorpus: ${fmt(pBefore.total_paid)} → ${fmt(pAfter.total_paid)} USDC`);
    if (pAfter.total_paid - pBefore.total_paid !== 41666667n) throw new Error("corpus delta mismatch");
  } else {
    log("installment 2 already paid (skipping)");
  }
  const fin2 = (await inst.get_financing({ buyer: borrowerAddr, product_id: "loan_50" })).result;
  log(`financing: installments_paid=${fin2.installments_paid}, outstanding=${fmt(fin2.principal_outstanding)} (expect 45.4)`);

  // --- 3. Default lifecycle -----------------------------------------------------
  log("— admin mark_late —");
  const ml = await inst.mark_late({ admin: adminAddr, buyer: borrowerAddr, product_id: "loan_50" });
  await ml.signAndSend();
  await new Promise((r) => setTimeout(r, 5000));
  if ((await inst.get_financing({ buyer: borrowerAddr, product_id: "loan_50" })).result.late < 1n) throw new Error("mark_late failed");

  log("— admin settle_default (writes the loan off, permanent flag) —");
  const sd = await inst.settle_default({ admin: adminAddr, buyer: borrowerAddr, product_id: "loan_50" });
  await sd.signAndSend();
  const defaulted = (await inst.is_defaulted({ buyer: borrowerAddr })).result;
  log(`is_defaulted: ${defaulted}`);
  if (!defaulted) throw new Error("settle_default did not flag borrower");

  log("— borrower now rejected: check_eligibility + start_financing —");
  const elig = (await inst.check_eligibility({ borrower: borrowerAddr, product_id: "loan_100" })).result;
  log(`eligible=${elig.eligible} defaulted=${elig.defaulted}`);
  if (elig.eligible !== false || elig.defaulted !== true) throw new Error("defaulted borrower must be ineligible");

  log("— admin clear_default (documented override) —");
  const cd = await inst.clear_default({ admin: adminAddr, buyer: borrowerAddr });
  await cd.signAndSend();
  const after = (await inst.is_defaulted({ buyer: borrowerAddr })).result;
  log(`is_defaulted after: ${after}`);
  if (after !== false) throw new Error("clear_default failed");

  // --- 4. Provider withdraw + fees (standalone) ---------------------------------
  const pNow = (await inst.get_product({ product_id: "loan_50" })).result;
  const settled = pNow.total_paid - pNow.withdrawn;
  if (settled > 0n) {
    const fee = settled / 100n;
    log(`— provider withdraw (settled ${(Number(settled)/1e7).toFixed(7)}, fee ${(Number(fee)/1e7).toFixed(7)}) —`);
    const tx = await inst.withdraw({ provider: adminAddr, product_id: "loan_50" });
    await tx.signAndSend();
    const pAfter = (await inst.get_product({ product_id: "loan_50" })).result;
    if (pAfter.withdrawn !== pAfter.total_paid) throw new Error("withdraw did not settle");
    log("withdraw applied");
  }
  const owed = (await inst.fees_owed()).result;
  if (owed > 0n) {
    log(`— claim_fees ${(Number(owed)/1e7).toFixed(7)} USDC —`);
    const tx = await inst.claim_fees({ admin: adminAddr, amount: owed });
    await tx.signAndSend();
    const owedAfter = (await inst.fees_owed()).result;
    if (owedAfter !== 0n) throw new Error("fee pool not drained");
    log("fee pool drained");
  }

  log("");
  log("=== PHASE B COMPLETE ===");
  log(`installments USDC balance: ${(await tokenBalance(CONTRACT_IDS.installments)).toFixed(4)}`);
  log(`pool USDC balance: ${(await tokenBalance(CONTRACT_IDS.project)).toFixed(4)}`);
}

main().catch((e) => { console.error("PHASE B FAILED:", e?.message ?? e); process.exit(1); });