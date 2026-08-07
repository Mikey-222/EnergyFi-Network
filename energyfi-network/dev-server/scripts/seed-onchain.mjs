// Seeds testnet state for the EnergyFi credit marketplace:
//   1. Adds official Circle USDC + EURC trustlines to the deploy account.
//   2. Registers the 4 loan products on the installments (v2) contract.
//   3. Funds the referral reward pools (USDC + EURC) held by the referral contract.
//   4. Deposits a first batch of revenue into the project lending pool.
// Requires DEPLOY_SECRET (secret key of the energyfi-deploy identity).
// Run: DEPLOY_SECRET=SB... node scripts/seed-onchain.mjs
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import * as Installments from "../packages/installments/dist/index.js";
import * as Project from "../packages/project/dist/index.js";
import * as UsdcSac from "../packages/sac-usdc/dist/index.js";
import * as EurcSac from "../packages/sac-eurc/dist/index.js";

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const secret = process.env.DEPLOY_SECRET;
if (!secret) {
  console.error("Set DEPLOY_SECRET (see `stellar keys secret energyfi-deploy`)");
  process.exit(1);
}

const kp = Keypair.fromSecret(secret);

const horizon = new Horizon.Server(HORIZON_URL);
const usdc = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const eurc = new Asset("EURC", "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO");

async function ensureTrustline(asset) {
  const account = await horizon.loadAccount(kp.publicKey());
  const hasTrust = account.balances.some(
    (b) => "asset_code" in b && b.asset_code === asset.code && b.asset_issuer === asset.issuer,
  );
  if (hasTrust) {
    console.log(`${asset.code} trustline already present`);
    return;
  }
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  const res = await horizon.submitTransaction(tx);
  console.log(`${asset.code} trustline added:`, res.hash);
}

async function transfer(asset, to, amount) {
  const account = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset,
        amount: amount.toFixed(7),
      }),
    )
    .setTimeout(60)
    .build();
  tx.sign(kp);
  const res = await horizon.submitTransaction(tx);
  console.log(`sent ${amount} ${asset.code} → ${to.slice(0, 12)}…:`, res.hash.slice(0, 16) + "…");
}

async function sacTransfer(assetCode, sacClient, to, units) {
  const tx = await sacClient.transfer({ from: kp.publicKey(), to, amount: BigInt(units) });
  await tx.signAndSend();
  console.log(`sent ${BigInt(units) / 10000000n} ${assetCode} → ${to.slice(0, 12)}…`);
}

// Keep in sync with src/lib/energyfi/config.ts (bindings embed a stale contractId).
const CONTRACT_IDS = {
  installments: "CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM",
  project: "CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA",
  referral: "CBURYW3CWH7L3R3RUADXCRNOQIOSKJEGDTBT5PPLS3ZMHKXCXDYFABAE",
  usdcSac: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  eurcSac: "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
};

const installments = new Installments.Client({
  rpcUrl: RPC_URL,
  networkPassphrase: Networks.TESTNET,
  contractId: CONTRACT_IDS.installments,
  publicKey: kp.publicKey(),
  signTransaction: kp,
});

const project = new Project.Client({
  ...Project.networks.testnet,
  rpcUrl: RPC_URL,
  contractId: CONTRACT_IDS.project,
  publicKey: kp.publicKey(),
  signTransaction: kp,
});

// Loans: price = principal disbursed to the borrower, monthly x months = total
// repayment (fixed ~10% flat), deposit = 0 (no down payment for loans).
const products = [
  {
    id: "loan_50",
    name: "Neighbourhood loan · 50",
    price: 50,
    monthly: 4.6,
    months: 12,
    deposit: 0,
  },
  {
    id: "loan_100",
    name: "Neighbourhood loan · 100",
    price: 100,
    monthly: 9.2,
    months: 12,
    deposit: 0,
  },
  {
    id: "loan_200",
    name: "Neighbourhood loan · 200",
    price: 200,
    monthly: 18.4,
    months: 12,
    deposit: 0,
  },
  {
    id: "loan_500",
    name: "Neighbourhood loan · 500",
    price: 500,
    monthly: 46,
    months: 12,
    deposit: 0,
  },
];

const toStroops = (n) => BigInt(Math.round(n * 1e7));

for (const p of products) {
  try {
    const tx = await installments.register_product({
      provider: kp.publicKey(),
      product_id: p.id,
      price: toStroops(p.price),
      monthly: toStroops(p.monthly),
      months: p.months,
      deposit: toStroops(p.deposit),
    });
    await tx.signAndSend();
    console.log(`registered ${p.id} (${p.price} USDC, ${p.monthly}/mo × ${p.months})`);
  } catch (err) {
    console.log(`register ${p.id} skipped:`, err?.message ?? err);
  }
}

const usdcSac = new UsdcSac.Client({
  ...UsdcSac.networks.testnet,
  rpcUrl: RPC_URL,
  publicKey: kp.publicKey(),
  signTransaction: kp,
});
const eurcSac = new EurcSac.Client({
  ...EurcSac.networks.testnet,
  rpcUrl: RPC_URL,
  publicKey: kp.publicKey(),
  signTransaction: kp,
});

const stroops = (units) => BigInt(Math.round(Number(units) * 1e7));

// Fund the referral reward pools (0.0001 per side, 2 sides per referral).
// Pools are funded through the Stellar Asset Contracts, not Horizon payments.
try {
  await ensureTrustline(usdc);
  await ensureTrustline(eurc);
  const pool = CONTRACT_IDS.referral;
  const usdcAmount = stroops(process.env.POOL_FUND_USDC ?? 1);
  if (usdcAmount > 0n) {
    await sacTransfer("USDC", usdcSac, pool, usdcAmount);
  }
  const eurcAmount = stroops(process.env.POOL_FUND_EURC ?? process.env.POOL_FUND_USDC ?? 1);
  if (eurcAmount > 0n) {
    try {
      await sacTransfer("EURC", eurcSac, pool, eurcAmount);
    } catch (err) {
      console.log("EURC pool funding skipped (deploy account has no EURC yet):", err?.message);
      console.log(
        "  → Claim EURC from https://faucet.circle.com, then re-run with POOL_FUND_EURC=1",
      );
    }
  }
} catch (err) {
  console.log("referral pool funding failed:", err?.message ?? err);
}

// Fund the loan escrow: liquidity the admin injects so `disburse_loan` can pay
// borrower principals. Repayments flow back via `withdraw` (1% fee) → admin →
// `deposit_revenue` into the lending pool (project contract).
try {
  const amount = stroops(process.env.LOAN_FUND_USDC ?? 5);
  if (amount > 0n) {
    await sacTransfer("USDC", usdcSac, CONTRACT_IDS.installments, amount);
    console.log(`loan escrow funded: ${amount / 10000000n} USDC`);
  }
} catch (err) {
  console.log("loan escrow funding skipped:", err?.message ?? err);
}

try {
  const amount = stroops(process.env.REVENUE_USDC ?? 3);
  if (amount > 0n) {
    const tx = await project.deposit_revenue({ amount });
    await tx.signAndSend();
    console.log(`deposited ${amount / 10000000n} USDC project revenue`);
  }
} catch (err) {
  console.log("revenue deposit skipped:", err?.message ?? err);
}
