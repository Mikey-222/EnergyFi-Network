// Full user-journey smoke test on Stellar testnet:
//   1. Fund a fresh user via friendbot (XLM) + add official USDC trustline.
//   2. Seed 10 USDC from the deploy account (Circle-faucet funded).
//   3. User invests 10 USDC (10 shares at 1 USDC/share) in the EnergyFi Lending Pool.
//   4. User claims dividends (pool already holds 10 USDC revenue).
//   5. User buys 3 kWh energy credits (4.5 USDC).
//   6. Verifies balances and prints a summary.
// Requires DEPLOY_SECRET (secret key of the energyfi-deploy identity).
// Run: DEPLOY_SECRET=SB... node scripts/e2e-smoke.mjs
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import * as Project from "../packages/project/dist/index.js";
import * as Credits from "../packages/energy-credit/dist/index.js";

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const secret = process.env.DEPLOY_SECRET;
if (!secret) {
  console.error("Set DEPLOY_SECRET (see `stellar keys secret energyfi-deploy`)");
  process.exit(1);
}

// Keep in sync with src/lib/energyfi/config.ts (bindings embed a stale contractId).
const CONTRACT_IDS = {
  energyCredit: "CB56C2Z5LN5ACMY4T4GIVETTNJLNUMMSWSI4UEEZNP5KCBFOJ3PBM7YC",
  project: "CC3IKONPBZB7SC5LRAOR67JYQCJ7ABWQJQCUNJTZMCNPXXH4HF62WGST",
};

const deployKp = Keypair.fromSecret(secret);
const userKp = Keypair.random();
const userAddr = userKp.publicKey();
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
  ...Project.networks.testnet,
  rpcUrl: RPC_URL,
  contractId: CONTRACT_IDS.project,
  publicKey: userAddr,
  signTransaction: userKp,
});
const credits = new Credits.Client({
  ...Credits.networks.testnet,
  rpcUrl: RPC_URL,
  contractId: CONTRACT_IDS.energyCredit,
  publicKey: userAddr,
  signTransaction: userKp,
});

async function friendbotFund() {
  const res = await fetch(`https://friendbot.stellar.org?addr=${userAddr}`);
  if (!res.ok) throw new Error(`friendbot failed: ${res.status}`);
  log(`friendbot funded ${userAddr.slice(0, 12)}…`);
}

async function addTrustline() {
  const account = await horizon.loadAccount(userAddr);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: usdc }))
    .setTimeout(60)
    .build();
  tx.sign(userKp);
  const res = await horizon.submitTransaction(tx);
  log("USDC trustline added:", res.hash.slice(0, 16) + "…");
}

async function transferUsdc(amount) {
  const account = await horizon.loadAccount(deployKp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: userAddr,
        asset: usdc,
        amount: amount.toFixed(7),
      }),
    )
    .setTimeout(60)
    .build();
  tx.sign(deployKp);
  const res = await horizon.submitTransaction(tx);
  log(`seeded ${amount} USDC → user:`, res.hash.slice(0, 16) + "…");
}

async function usdcBalance(addr) {
  const account = await horizon.loadAccount(addr);
  const b = account.balances.find((x) => x.asset_code === "USDC" && x.asset_issuer === usdc.issuer);
  return b ? Number(b.balance) : 0;
}

async function waitForBalance(addr, expected, label, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const bal = await usdcBalance(addr);
    if (bal >= expected - 1e-6) return bal;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`${label}: user USDC balance did not reach ${expected}`);
}

async function main() {
  log("=== EnergyFi E2E smoke test ===");
  log(`user account: ${userAddr}`);
  await friendbotFund();
  await addTrustline();

  await transferUsdc(10);
  await waitForBalance(userAddr, 10, "seed");

  log("— invest 10 USDC (10 shares @ 1 USDC) —");
  let tx = await project.invest({ investor: userAddr, amount: toStroops(10) });
  await tx.signAndSend();
  const sold = await project.total_sold();
  const raised = await project.total_raised();
  log(`shares sold: ${sold.result}, total raised: ${fmt(raised.result)} USDC`);

  log("— claim dividends —");
  tx = await project.claim_dividends({ investor: userAddr });
  await tx.signAndSend();
  const inv = await project.get_investor({ investor: userAddr });
  log(`investor: shares=${inv.result.shares}, claimed=${fmt(inv.result.claimed)} USDC`);

  log("— admin deposits 5 USDC revenue —");
  const adm = new Project.Client({
    ...Project.networks.testnet,
    rpcUrl: RPC_URL,
    contractId: CONTRACT_IDS.project,
    publicKey: deployKp.publicKey(),
    signTransaction: deployKp,
  });
  const dep = await adm.deposit_revenue({ amount: toStroops(5) });
  await dep.signAndSend();
  log("revenue deposited; claiming again");
  tx = await project.claim_dividends({ investor: userAddr });
  await tx.signAndSend();
  const inv2 = await project.get_investor({ investor: userAddr });
  log(`investor after 2nd claim: claimed=${fmt(inv2.result.claimed)} USDC`);
  const afterClaim = await waitForBalance(userAddr, 2.5, "claim");

  log("— buy 1 kWh credits (1.5 USDC) —");
  tx = await credits.buy_credits({ buyer: userAddr, kwh: 1n });
  await tx.signAndSend();
  const bal = await credits.get_balance({ account: userAddr });
  log(`credit balance: ${bal.result.kwh} kWh`);
  const finalUsdc = await usdcBalance(userAddr);

  log("");
  log("=== RESULTS ===");
  log(`user address:      ${userAddr}`);
  log(`user secret:       ${userKp.secret()}`);
  log(`shares held:       ${inv.result.shares}`);
  log(`dividends claimed: ${fmt(inv2.result.claimed)} USDC`);
  log(`credit balance:    ${bal.result.kwh} kWh`);
  log(`final USDC:        ${finalUsdc.toFixed(4)} (expected ${afterClaim - 1.5})`);
  log("=== SMOKE TEST COMPLETE ===");
}

main().catch((e) => {
  console.error("SMOKE TEST FAILED:", e?.message ?? e);
  console.error((e?.stack ?? "").split("\n").slice(0, 12).join("\n"));
  process.exit(1);
});
