// Referral program smoke test on Stellar testnet (v2, usage-gated):
//   1. Funds a fresh neighbour account (friendbot + USDC/EURC trustlines).
//   2. The referrer (deploy account) registers the neighbour — NO payout yet.
//   3. The referee confirms app usage (their own signature).
//   4. Anyone claims — BOTH wallets then receive 0.0001 USDC from the pool.
// Requires DEPLOY_SECRET (secret key of the energyfi-deploy identity).
// Run: DEPLOY_SECRET=SB... node scripts/referral-demo.mjs
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import * as Referral from "../packages/referral/dist/index.js";
import * as UsdcSac from "../packages/sac-usdc/dist/index.js";
import * as EurcSac from "../packages/sac-eurc/dist/index.js";

const RPC_URL = "https://soroban-testnet.stellar.org:443";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const secret = process.env.DEPLOY_SECRET;
if (!secret) {
  console.error("Set DEPLOY_SECRET (see `stellar keys secret energyfi-deploy`)");
  process.exit(1);
}

const CONTRACT_IDS = {
  referral: "CBURYW3CWH7L3R3RUADXCRNOQIOSKJEGDTBT5PPLS3ZMHKXCXDYFABAE",
  usdcSac: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  eurcSac: "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
};

const referrerKp = Keypair.fromSecret(secret);
const refereeKp = Keypair.random();
const refereeAddr = refereeKp.publicKey();
const horizon = new Horizon.Server(HORIZON_URL);
const usdcAsset = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const eurcAsset = new Asset("EURC", "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO");
const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
const fmt = (n) => {
  n = BigInt(n);
  const w = n / 10000000n;
  const f = n % 10000000n;
  return f === 0n ? w.toString() : `${w}.${f.toString().padStart(7, "0").replace(/0+$/, "")}`;
};

const client = (kp, pkg, contractId) =>
  new pkg.Client({
    rpcUrl: RPC_URL,
    networkPassphrase: Networks.TESTNET,
    contractId,
    publicKey: kp.publicKey(),
    signTransaction: kp,
  });

const referralAs = (kp) => client(kp, Referral, CONTRACT_IDS.referral);
const sac = (id) => client(referrerKp, UsdcSac, id);

async function friendbotFund() {
  const res = await fetch(`https://friendbot.stellar.org?addr=${refereeAddr}`);
  if (!res.ok) throw new Error(`friendbot failed: ${res.status}`);
  log(`friendbot funded ${refereeAddr.slice(0, 12)}…`);
}

async function addTrustlines() {
  const account = await horizon.loadAccount(refereeAddr);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: usdcAsset }))
    .addOperation(Operation.changeTrust({ asset: eurcAsset }))
    .setTimeout(60)
    .build();
  tx.sign(refereeKp);
  const res = await horizon.submitTransaction(tx);
  log("USDC + EURC trustlines added:", res.hash.slice(0, 16) + "…");
}

async function sacBalance(addr, sacId) {
  const res = await sac(sacId).balance({ id: addr });
  return BigInt(res.result);
}

async function main() {
  log("=== EnergyFi referral demo (v2, usage-gated) ===");
  const reward = await referralAs(referrerKp).reward();
  const max = await referralAs(referrerKp).max_referrals();
  const countBefore = await referralAs(referrerKp).referrer_count({
    referrer: referrerKp.publicKey(),
  });
  log(`reward: ${fmt(reward.result)} units, max referrals: ${max.result}`);
  log(`referrer has ${countBefore.result} referrals so far`);

  await friendbotFund();
  await addTrustlines();

  const referrerUsdcBefore = await sacBalance(referrerKp.publicKey(), CONTRACT_IDS.usdcSac);
  const refereeUsdcBefore = await sacBalance(refereeAddr, CONTRACT_IDS.usdcSac);
  log(
    `balances before: referrer ${fmt(referrerUsdcBefore)} USDC, referee ${fmt(refereeUsdcBefore)} USDC`,
  );

  log("— 1. registering referral (USDC) —");
  const tx = await referralAs(referrerKp).register({
    referrer: referrerKp.publicKey(),
    referee: refereeAddr,
    currency: "USDC",
  });
  await tx.signAndSend();

  const referrerUsdcAfterReg = await sacBalance(referrerKp.publicKey(), CONTRACT_IDS.usdcSac);
  const refereeUsdcAfterReg = await sacBalance(refereeAddr, CONTRACT_IDS.usdcSac);
  const noPayoutYet =
    referrerUsdcAfterReg === referrerUsdcBefore && refereeUsdcAfterReg === refereeUsdcBefore;
  log(
    `after register: referrer ${fmt(referrerUsdcAfterReg)} USDC, referee ${fmt(refereeUsdcAfterReg)} USDC — payout held ${noPayoutYet ? "✓" : "✗"}`,
  );

  log("— 2. referee confirms app usage —");
  const confirmTx = await referralAs(refereeKp).confirm_usage({ referee: refereeAddr });
  await confirmTx.signAndSend();
  const confirmed = await referralAs(refereeKp).confirmed({ referee: refereeAddr });
  log(`usage confirmed: ${confirmed.result ? "✓" : "✗"}`);

  log("— 3. claiming reward —");
  const claimTx = await referralAs(refereeKp).claim_referral({
    referrer: referrerKp.publicKey(),
    referee: refereeAddr,
    currency: "USDC",
  });
  await claimTx.signAndSend();

  const referrerUsdcAfter = await sacBalance(referrerKp.publicKey(), CONTRACT_IDS.usdcSac);
  const refereeUsdcAfter = await sacBalance(refereeAddr, CONTRACT_IDS.usdcSac);
  const countAfter = await referralAs(referrerKp).referrer_count({
    referrer: referrerKp.publicKey(),
  });
  const list = await referralAs(referrerKp).referees({ referrer: referrerKp.publicKey() });
  const claimed = await referralAs(referrerKp).claimed({
    referrer: referrerKp.publicKey(),
    referee: refereeAddr,
    currency: "USDC",
  });

  const okReferrer = referrerUsdcAfter - referrerUsdcAfterReg === reward.result;
  const okReferee = refereeUsdcAfter - refereeUsdcAfterReg === reward.result;

  log("");
  log("=== RESULTS ===");
  log(`referrer:      ${referrerKp.publicKey()}`);
  log(`referee:       ${refereeAddr}`);
  log(`referee secret: ${refereeKp.secret()}  (import in Freighter to see the 0.0001 USDC)`);
  log(`referrer +${fmt(referrerUsdcAfter - referrerUsdcAfterReg)} USDC ${okReferrer ? "✓" : "✗"}`);
  log(`referee  +${fmt(refereeUsdcAfter - refereeUsdcAfterReg)} USDC ${okReferee ? "✓" : "✗"}`);
  log(
    `referral count: ${countAfter.result} (referees: ${list.result.length}), claimed: ${claimed.result}`,
  );
  log(
    noPayoutYet && confirmed.result && okReferrer && okReferee && claimed.result
      ? "=== REFERRAL DEMO COMPLETE ==="
      : "=== DEMO FAILED ===",
  );
}

main().catch((e) => {
  console.error("REFERRAL DEMO FAILED:", e?.message ?? e);
  console.error((e?.stack ?? "").split("\n").slice(0, 12).join("\n"));
  process.exit(1);
});
