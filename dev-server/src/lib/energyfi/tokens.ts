// Horizon-based helpers: balances, trustlines, and payment history.
import { Horizon, Asset, Memo, Transaction, TransactionBuilder, Operation } from "@stellar/stellar-sdk";
import { NETWORK, USDC, EURC } from "./config";
import { signTransactionXdr } from "./signer";
import { cachedRead } from "./cache";

const horizon = new Horizon.Server(NETWORK.horizonUrl);

type PaymentOp = {
  id: string;
  type: string;
  amount: string;
  asset_type: string;
  asset_code?: string;
  from: string;
  to: string;
  created_at: string;
  transaction_hash: string;
};

export type TokenBalance = {
  code: string;
  balance: string; // human units
  asset?: Asset;
};

export type WalletBalances = {
  xlm: string;
  usdc: string;
  eurc: string;
  other: TokenBalance[];
};

export function getBalances(publicKey: string): Promise<WalletBalances> {
  return cachedRead(`balances:${publicKey}`, 12_000, () => loadBalancesFromHorizon(publicKey));
}

async function loadBalancesFromHorizon(publicKey: string): Promise<WalletBalances> {
  const account = await horizon.loadAccount(publicKey);
  let usdc = "0";
  let eurc = "0";
  const other: TokenBalance[] = [];

  for (const b of account.balances) {
    if (b.asset_type === "native" || b.asset_type === "liquidity_pool_shares") {
      continue;
    }
    const code = b.asset_code ?? "";
    const issuer = b.asset_issuer ?? "";
    const balance = b.balance ?? "0";
    if (code === USDC.code && issuer === USDC.issuer) {
      usdc = balance;
    } else if (code === EURC.code && issuer === EURC.issuer) {
      eurc = balance;
    } else {
      other.push({ code, balance, asset: issuer ? new Asset(code, issuer) : undefined });
    }
  }

  const native = account.balances.find((b) => b.asset_type === "native");
  return {
    xlm: native && "balance" in native ? native.balance : "0",
    usdc,
    eurc,
    other,
  };
}

export function hasTrustline(balances: WalletBalances, code: string): boolean {
  return (
    (code === USDC.code && Number(balances.usdc) >= 0) ||
    (code === EURC.code && Number(balances.eurc) >= 0) ||
    balances.other.some((t) => t.code === code)
  );
}

export async function addTrustline(publicKey: string, code: string): Promise<string> {
  const issuer = code === USDC.code ? USDC.issuer : EURC.issuer;
  const account = await horizon.loadAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(code, issuer),
      }),
    )
    .setTimeout(60)
    .build();

  const signed = await signTransactionXdr(tx.toXDR());
  const txToSubmit = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK.networkPassphrase);
  const res = await horizon.submitTransaction(txToSubmit as Transaction);
  return res.hash;
}

export async function sendUsdc(params: {
  from: string;
  to: string;
  amount: string;
  memo?: string;
}): Promise<{ hash: string; success: boolean }> {
  return sendAssetPayment({ asset: new Asset(USDC.code, USDC.issuer), ...params });
}

export async function sendEurc(params: {
  from: string;
  to: string;
  amount: string;
  memo?: string;
}): Promise<{ hash: string; success: boolean }> {
  return sendAssetPayment({ asset: new Asset(EURC.code, EURC.issuer), ...params });
}

async function sendAssetPayment(params: {
  from: string;
  to: string;
  amount: string;
  memo?: string;
  asset: Asset;
}): Promise<{ hash: string; success: boolean }> {
  const account = await horizon.loadAccount(params.from);
  const builder = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK.networkPassphrase,
  }).addOperation(
    Operation.payment({
      destination: params.to,
      asset: params.asset,
      amount: params.amount,
    }),
  );
  if (params.memo) {
    builder.addMemo(Memo.text(params.memo));
  }
  const tx = builder.setTimeout(180).build();

  const signed = await signTransactionXdr(tx.toXDR());
  const txToSubmit = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK.networkPassphrase);
  const res = await horizon.submitTransaction(txToSubmit as Transaction);
  return { hash: res.hash, success: res.successful };
}

export type PaymentRecord = {
  id: string;
  type: string;
  amount: string;
  asset: string;
  from: string;
  to: string;
  createdAt: string;
  hash: string;
};

export function getPaymentHistory(publicKey: string, limit = 20): Promise<PaymentRecord[]> {
  return cachedRead(`payments:${publicKey}:${limit}`, 25_000, () => loadPayments(publicKey, limit));
}

async function loadPayments(publicKey: string, limit: number): Promise<PaymentRecord[]> {
  const payments = await horizon.payments().forAccount(publicKey).order("desc").limit(limit).call();

  return payments.records.map((p) => {
    const op = p as unknown as PaymentOp;
    return {
      id: op.id,
      type: op.type,
      amount: op.amount,
      asset: op.asset_type === "native" ? "XLM" : (op.asset_code ?? "unknown"),
      from: op.from,
      to: op.to,
      createdAt: op.created_at,
      hash: op.transaction_hash,
    };
  });
}

/** Friendbot (testnet XLM) for a fresh account. */
export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  return res.ok;
}
