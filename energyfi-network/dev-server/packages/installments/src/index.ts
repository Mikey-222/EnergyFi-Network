import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCVXQOOJCHVQVR7VQZJNN7QAZDJ6772GMFPI2XQI2LL7QEYQRURL44LM",
  }
} as const

export type DataKey = {tag: "Admin", values: void} | {tag: "PaymentAsset", values: void} | {tag: "ProjectContract", values: void} | {tag: "Product", values: readonly [string]} | {tag: "Financing", values: readonly [string, string]} | {tag: "FeePool", values: void} | {tag: "Defaulted", values: readonly [string]} | {tag: "Borrowers", values: void} | {tag: "DefaultedAccounts", values: void};


export interface Product {
  active: boolean;
  deposit: i128;
  monthly: i128;
  months: u32;
  price: i128;
  provider: string;
  /**
 * Whether the borrower must already hold a 25% pool-savings pledge to
 * start this financing. Secured (loan) products enforce the pledge at
 * `start_financing`; unsecured (BNPL) products never disburse principal.
 */
secured: boolean;
  /**
 * Sum of installments settled towards the provider's corpus (the routed
 * saver-interest is excluded — it never enters this account).
 */
total_paid: i128;
  /**
 * Amount the provider has withdrawn from the escrow.
 */
withdrawn: i128;
}


export interface Financing {
  buyer: string;
  /**
 * Whether the loan principal has been disbursed to the buyer (loans).
 */
disbursed: boolean;
  /**
 * Installments paid so far.
 */
installments_paid: u32;
  /**
 * Installments due but late (for display).
 */
late: u32;
  /**
 * Remaining principal for loan products (0 for classic BNPL).
 */
principal_outstanding: i128;
  product_id: string;
  /**
 * UNIX timestamp (ledger) when the financing was started. Drives the
 * per-loan schedule shown in the admin console (instalment due dates)
 * and lets borrowers/admins see how far into the term they are.
 */
started_at: u64;
  /**
 * USDC already paid in.
 */
total_paid: i128;
}








export interface EligibilityResult {
  already_started: boolean;
  defaulted: boolean;
  eligible: boolean;
  /**
 * Max principal allowed at the 4x multiple, in stroops.
 */
max_principal: i128;
  /**
 * Loan principal for this product, in stroops.
 */
principal: i128;
  /**
 * Minimum pool savings required (25% of principal), in stroops.
 */
required_pledge: i128;
  /**
 * Borrower's pool savings in stroops.
 */
savings: i128;
}



/**
 * Shape of the savings pool's `get_investor` result (cross-contract read).
 */
export interface ProjectInvestorState {
  claimed: i128;
  invested: i128;
  shares: i128;
  snapshot: i128;
}

export interface Client {
  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Provider withdraws settled funds (installment total minus platform fee).
   */
  withdraw: ({provider, product_id}: {provider: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a fees_owed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Platform fees accrued from provider withdrawals (1% of settled funds),
   * claimable by the admin only.
   */
  fees_owed: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a mark_late transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin flags a disbursed, incomplete loan as late (one missed
   * installment per call). Drives the borrower-facing "overdue" state.
   */
  mark_late: ({admin, buyer, product_id}: {admin: string, buyer: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a claim_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin claims up to `amount` of the accrued platform fees. Fails if
   * `amount` exceeds what has actually accrued. User funds (escrow,
   * repayments) are never touched — only the fee pool is payable.
   */
  claim_fees: ({admin, amount}: {admin: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a borrower_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  borrower_at: ({index}: {index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a get_product transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_product: ({product_id}: {product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Product>>

  /**
   * Construct and simulate a payoff_loan transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buyer repays the entire remaining balance in one transaction: all
   * outstanding installments are settled at once. Each remaining month's
   * saver-interest is routed to the pool in the same way a single
   * installment payment would, so savers earn identically — just batched.
   * Only the principal portions settle into the provider's corpus.
   */
  payoff_loan: ({buyer, product_id}: {buyer: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a defaulted_at transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  defaulted_at: ({index}: {index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a is_defaulted transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_defaulted: ({buyer}: {buyer: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a clear_default transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin override: removes a borrower's default flag.
   */
  clear_default: ({admin, buyer}: {admin: string, buyer: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a disburse_loan transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin disburses the loan principal (`price - deposit`) to the buyer.
   * The contract must already hold the funds (the lenders' liquidity pool
   * tops the escrow up). Repayments flow back through `withdraw`.
   */
  disburse_loan: ({buyer, product_id}: {buyer: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_financing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_financing: ({buyer, product_id}: {buyer: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Financing>>

  /**
   * Construct and simulate a payment_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  payment_asset: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a borrower_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  borrower_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a settle_default transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin writes a loan off as defaulted. The borrower is permanently
   * flagged (until `clear_default`) and can no longer start new financings.
   * No funds move in this version — the written-off principal is the pool's
   * book loss, shown in the admin console.
   */
  settle_default: ({admin, buyer, product_id}: {admin: string, buyer: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a defaulted_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  defaulted_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a pay_installment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buyer pays one monthly installment. The interest embedded in the
   * installment (total repaid minus price, spread evenly over the months)
   * is routed straight into the savings pool in the same transaction —
   * savers' income arrives automatically the moment a repayment lands.
   * Only the principal portion settles into the provider's corpus.
   */
  pay_installment: ({buyer, product_id}: {buyer: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a start_financing transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buyer starts a financing agreement, paying the deposit.
   */
  start_financing: ({buyer, product_id}: {buyer: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a register_product transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * A provider lists a product for pay-in-installments financing.
   * `deposit` is the initial down payment; monthly installments follow.
   */
  register_product: ({provider, product_id, price, monthly, months, deposit}: {provider: string, product_id: string, price: i128, monthly: i128, months: u32, deposit: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a check_eligibility transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Real eligibility verdict for the borrower-facing screen: not
   * defaulted, no existing financing for the product, and pool savings
   * covering at least 25% of the principal.
   */
  check_eligibility: ({borrower, product_id}: {borrower: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<EligibilityResult>>

  /**
   * Construct and simulate a deactivate_product transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deactivate_product: ({provider, product_id}: {provider: string, product_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_collateral_required transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Marks a product as a secured loan (borrower needs the 25% pool-savings
   * pledge to start) or unsecured BNPL. Provider-controlled.
   */
  set_collateral_required: ({provider, product_id, secured}: {provider: string, product_id: string, secured: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, payment_asset, project_contract}: {admin: string, payment_asset: string, project_contract: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, payment_asset, project_contract}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAMUGF5bWVudEFzc2V0AAAAAAAAADtTYXZpbmdzIHBvb2wgY29udHJhY3QgdXNlZCB0byB2ZXJpZnkgdGhlIGJvcnJvd2VyJ3MgcGxlZGdlLgAAAAAPUHJvamVjdENvbnRyYWN0AAAAAAEAAAAVcHJvZHVjdF9pZCAtPiBQcm9kdWN0AAAAAAAAB1Byb2R1Y3QAAAAAAQAAABEAAAABAAAAIChidXllciwgcHJvZHVjdF9pZCkgLT4gRmluYW5jaW5nAAAACUZpbmFuY2luZwAAAAAAAAIAAAATAAAAEQAAAAAAAABGUGxhdGZvcm0gZmVlcyBhY2NydWVkICgxJSBvZiBzZXR0bGVkIHdpdGhkcmF3YWxzKSwgY2xhaW1hYmxlIGJ5IGFkbWluLgAAAAAAB0ZlZVBvb2wAAAAAAQAAAENidXllciAtPiAoKSDigJQgZGVmYXVsdCBmbGFnOyBwZXJtYW5lbnQgdW50aWwgY2xlYXJlZCBieSB0aGUgYWRtaW4uAAAAAAlEZWZhdWx0ZWQAAAAAAAABAAAAEwAAAAAAAAA/SW5kZXggb2YgZXZlcnkgd2FsbGV0IHRoYXQgc3RhcnRlZCBhIGZpbmFuY2luZyAoYWRtaW4gY29uc29sZSkuAAAAAAlCb3Jyb3dlcnMAAAAAAAAAAAAAK0luZGV4IG9mIGRlZmF1bHRlZCB3YWxsZXRzIChhZG1pbiBjb25zb2xlKS4AAAAAEURlZmF1bHRlZEFjY291bnRzAAAA",
        "AAAAAQAAAAAAAAAAAAAAB1Byb2R1Y3QAAAAACQAAAAAAAAAGYWN0aXZlAAAAAAABAAAAAAAAAAdkZXBvc2l0AAAAAAsAAAAAAAAAB21vbnRobHkAAAAACwAAAAAAAAAGbW9udGhzAAAAAAAEAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAACHByb3ZpZGVyAAAAEwAAAM5XaGV0aGVyIHRoZSBib3Jyb3dlciBtdXN0IGFscmVhZHkgaG9sZCBhIDI1JSBwb29sLXNhdmluZ3MgcGxlZGdlIHRvCnN0YXJ0IHRoaXMgZmluYW5jaW5nLiBTZWN1cmVkIChsb2FuKSBwcm9kdWN0cyBlbmZvcmNlIHRoZSBwbGVkZ2UgYXQKYHN0YXJ0X2ZpbmFuY2luZ2A7IHVuc2VjdXJlZCAoQk5QTCkgcHJvZHVjdHMgbmV2ZXIgZGlzYnVyc2UgcHJpbmNpcGFsLgAAAAAAB3NlY3VyZWQAAAAAAQAAAINTdW0gb2YgaW5zdGFsbG1lbnRzIHNldHRsZWQgdG93YXJkcyB0aGUgcHJvdmlkZXIncyBjb3JwdXMgKHRoZSByb3V0ZWQKc2F2ZXItaW50ZXJlc3QgaXMgZXhjbHVkZWQg4oCUIGl0IG5ldmVyIGVudGVycyB0aGlzIGFjY291bnQpLgAAAAAKdG90YWxfcGFpZAAAAAAACwAAADJBbW91bnQgdGhlIHByb3ZpZGVyIGhhcyB3aXRoZHJhd24gZnJvbSB0aGUgZXNjcm93LgAAAAAACXdpdGhkcmF3bgAAAAAAAAs=",
        "AAAAAQAAAAAAAAAAAAAACUZpbmFuY2luZwAAAAAAAAgAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAENXaGV0aGVyIHRoZSBsb2FuIHByaW5jaXBhbCBoYXMgYmVlbiBkaXNidXJzZWQgdG8gdGhlIGJ1eWVyIChsb2FucykuAAAAAAlkaXNidXJzZWQAAAAAAAABAAAAGUluc3RhbGxtZW50cyBwYWlkIHNvIGZhci4AAAAAAAARaW5zdGFsbG1lbnRzX3BhaWQAAAAAAAAEAAAAKEluc3RhbGxtZW50cyBkdWUgYnV0IGxhdGUgKGZvciBkaXNwbGF5KS4AAAAEbGF0ZQAAAAQAAAA7UmVtYWluaW5nIHByaW5jaXBhbCBmb3IgbG9hbiBwcm9kdWN0cyAoMCBmb3IgY2xhc3NpYyBCTlBMKS4AAAAAFXByaW5jaXBhbF9vdXRzdGFuZGluZwAAAAAAAAsAAAAAAAAACnByb2R1Y3RfaWQAAAAAABEAAADEVU5JWCB0aW1lc3RhbXAgKGxlZGdlcikgd2hlbiB0aGUgZmluYW5jaW5nIHdhcyBzdGFydGVkLiBEcml2ZXMgdGhlCnBlci1sb2FuIHNjaGVkdWxlIHNob3duIGluIHRoZSBhZG1pbiBjb25zb2xlIChpbnN0YWxtZW50IGR1ZSBkYXRlcykKYW5kIGxldHMgYm9ycm93ZXJzL2FkbWlucyBzZWUgaG93IGZhciBpbnRvIHRoZSB0ZXJtIHRoZXkgYXJlLgAAAApzdGFydGVkX2F0AAAAAAAGAAAAFVVTREMgYWxyZWFkeSBwYWlkIGluLgAAAAAAAAp0b3RhbF9wYWlkAAAAAAAL",
        "AAAABQAAAAAAAAAAAAAACkZlZUNsYWltZWQAAAAAAAIAAAAFYWRtaW4AAAAAAAAMZmVlc19jbGFpbWVkAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAACldpdGhkcmF3YWwAAAAAAAIAAAAHcHJvZHVjdAAAAAAId2l0aGRyYXcAAAAEAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAAAAAAAApwcm9kdWN0X2lkAAAAAAARAAAAAAAAAAAAAAAGcGF5b3V0AAAAAAALAAAAAAAAAAAAAAADZmVlAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADUxvYW5EZWZhdWx0ZWQAAAAAAAACAAAABGxvYW4AAAAJZGVmYXVsdGVkAAAAAAAAAwAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEQAAAAAAAAAAAAAAC291dHN0YW5kaW5nAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADUxvYW5EaXNidXJzZWQAAAAAAAACAAAABGxvYW4AAAAJZGlzYnVyc2VkAAAAAAAAAwAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEQAAAAAAAAAAAAAACXByaW5jaXBhbAAAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADkRlZmF1bHRDbGVhcmVkAAAAAAACAAAABGxvYW4AAAAPZGVmYXVsdF9jbGVhcmVkAAAAAAEAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADkxvYW5NYXJrZWRMYXRlAAAAAAACAAAABGxvYW4AAAAEbGF0ZQAAAAMAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAAAAAAACnByb2R1Y3RfaWQAAAAAABEAAAAAAAAAAAAAAARsYXRlAAAABAAAAAAAAAAC",
        "AAAAAQAAAAAAAAAAAAAAEUVsaWdpYmlsaXR5UmVzdWx0AAAAAAAABwAAAAAAAAAPYWxyZWFkeV9zdGFydGVkAAAAAAEAAAAAAAAACWRlZmF1bHRlZAAAAAAAAAEAAAAAAAAACGVsaWdpYmxlAAAAAQAAADVNYXggcHJpbmNpcGFsIGFsbG93ZWQgYXQgdGhlIDR4IG11bHRpcGxlLCBpbiBzdHJvb3BzLgAAAAAAAA1tYXhfcHJpbmNpcGFsAAAAAAAACwAAACxMb2FuIHByaW5jaXBhbCBmb3IgdGhpcyBwcm9kdWN0LCBpbiBzdHJvb3BzLgAAAAlwcmluY2lwYWwAAAAAAAALAAAAPU1pbmltdW0gcG9vbCBzYXZpbmdzIHJlcXVpcmVkICgyNSUgb2YgcHJpbmNpcGFsKSwgaW4gc3Ryb29wcy4AAAAAAAAPcmVxdWlyZWRfcGxlZGdlAAAAAAsAAAAjQm9ycm93ZXIncyBwb29sIHNhdmluZ3MgaW4gc3Ryb29wcy4AAAAAB3NhdmluZ3MAAAAACw==",
        "AAAABQAAAAAAAAAAAAAAEVByb2R1Y3RSZWdpc3RlcmVkAAAAAAAAAgAAAAdwcm9kdWN0AAAAAAhyZWdpc3RlcgAAAAUAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAAAAAAAAAAACnByb2R1Y3RfaWQAAAAAABEAAAAAAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAAAAAAAAdtb250aGx5AAAAAAsAAAAAAAAAAAAAAAZtb250aHMAAAAAAAQAAAAAAAAAAg==",
        "AAAAAQAAAEhTaGFwZSBvZiB0aGUgc2F2aW5ncyBwb29sJ3MgYGdldF9pbnZlc3RvcmAgcmVzdWx0IChjcm9zcy1jb250cmFjdCByZWFkKS4AAAAAAAAAFFByb2plY3RJbnZlc3RvclN0YXRlAAAABAAAAAAAAAAHY2xhaW1lZAAAAAALAAAAAAAAAAhpbnZlc3RlZAAAAAsAAAAAAAAABnNoYXJlcwAAAAAACwAAAAAAAAAIc25hcHNob3QAAAAL",
        "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAEhQcm92aWRlciB3aXRoZHJhd3Mgc2V0dGxlZCBmdW5kcyAoaW5zdGFsbG1lbnQgdG90YWwgbWludXMgcGxhdGZvcm0gZmVlKS4AAAAId2l0aGRyYXcAAAACAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAACnByb2R1Y3RfaWQAAAAAABEAAAAA",
        "AAAAAAAAAGNQbGF0Zm9ybSBmZWVzIGFjY3J1ZWQgZnJvbSBwcm92aWRlciB3aXRoZHJhd2FscyAoMSUgb2Ygc2V0dGxlZCBmdW5kcyksCmNsYWltYWJsZSBieSB0aGUgYWRtaW4gb25seS4AAAAACWZlZXNfb3dlZAAAAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAH9BZG1pbiBmbGFncyBhIGRpc2J1cnNlZCwgaW5jb21wbGV0ZSBsb2FuIGFzIGxhdGUgKG9uZSBtaXNzZWQKaW5zdGFsbG1lbnQgcGVyIGNhbGwpLiBEcml2ZXMgdGhlIGJvcnJvd2VyLWZhY2luZyAib3ZlcmR1ZSIgc3RhdGUuAAAAAAltYXJrX2xhdGUAAAAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEQAAAAA=",
        "AAAAAAAAAMJBZG1pbiBjbGFpbXMgdXAgdG8gYGFtb3VudGAgb2YgdGhlIGFjY3J1ZWQgcGxhdGZvcm0gZmVlcy4gRmFpbHMgaWYKYGFtb3VudGAgZXhjZWVkcyB3aGF0IGhhcyBhY3R1YWxseSBhY2NydWVkLiBVc2VyIGZ1bmRzIChlc2Nyb3csCnJlcGF5bWVudHMpIGFyZSBuZXZlciB0b3VjaGVkIOKAlCBvbmx5IHRoZSBmZWUgcG9vbCBpcyBwYXlhYmxlLgAAAAAACmNsYWltX2ZlZXMAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAALYm9ycm93ZXJfYXQAAAAAAQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAAAAAAAALZ2V0X3Byb2R1Y3QAAAAAAQAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEQAAAAEAAAfQAAAAB1Byb2R1Y3QA",
        "AAAAAAAAAUtCdXllciByZXBheXMgdGhlIGVudGlyZSByZW1haW5pbmcgYmFsYW5jZSBpbiBvbmUgdHJhbnNhY3Rpb246IGFsbApvdXRzdGFuZGluZyBpbnN0YWxsbWVudHMgYXJlIHNldHRsZWQgYXQgb25jZS4gRWFjaCByZW1haW5pbmcgbW9udGgncwpzYXZlci1pbnRlcmVzdCBpcyByb3V0ZWQgdG8gdGhlIHBvb2wgaW4gdGhlIHNhbWUgd2F5IGEgc2luZ2xlCmluc3RhbGxtZW50IHBheW1lbnQgd291bGQsIHNvIHNhdmVycyBlYXJuIGlkZW50aWNhbGx5IOKAlCBqdXN0IGJhdGNoZWQuCk9ubHkgdGhlIHByaW5jaXBhbCBwb3J0aW9ucyBzZXR0bGUgaW50byB0aGUgcHJvdmlkZXIncyBjb3JwdXMuAAAAAAtwYXlvZmZfbG9hbgAAAAACAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAACnByb2R1Y3RfaWQAAAAAABEAAAAA",
        "AAAAAAAAAAAAAAAMZGVmYXVsdGVkX2F0AAAAAQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAMaXNfZGVmYXVsdGVkAAAAAQAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAMZJbml0aWFsaXplLiBgYWRtaW5gIGNhbiBwYXVzZSBwcm9kdWN0czsgYHBheW1lbnRfYXNzZXRgIGlzIHRoZQpVU0RDL0VVUkMgdG9rZW4gdXNlcnMgcGF5IHdpdGg7IGBwcm9qZWN0X2NvbnRyYWN0YCBpcyB0aGUgc2F2aW5ncyBwb29sCnVzZWQgdG8gdmVyaWZ5IHRoZSBzb2Z0LWNvbGxhdGVyYWwgcGxlZGdlIGJlZm9yZSBsb2FuIGRpc2J1cnNhbC4AAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAA1wYXltZW50X2Fzc2V0AAAAAAAAEwAAAAAAAAAQcHJvamVjdF9jb250cmFjdAAAABMAAAAA",
        "AAAAAAAAADJBZG1pbiBvdmVycmlkZTogcmVtb3ZlcyBhIGJvcnJvd2VyJ3MgZGVmYXVsdCBmbGFnLgAAAAAADWNsZWFyX2RlZmF1bHQAAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAA=",
        "AAAAAAAAAMhBZG1pbiBkaXNidXJzZXMgdGhlIGxvYW4gcHJpbmNpcGFsIChgcHJpY2UgLSBkZXBvc2l0YCkgdG8gdGhlIGJ1eWVyLgpUaGUgY29udHJhY3QgbXVzdCBhbHJlYWR5IGhvbGQgdGhlIGZ1bmRzICh0aGUgbGVuZGVycycgbGlxdWlkaXR5IHBvb2wKdG9wcyB0aGUgZXNjcm93IHVwKS4gUmVwYXltZW50cyBmbG93IGJhY2sgdGhyb3VnaCBgd2l0aGRyYXdgLgAAAA1kaXNidXJzZV9sb2FuAAAAAAAAAgAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAApwcm9kdWN0X2lkAAAAAAARAAAAAA==",
        "AAAAAAAAAAAAAAANZ2V0X2ZpbmFuY2luZwAAAAAAAAIAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEQAAAAEAAAfQAAAACUZpbmFuY2luZwAAAA==",
        "AAAAAAAAAAAAAAANcGF5bWVudF9hc3NldAAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAAAAAAAAOYm9ycm93ZXJfY291bnQAAAAAAAAAAAABAAAABA==",
        "AAAAAAAAAPpBZG1pbiB3cml0ZXMgYSBsb2FuIG9mZiBhcyBkZWZhdWx0ZWQuIFRoZSBib3Jyb3dlciBpcyBwZXJtYW5lbnRseQpmbGFnZ2VkICh1bnRpbCBgY2xlYXJfZGVmYXVsdGApIGFuZCBjYW4gbm8gbG9uZ2VyIHN0YXJ0IG5ldyBmaW5hbmNpbmdzLgpObyBmdW5kcyBtb3ZlIGluIHRoaXMgdmVyc2lvbiDigJQgdGhlIHdyaXR0ZW4tb2ZmIHByaW5jaXBhbCBpcyB0aGUgcG9vbCdzCmJvb2sgbG9zcywgc2hvd24gaW4gdGhlIGFkbWluIGNvbnNvbGUuAAAAAAAOc2V0dGxlX2RlZmF1bHQAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAApwcm9kdWN0X2lkAAAAAAARAAAAAA==",
        "AAAAAAAAAAAAAAAPZGVmYXVsdGVkX2NvdW50AAAAAAAAAAABAAAABA==",
        "AAAAAAAAAU1CdXllciBwYXlzIG9uZSBtb250aGx5IGluc3RhbGxtZW50LiBUaGUgaW50ZXJlc3QgZW1iZWRkZWQgaW4gdGhlCmluc3RhbGxtZW50ICh0b3RhbCByZXBhaWQgbWludXMgcHJpY2UsIHNwcmVhZCBldmVubHkgb3ZlciB0aGUgbW9udGhzKQppcyByb3V0ZWQgc3RyYWlnaHQgaW50byB0aGUgc2F2aW5ncyBwb29sIGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uIOKAlApzYXZlcnMnIGluY29tZSBhcnJpdmVzIGF1dG9tYXRpY2FsbHkgdGhlIG1vbWVudCBhIHJlcGF5bWVudCBsYW5kcy4KT25seSB0aGUgcHJpbmNpcGFsIHBvcnRpb24gc2V0dGxlcyBpbnRvIHRoZSBwcm92aWRlcidzIGNvcnB1cy4AAAAAAAAPcGF5X2luc3RhbGxtZW50AAAAAAIAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEQAAAAA=",
        "AAAAAAAAADdCdXllciBzdGFydHMgYSBmaW5hbmNpbmcgYWdyZWVtZW50LCBwYXlpbmcgdGhlIGRlcG9zaXQuAAAAAA9zdGFydF9maW5hbmNpbmcAAAAAAgAAAAAAAAAFYnV5ZXIAAAAAAAATAAAAAAAAAApwcm9kdWN0X2lkAAAAAAARAAAAAA==",
        "AAAAAAAAAIFBIHByb3ZpZGVyIGxpc3RzIGEgcHJvZHVjdCBmb3IgcGF5LWluLWluc3RhbGxtZW50cyBmaW5hbmNpbmcuCmBkZXBvc2l0YCBpcyB0aGUgaW5pdGlhbCBkb3duIHBheW1lbnQ7IG1vbnRobHkgaW5zdGFsbG1lbnRzIGZvbGxvdy4AAAAAAAAQcmVnaXN0ZXJfcHJvZHVjdAAAAAYAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEQAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAdtb250aGx5AAAAAAsAAAAAAAAABm1vbnRocwAAAAAABAAAAAAAAAAHZGVwb3NpdAAAAAALAAAAAA==",
        "AAAAAAAAAKdSZWFsIGVsaWdpYmlsaXR5IHZlcmRpY3QgZm9yIHRoZSBib3Jyb3dlci1mYWNpbmcgc2NyZWVuOiBub3QKZGVmYXVsdGVkLCBubyBleGlzdGluZyBmaW5hbmNpbmcgZm9yIHRoZSBwcm9kdWN0LCBhbmQgcG9vbCBzYXZpbmdzCmNvdmVyaW5nIGF0IGxlYXN0IDI1JSBvZiB0aGUgcHJpbmNpcGFsLgAAAAARY2hlY2tfZWxpZ2liaWxpdHkAAAAAAAACAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAACnByb2R1Y3RfaWQAAAAAABEAAAABAAAH0AAAABFFbGlnaWJpbGl0eVJlc3VsdAAAAA==",
        "AAAAAAAAAAAAAAASZGVhY3RpdmF0ZV9wcm9kdWN0AAAAAAACAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAACnByb2R1Y3RfaWQAAAAAABEAAAAA",
        "AAAAAAAAAH9NYXJrcyBhIHByb2R1Y3QgYXMgYSBzZWN1cmVkIGxvYW4gKGJvcnJvd2VyIG5lZWRzIHRoZSAyNSUgcG9vbC1zYXZpbmdzCnBsZWRnZSB0byBzdGFydCkgb3IgdW5zZWN1cmVkIEJOUEwuIFByb3ZpZGVyLWNvbnRyb2xsZWQuAAAAABdzZXRfY29sbGF0ZXJhbF9yZXF1aXJlZAAAAAADAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAACnByb2R1Y3RfaWQAAAAAABEAAAAAAAAAB3NlY3VyZWQAAAAAAQAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    version: this.txFromJSON<u32>,
        withdraw: this.txFromJSON<null>,
        fees_owed: this.txFromJSON<i128>,
        mark_late: this.txFromJSON<null>,
        claim_fees: this.txFromJSON<null>,
        borrower_at: this.txFromJSON<string>,
        get_product: this.txFromJSON<Product>,
        payoff_loan: this.txFromJSON<null>,
        defaulted_at: this.txFromJSON<string>,
        is_defaulted: this.txFromJSON<boolean>,
        clear_default: this.txFromJSON<null>,
        disburse_loan: this.txFromJSON<null>,
        get_financing: this.txFromJSON<Financing>,
        payment_asset: this.txFromJSON<string>,
        borrower_count: this.txFromJSON<u32>,
        settle_default: this.txFromJSON<null>,
        defaulted_count: this.txFromJSON<u32>,
        pay_installment: this.txFromJSON<null>,
        start_financing: this.txFromJSON<null>,
        register_product: this.txFromJSON<null>,
        check_eligibility: this.txFromJSON<EligibilityResult>,
        deactivate_product: this.txFromJSON<null>,
        set_collateral_required: this.txFromJSON<null>
  }
}