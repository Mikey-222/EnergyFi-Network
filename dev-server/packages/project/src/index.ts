/* eslint-disable */
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




export type DataKey = {tag: "Admin", values: void} | {tag: "PaymentAsset", values: void} | {tag: "SharePrice", values: void} | {tag: "TotalShares", values: void} | {tag: "TotalSold", values: void} | {tag: "RevPerShare", values: void} | {tag: "PendingRevenue", values: void} | {tag: "TotalInvested", values: void} | {tag: "Name", values: void} | {tag: "Symbol", values: void} | {tag: "Investor", values: readonly [string]};




export interface InvestorState {
  /**
 * Dividends already claimed (stroops).
 */
claimed: i128;
  /**
 * Total invested (stroops).
 */
invested: i128;
  shares: i128;
  /**
 * Baseline for dividend math: shares * rev_per_share at buy time (scaled).
 */
snapshot: i128;
}


export interface Client {
  /**
   * Construct and simulate a invest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Invest `amount` (stroops of payment asset) and receive shares at the
   * fixed share price (rounded down). Reverts if shares would exceed the
   * total issued.
   */
  invest: ({investor, amount}: {investor: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a claimable transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claimable: ({investor}: {investor: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a total_sold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  total_sold: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a share_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  share_price: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_investor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_investor: ({investor}: {investor: string}, options?: MethodOptions) => Promise<AssembledTransaction<InvestorState>>

  /**
   * Construct and simulate a total_raised transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  total_raised: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a payment_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  payment_asset: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a route_revenue transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Routes revenue into the dividend pool on behalf of a trusted router
   * (the installments contract). The router must have already transferred
   * `amount` into this contract's balance — `router.require_auth()` binds
   * the call to the router contract itself, so only that contract can book
   * revenue here (a stranger passing the router's address fails the check).
   */
  route_revenue: ({router, amount}: {router: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a claim_dividends transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Claim the investor's share of all deposited revenue, pro-rata by shares.
   */
  claim_dividends: ({investor}: {investor: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a deposit_revenue transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin deposits project revenue (e.g. energy sales) into the dividend pool.
   */
  deposit_revenue: ({amount}: {amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, payment_asset, share_price, total_shares, name, symbol}: {admin: string, payment_asset: string, share_price: i128, total_shares: i128, name: string, symbol: string},
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
    return ContractClient.deploy({admin, payment_asset, share_price, total_shares, name, symbol}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAMUGF5bWVudEFzc2V0AAAAAAAAADNQcmljZSBvZiBvbmUgc2hhcmUgaW4gc3Ryb29wcyBvZiB0aGUgcGF5bWVudCBhc3NldC4AAAAAClNoYXJlUHJpY2UAAAAAAAAAAAAvVG90YWwgbnVtYmVyIG9mIHNoYXJlcyBpc3N1ZWQgZm9yIHRoaXMgcHJvamVjdC4AAAAAC1RvdGFsU2hhcmVzAAAAAAAAAAAlVG90YWwgbnVtYmVyIG9mIHNoYXJlcyBhY3R1YWxseSBzb2xkLgAAAAAAAAlUb3RhbFNvbGQAAAAAAAAAAAAAN0N1bXVsYXRpdmUgZGl2aWRlbmQgYWNjcnVhbCBwZXIgc2hhcmUsIHNjYWxlZCBieSBTQ0FMRS4AAAAAC1JldlBlclNoYXJlAAAAAAAAAABKUmV2ZW51ZSBkZXBvc2l0ZWQgd2hpbGUgbm8gc2hhcmVzIHdlcmUgc29sZCB5ZXQgKGFwcGxpZWQgb24gZmlyc3QgaW52ZXN0KS4AAAAAAA5QZW5kaW5nUmV2ZW51ZQAAAAAAAAAAACVDdW11bGF0aXZlIGludmVzdGVkIGFtb3VudCAoc3Ryb29wcykuAAAAAAAADVRvdGFsSW52ZXN0ZWQAAAAAAAAAAAAAAAAAAAROYW1lAAAAAAAAAAAAAAAGU3ltYm9sAAAAAAABAAAAGWludmVzdG9yIC0+IEludmVzdG9yU3RhdGUAAAAAAAAISW52ZXN0b3IAAAABAAAAEw==",
        "AAAABQAAAAAAAAAAAAAACEludmVzdGVkAAAAAgAAAAdwcm9qZWN0AAAAAAZpbnZlc3QAAAAAAAMAAAAAAAAACGludmVzdG9yAAAAEwAAAAAAAAAAAAAABnNoYXJlcwAAAAAACwAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADERpdmlkZW5kUGFpZAAAAAIAAAAHcHJvamVjdAAAAAAIZGl2aWRlbmQAAAACAAAAAAAAAAhpbnZlc3RvcgAAABMAAAAAAAAAAAAAAAZwYXlvdXQAAAAAAAsAAAAAAAAAAg==",
        "AAAAAQAAAAAAAAAAAAAADUludmVzdG9yU3RhdGUAAAAAAAAEAAAAJERpdmlkZW5kcyBhbHJlYWR5IGNsYWltZWQgKHN0cm9vcHMpLgAAAAdjbGFpbWVkAAAAAAsAAAAZVG90YWwgaW52ZXN0ZWQgKHN0cm9vcHMpLgAAAAAAAAhpbnZlc3RlZAAAAAsAAAAAAAAABnNoYXJlcwAAAAAACwAAAEhCYXNlbGluZSBmb3IgZGl2aWRlbmQgbWF0aDogc2hhcmVzICogcmV2X3Blcl9zaGFyZSBhdCBidXkgdGltZSAoc2NhbGVkKS4AAAAIc25hcHNob3QAAAAL",
        "AAAABQAAAAAAAAAAAAAAEFJldmVudWVEZXBvc2l0ZWQAAAACAAAAB3Byb2plY3QAAAAAB3JldmVudWUAAAAAAgAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAARcmV2ZW51ZV9wZXJfc2hhcmUAAAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAJdJbnZlc3QgYGFtb3VudGAgKHN0cm9vcHMgb2YgcGF5bWVudCBhc3NldCkgYW5kIHJlY2VpdmUgc2hhcmVzIGF0IHRoZQpmaXhlZCBzaGFyZSBwcmljZSAocm91bmRlZCBkb3duKS4gUmV2ZXJ0cyBpZiBzaGFyZXMgd291bGQgZXhjZWVkIHRoZQp0b3RhbCBpc3N1ZWQuAAAAAAZpbnZlc3QAAAAAAAIAAAAAAAAACGludmVzdG9yAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAJY2xhaW1hYmxlAAAAAAAAAQAAAAAAAAAIaW52ZXN0b3IAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAKdG90YWxfc29sZAAAAAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAALc2hhcmVfcHJpY2UAAAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAAMZ2V0X2ludmVzdG9yAAAAAQAAAAAAAAAIaW52ZXN0b3IAAAATAAAAAQAAB9AAAAANSW52ZXN0b3JTdGF0ZQAAAA==",
        "AAAAAAAAAAAAAAAMdG90YWxfcmFpc2VkAAAAAAAAAAEAAAAL",
        "AAAAAAAAAHVJbml0aWFsaXplIGEgdG9rZW5pemVkIHByb2plY3QuIE9uZSBjb250cmFjdCBpbnN0YW5jZSBwZXIgcHJvamVjdC4KYGFkbWluYCBkZXBvc2l0cyBwcm9qZWN0IHJldmVudWUgZm9yIGRpc3RyaWJ1dGlvbi4AAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAYAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAANcGF5bWVudF9hc3NldAAAAAAAABMAAAAAAAAAC3NoYXJlX3ByaWNlAAAAAAsAAAAAAAAADHRvdGFsX3NoYXJlcwAAAAsAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAZzeW1ib2wAAAAAABAAAAAA",
        "AAAAAAAAAAAAAAANcGF5bWVudF9hc3NldAAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAAWBSb3V0ZXMgcmV2ZW51ZSBpbnRvIHRoZSBkaXZpZGVuZCBwb29sIG9uIGJlaGFsZiBvZiBhIHRydXN0ZWQgcm91dGVyCih0aGUgaW5zdGFsbG1lbnRzIGNvbnRyYWN0KS4gVGhlIHJvdXRlciBtdXN0IGhhdmUgYWxyZWFkeSB0cmFuc2ZlcnJlZApgYW1vdW50YCBpbnRvIHRoaXMgY29udHJhY3QncyBiYWxhbmNlIOKAlCBgcm91dGVyLnJlcXVpcmVfYXV0aCgpYCBiaW5kcwp0aGUgY2FsbCB0byB0aGUgcm91dGVyIGNvbnRyYWN0IGl0c2VsZiwgc28gb25seSB0aGF0IGNvbnRyYWN0IGNhbiBib29rCnJldmVudWUgaGVyZSAoYSBzdHJhbmdlciBwYXNzaW5nIHRoZSByb3V0ZXIncyBhZGRyZXNzIGZhaWxzIHRoZSBjaGVjaykuAAAADXJvdXRlX3JldmVudWUAAAAAAAACAAAAAAAAAAZyb3V0ZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAEhDbGFpbSB0aGUgaW52ZXN0b3IncyBzaGFyZSBvZiBhbGwgZGVwb3NpdGVkIHJldmVudWUsIHByby1yYXRhIGJ5IHNoYXJlcy4AAAAPY2xhaW1fZGl2aWRlbmRzAAAAAAEAAAAAAAAACGludmVzdG9yAAAAEwAAAAEAAAAL",
        "AAAAAAAAAEpBZG1pbiBkZXBvc2l0cyBwcm9qZWN0IHJldmVudWUgKGUuZy4gZW5lcmd5IHNhbGVzKSBpbnRvIHRoZSBkaXZpZGVuZCBwb29sLgAAAAAAD2RlcG9zaXRfcmV2ZW51ZQAAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    invest: this.txFromJSON<i128>,
        version: this.txFromJSON<u32>,
        claimable: this.txFromJSON<i128>,
        total_sold: this.txFromJSON<i128>,
        share_price: this.txFromJSON<i128>,
        get_investor: this.txFromJSON<InvestorState>,
        total_raised: this.txFromJSON<i128>,
        payment_asset: this.txFromJSON<string>,
        route_revenue: this.txFromJSON<null>,
        claim_dividends: this.txFromJSON<i128>,
        deposit_revenue: this.txFromJSON<null>
  }
}