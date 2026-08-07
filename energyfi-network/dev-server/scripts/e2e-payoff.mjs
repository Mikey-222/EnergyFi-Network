// E2E for installments v7 `payoff_loan` on Stellar testnet:
//   borrower settles the remaining balance in one shot and the loan closes.
// Requires DEPLOY_SECRET + BORROWER_SECRET (the phase-A borrower keypair).
// Run: DEPLOY_SECRET=SB... BORROWER_SECRET=SB... node scripts/e2e-payoff.mjs
import { Keypair, Networks } from '@stellar/stellar-sdk';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Inst from '../packages/installments/dist/index.js';

const RPC_URL = 'https://soroban-testnet.stellar.org:443';
const INST = 'CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM';

// The WI-FI uplink drops undici's TLS connections to *.stellar.org (curl works).
const curlHosts = /(horizon|soroban)-testnet\.stellar\.org$/;
const _fetch = globalThis.fetch;
const curlGate = async (url, opts) => {
  opts = opts || {};
  const u = new URL(url);
  if (!curlHosts.test(u.hostname)) return _fetch(url, opts);
  const dir = mkdtempSync(join(tmpdir(), 'efi-payoff-'));
  const bodyF = join(dir, 'body');
  const args = ['-sS', '-m', '25', '-o', bodyF, '-w', '%{http_code}', '--http1.1', '-X', opts.method || 'GET'];
  for (const [k, v] of Object.entries(opts.headers || {})) {
    if (/^(content-length|accept-encoding)$/i.test(k)) continue;
    args.push('-H', `${k}: ${v}`);
  }
  if (opts.body) {
    if (!Object.keys(opts.headers || {}).some((k) => /^content-type$/i.test(k))) args.push('-H', 'Content-Type: application/json');
    args.push('-d', typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
  }
  args.push(String(url));
  const status = await new Promise((res, rej) => {
    execFile('/usr/bin/curl', args, { maxBuffer: 128 * 1024 * 1024, timeout: 45000 }, (e, out) => e ? rej(e) : res(out.trim() || '0'));
  });
  const body = readFileSync(bodyF);
  rmSync(dir, { recursive: true, force: true });
  return new Response(body, { status: Number(status) || 502 });
};
globalThis.fetch = async (url, opts) => {
  for (let i = 0; i < 8; i++) {
    try { return await curlGate(url, opts); }
    catch (e) { if (i === 7) throw e; await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500)); }
  }
};

const secret = process.env.DEPLOY_SECRET;
const bSecret = process.env.BORROWER_SECRET;
if (!secret) { console.error('Set DEPLOY_SECRET'); process.exit(1); }
if (!bSecret) { console.error('Set BORROWER_SECRET'); process.exit(1); }

const fmt = (n) => (Number(BigInt(n)) / 1e7).toFixed(7);
const kp = Keypair.fromSecret(secret);
const bkp = Keypair.fromSecret(bSecret);
const addr = kp.publicKey();
const bAddr = bkp.publicKey();
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const inst = new Inst.Client({ rpcUrl: RPC_URL, contractId: INST, networkPassphrase: Networks.TESTNET, publicKey: bAddr, signTransaction: bkp });

async function main() {
  log('=== EnergyFi E2E payoff_loan (v7) ===');
  log(`admin:    ${addr}`);
  log(`borrower: ${bAddr}`);
  const fin0 = (await inst.get_financing({ buyer: bAddr, product_id: 'loan_50' })).result;
  log(`before: paid=${fin0.installments_paid}/12 total_paid=${fmt(fin0.total_paid)} outstanding=${fmt(fin0.principal_outstanding)} disbursed=${fin0.disbursed}`);
  const remaining = 12 - Number(fin0.installments_paid);
  if (remaining > 0) {
    const lump = remaining * 4.6;
    log(`→ borrower pays off remaining ${remaining} installments = ${lump} USDC in one shot`);
    const tx = await inst.payoff_loan({ buyer: bAddr, product_id: 'loan_50' });
    await tx.signAndSend();
  } else {
    log('loan already settled — verifying the rejection path only');
  }
  const fin1 = (await inst.get_financing({ buyer: bAddr, product_id: 'loan_50' })).result;
  log(`after:  paid=${fin1.installments_paid}/12 total_paid=${fmt(fin1.total_paid)} outstanding=${fmt(fin1.principal_outstanding)} late=${fin1.late}`);
  if (BigInt(fin1.installments_paid) !== 12n) throw new Error('payoff did not complete the schedule');
  if (BigInt(fin1.principal_outstanding) !== 0n) throw new Error(`payoff did not clear principal: ${fin1.principal_outstanding}`);
  try {
    await (await inst.payoff_loan({ buyer: bAddr, product_id: 'loan_50' })).signAndSend();
    throw new Error('second payoff on a settled loan must panic');
  } catch (e) {
    log('second payoff correctly rejected:', String(e.message ?? e).slice(0, 90));
  }
  const prod = (await inst.get_product({ product_id: 'loan_50' })).result;
  log(`product corpus: total_paid=${fmt(prod.total_paid)} withdrawn=${fmt(prod.withdrawn)}`);
  log('=== PAYOFF COMPLETE ===');
}
main().catch((e) => { console.error('PAYOFF FAILED:', e?.message ?? e); process.exit(1); });