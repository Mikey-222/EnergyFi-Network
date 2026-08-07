/**
 * Stellar Helper - Blockchain Logic with Stellar Wallets Kit
 * ⚠️ DO NOT MODIFY THIS FILE! ⚠️
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";

export type PaymentOp = {
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

export class StellarHelper {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private kit: StellarWalletsKit | null = null;
  private network: WalletNetwork;

  constructor(network: "testnet" | "mainnet" = "testnet") {
    this.server = new StellarSdk.Horizon.Server(
      network === "testnet" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org",
    );
    this.networkPassphrase =
      network === "testnet" ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;

    this.network = network === "testnet" ? WalletNetwork.TESTNET : WalletNetwork.PUBLIC;

    // Stellar Wallets Kit'i lazy initialize et (sadece client-side'da)
    // Don't initialize here to avoid SSR issues
  }

  private getKit(): StellarWalletsKit {
    // Only initialize kit on client-side (browser)
    if (typeof window === "undefined") {
      throw new Error("StellarWalletsKit can only be used in the browser");
    }

    if (!this.kit) {
      this.kit = new StellarWalletsKit({
        network: this.network,
        selectedWalletId: FREIGHTER_ID,
        modules: allowAllModules(),
      });
    }

    return this.kit;
  }

  async getBalance(publicKey: string): Promise<{
    xlm: string;
    assets: Array<{ code: string; issuer: string; balance: string }>;
  }> {
    const account = await this.server.loadAccount(publicKey);

    const xlmBalance = account.balances.find((b) => b.asset_type === "native");

    const assets = account.balances
      .filter((b) => b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12")
      .map((b) => ({
        code: b.asset_code,
        issuer: b.asset_issuer,
        balance: b.balance,
      }));

    return {
      xlm: xlmBalance && "balance" in xlmBalance ? xlmBalance.balance : "0",
      assets,
    };
  }

  async sendPayment(params: {
    from: string;
    to: string;
    amount: string;
    memo?: string;
  }): Promise<{ hash: string; success: boolean }> {
    const account = await this.server.loadAccount(params.from);

    const transactionBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    }).addOperation(
      StellarSdk.Operation.payment({
        destination: params.to,
        asset: StellarSdk.Asset.native(),
        amount: params.amount,
      }),
    );

    if (params.memo) {
      transactionBuilder.addMemo(StellarSdk.Memo.text(params.memo));
    }

    const transaction = transactionBuilder.setTimeout(180).build();

    // Wallet Kit ile imzala
    const kit = this.getKit();
    const { signedTxXdr } = await kit.signTransaction(transaction.toXDR(), {
      networkPassphrase: this.networkPassphrase,
    });

    const transactionToSubmit = StellarSdk.TransactionBuilder.fromXDR(
      signedTxXdr,
      this.networkPassphrase,
    );

    const result = await this.server.submitTransaction(
      transactionToSubmit as StellarSdk.Transaction,
    );

    return {
      hash: result.hash,
      success: result.successful,
    };
  }

  async getRecentTransactions(
    publicKey: string,
    limit: number = 10,
  ): Promise<
    Array<{
      id: string;
      type: string;
      amount?: string;
      asset?: string;
      from?: string;
      to?: string;
      createdAt: string;
      hash: string;
    }>
  > {
    const payments = await this.server
      .payments()
      .forAccount(publicKey)
      .order("desc")
      .limit(limit)
      .call();

    return payments.records.map((payment) => {
      const op = payment as unknown as PaymentOp;
      return {
        id: op.id,
        type: op.type,
        amount: op.amount,
        asset: op.asset_type === "native" ? "XLM" : op.asset_code,
        from: op.from,
        to: op.to,
        createdAt: op.created_at,
        hash: op.transaction_hash,
      };
    });
  }

  getExplorerLink(hash: string, type: "tx" | "account" = "tx"): string {
    const network = this.networkPassphrase === StellarSdk.Networks.TESTNET ? "testnet" : "public";
    return `https://stellar.expert/explorer/${network}/${type}/${hash}`;
  }

  formatAddress(address: string, startChars: number = 4, endChars: number = 4): string {
    if (address.length <= startChars + endChars) {
      return address;
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }

  disconnect() {
    return true;
  }
}

// Only create instance on client-side to avoid SSR issues
let stellarInstance: StellarHelper | null = null;

function getStellarInstance(): StellarHelper {
  if (typeof window === "undefined") {
    throw new Error(
      'StellarHelper can only be used in client components. Make sure your component has "use client" directive.',
    );
  }

  if (!stellarInstance) {
    stellarInstance = new StellarHelper("testnet");
  }

  return stellarInstance;
}

// Export a getter that lazily creates the instance only when accessed
// This prevents SSR issues by not creating the instance at module load time
export const stellar = new Proxy({} as StellarHelper, {
  get(_target, prop) {
    const instance = getStellarInstance();
    const value = (instance as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
