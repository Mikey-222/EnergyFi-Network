import { Networks } from '@stellar/stellar-sdk';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Inst from '../packages/installments/dist/index.js';

const RPC_URL = 'https://soroban-testnet.stellar.org:443';
const INST = 'CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM';
const BORROWER = 'GAMFAIXVHCFIA73N4KZRTTNPGFPUHO4E45MROJOUCLYGHWACJZAKC7VD';

const tmpg = mkdtempSync(join(tmpdir(), 'cf-'));
const curlGate = async (url, opts) => {
  opts = opts || {};
  const bodyF = join(tmpg, 'b');
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
  rmSync(tmpg, { recursive: true, force: true });
  return new Response(body, { status: Number(status) || 502 });
};
globalThis.fetch = async (url, opts) => {
  for (let i = 0; i < 8; i++) {
    try { return await curlGate(url, opts); }
    catch (e) { if (i === 7) throw e; await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500)); }
  }
};

const client = new Inst.Client({ rpcUrl: RPC_URL, contractId: INST, networkPassphrase: Networks.TESTNET, publicKey: BORROWER });
console.log('contract:', INST);
console.log('borrower:', BORROWER);
for (const pid of ['loan_50', 'loan_100', 'loan_200', 'loan_500', 'loan_25']) {
  try {
    const f = (await client.get_financing({ buyer: BORROWER, product_id: pid })).result;
    console.log(`  ${pid}: paid=${f.installments_paid} total_paid=${Number(f.total_paid)/1e7} outstanding=${Number(f.principal_outstanding)/1e7} late=${f.late} disbursed=${f.disbursed} started_at=${f.started_at}`);
  } catch (e) {
    console.log(`  ${pid}: no financing (${String(e.message ?? e).slice(0, 40)})`);
  }
}