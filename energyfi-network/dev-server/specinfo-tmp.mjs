import * as Sac from './packages/sac-usdc/dist/index.js';
import { Networks } from '@stellar/stellar-sdk';
const c = new Sac.Client({ rpcUrl: 'https://soroban-testnet.stellar.org', contractId: Sac.networks.testnet.contractId, networkPassphrase: Networks.TESTNET });
const m = c.methods['transfer'];
console.log('name', m.name);
for (const a of m.arguments ?? []) console.log('arg', a.name, a.type?.name);
