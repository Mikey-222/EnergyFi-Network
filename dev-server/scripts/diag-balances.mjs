import { Keypair, Networks } from '@stellar/stellar-sdk';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Installments from '../packages/installments/dist/index.js';
import * as Project from '../packages/project/dist/index.js';
import * as UsdcSac from '../packages/sac-usdc/dist/index.js';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const HORIZON = 'https://horizon-testnet.stellar.org';
const INST = 'CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM';
const PROJ = 'CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA';
const ADMIN = 'GBR5H3DVUZRMG2ESUBZP6SOASOBHKZCWR5VM6YB4FZG7MR3GBQOGOBV5';
const BORROWER = 'GAMFAIXVHCFIA73N4KZRTTNPGFPUHO4E45MROJOUCLYGHWACJZAKC7VD';

const tmp = mkdtempSync(join(tmpdir(), 'diag-'));
let lastBody = '';
const curlGate = async (url, opts) => {
  opts = opts || {};
  const bodyF = join(tmp, 'b');
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
  lastBody = readFileSync(bodyF);
  return new Response(lastBody, { status: Number(status) || 502 });
};
globalThis.fetch = curlGate;

const kp = Keypair.fromSecret(process.env.DEPLOY_SECRET);
const inst = new Installments.Client({ rpcUrl: RPC_URL, contractId: INST, networkPassphrase: Networks.TESTNET, publicKey: kp.publicKey() });
const sac = new UsdcSac.Client({ rpcUrl: RPC_URL, contractId: UsdcSac.networks.testnet.contractId, networkPassphrase: Networks.TESTNET, publicKey: kp.publicKey() });

const horizon = async (addr) => {
  const r = await curlGate(`${HORIZON}/accounts/${addr}`, {});
  const a = await r.json();
  const out = {};
  for (const b of a.balances) {
    if (b.asset_type === 'native') out.xlm = Number(b.balance).toFixed(2);
    if (b.asset_code === 'USDC') out.usdc = Number(b.balance).toFixed(4);
  }
  return out;
};
const sacBal = async (id) => (Number((await sac.balance({ id: id }).result ?? 0n)) / 1e7).toFixed(4);

console.log('== Balances ==');
for (const [tag, a] of [['admin', ADMIN], ['borrower', BORROWER]]) {
  const b = await horizon(a);
  console.log(`${tag} USDC ${b.usdc}  XLM ${b.xlm}`);
}
console.log('installments contract USDC:', await sacBal(INST));
console.log('    project  contract USDC:', await sacBal(PROJ));

console.log('\n== products ==');
for (const p of ['loan_50', 'loan_100', 'loan_25', 'loan_12_5']) {
  const pr = (await inst.get_product({ product_id: p })).result;
  console.log(p, {
    total_paid: (Number(pr.total_paid ?? 0n) / 1e7).toFixed(4),
    withdrawn: (Number(pr.withdrawn ?? 0n) / 1e7).toFixed(4),
    settled_u: (Number(pr.total_paid ?? 0n) - Number(pr.withdrawn ?? 0n)) / 1e7,
    months: String(pr.months ?? ''),
  });
}

console.log('\n== E2E borrower loan_50 financing ==');
const fin = (await inst.get_financing({ buyer: BORROWER, product_id: 'loan_50' })).result;
console.log({
  installments_paid: String(fin.installments_paid),
  late: String(fin.late),
  disbursed: fin.disbursed,
  outstanding: (Number(fin.principal_outstanding) / 1e7).toFixed(2),
});
console.log('is_defaulted:', (await inst.is_defaulted({ buyer: BORROWER })).result);
console.log('\n== admin recent payments (horizon) ==');
{
  const r = await curlGate(`${HORIZON}/accounts/${ADMIN}/payments?order=desc&limit=15`, {});
  const j = await r.json();
  for (const p of j._embedded?.records ?? []) {
    const asset = p.asset_type === 'native' ? 'XLM' : p.asset_code;
    console.log(p.created_at.slice(0, 19), '|', p.type, '|', String(p.from || '').slice(0, 10), '->', String(p.to || p.account || '').slice(0, 10), '|', p.amount, asset);
  }
}
