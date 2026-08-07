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


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CB56C2Z5LN5ACMY4T4GIVETTNJLNUMMSWSI4UEEZNP5KCBFOJ3PBM7YC",
  }
} as const

export type DataKey = {tag: "Admin", values: void} | {tag: "KwhPrice", values: void} | {tag: "PaymentAsset", values: void} | {tag: "Name", values: void} | {tag: "Symbol", values: void} | {tag: "Credit", values: readonly [string]};



export interface CreditBalance {
  kwh: i128;
  /**
 * Total credits consumed over the lifetime of the account.
 */
total_consumed: i128;
  /**
 * Total credits purchased over the lifetime of the account.
 */
total_purchased: i128;
}

export interface Client {
  /**
   * Construct and simulate a price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  price: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set the price of one kWh in the payment asset (admin only).
   */
  set_price: ({kwh_price}: {kwh_price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a buy_credits transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buy prepaid energy credits. `buyer` pays `kwh * price` in the payment
   * asset, which is held by this contract, and receives `kwh` of credit.
   */
  buy_credits: ({buyer, kwh}: {buyer: string, kwh: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_balance: ({account}: {account: string}, options?: MethodOptions) => Promise<AssembledTransaction<CreditBalance>>

  /**
   * Construct and simulate a payment_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  payment_asset: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a consume_credits transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Consume `kwh` of energy credit (called by EnergyFi when a user pays an
   * energy bill or uses the grid). Admin only.
   */
  consume_credits: ({account, kwh}: {account: string, kwh: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, payment_asset, kwh_price, name, symbol}: {admin: string, payment_asset: string, kwh_price: i128, name: string, symbol: string},
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
    return ContractClient.deploy({admin, payment_asset, kwh_price, name, symbol}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAtQWRkcmVzcyB0aGF0IG1heSBtaW50IGtXaCBjcmVkaXRzIChFbmVyZ3lGaSkuAAAAAAAABUFkbWluAAAAAAAAAAAAAEJQcmljZSBvZiBvbmUga1doIGluIHN0cm9vcHMgb2YgdGhlIHBheW1lbnQgYXNzZXQgKGUuZy4gVVNEQy9FVVJDKS4AAAAAAAhLd2hQcmljZQAAAAAAAABLUGF5bWVudCBhc3NldCBhY2NlcHRlZCBmb3IgY3JlZGl0IHB1cmNoYXNlcyAoZS5nLiBVU0RDL0VVUkMgdG9rZW4gYWRkcmVzcykuAAAAAAxQYXltZW50QXNzZXQAAAAAAAAAG05hbWUgb2YgdGhlIGNyZWRpdCBwcm9kdWN0LgAAAAAETmFtZQAAAAAAAAAdU3ltYm9sIG9mIHRoZSBjcmVkaXQgcHJvZHVjdC4AAAAAAAAGU3ltYm9sAAAAAAABAAAAJ1Blci1hY2NvdW50IGNyZWRpdCBiYWxhbmNlIGJvb2trZWVwaW5nLgAAAAAGQ3JlZGl0AAAAAAABAAAAEw==",
        "AAAABQAAAAAAAAAAAAAADENyZWRpdEJvdWdodAAAAAIAAAAGY3JlZGl0AAAAAAADYnV5AAAAAAMAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAAAAAAAA2t3aAAAAAALAAAAAAAAAAAAAAAEY29zdAAAAAsAAAAAAAAAAg==",
        "AAAAAQAAAAAAAAAAAAAADUNyZWRpdEJhbGFuY2UAAAAAAAADAAAAAAAAAANrd2gAAAAACwAAADhUb3RhbCBjcmVkaXRzIGNvbnN1bWVkIG92ZXIgdGhlIGxpZmV0aW1lIG9mIHRoZSBhY2NvdW50LgAAAA50b3RhbF9jb25zdW1lZAAAAAAACwAAADlUb3RhbCBjcmVkaXRzIHB1cmNoYXNlZCBvdmVyIHRoZSBsaWZldGltZSBvZiB0aGUgYWNjb3VudC4AAAAAAAAPdG90YWxfcHVyY2hhc2VkAAAAAAs=",
        "AAAAAAAAAAAAAAAFcHJpY2UAAAAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAADtTZXQgdGhlIHByaWNlIG9mIG9uZSBrV2ggaW4gdGhlIHBheW1lbnQgYXNzZXQgKGFkbWluIG9ubHkpLgAAAAAJc2V0X3ByaWNlAAAAAAAAAQAAAAAAAAAJa3doX3ByaWNlAAAAAAAACwAAAAA=",
        "AAAAAAAAAIpCdXkgcHJlcGFpZCBlbmVyZ3kgY3JlZGl0cy4gYGJ1eWVyYCBwYXlzIGBrd2ggKiBwcmljZWAgaW4gdGhlIHBheW1lbnQKYXNzZXQsIHdoaWNoIGlzIGhlbGQgYnkgdGhpcyBjb250cmFjdCwgYW5kIHJlY2VpdmVzIGBrd2hgIG9mIGNyZWRpdC4AAAAAAAtidXlfY3JlZGl0cwAAAAACAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAAA2t3aAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAALZ2V0X2JhbGFuY2UAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAB9AAAAANQ3JlZGl0QmFsYW5jZQAAAA==",
        "AAAAAAAAAJhJbml0aWFsaXplIHRoZSBjb250cmFjdC4gYGFkbWluYCBpcyB0aGUgb25seSBhY2NvdW50IGFsbG93ZWQgdG8gc2V0CnRoZSBwcmljZS4gYHBheW1lbnRfYXNzZXRgIGlzIHRoZSBhc3NldCB1c2VycyBwYXkgd2l0aAooVVNEQyBvciBFVVJDIHRva2VuIGFkZHJlc3MpLgAAAA1fX2NvbnN0cnVjdG9yAAAAAAAABQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAA1wYXltZW50X2Fzc2V0AAAAAAAAEwAAAAAAAAAJa3doX3ByaWNlAAAAAAAACwAAAAAAAAAEbmFtZQAAABAAAAAAAAAABnN5bWJvbAAAAAAAEAAAAAA=",
        "AAAAAAAAAAAAAAANcGF5bWVudF9hc3NldAAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAAHFDb25zdW1lIGBrd2hgIG9mIGVuZXJneSBjcmVkaXQgKGNhbGxlZCBieSBFbmVyZ3lGaSB3aGVuIGEgdXNlciBwYXlzIGFuCmVuZXJneSBiaWxsIG9yIHVzZXMgdGhlIGdyaWQpLiBBZG1pbiBvbmx5LgAAAAAAAA9jb25zdW1lX2NyZWRpdHMAAAAAAgAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAANrd2gAAAAACwAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    price: this.txFromJSON<i128>,
        version: this.txFromJSON<u32>,
        set_price: this.txFromJSON<null>,
        buy_credits: this.txFromJSON<null>,
        get_balance: this.txFromJSON<CreditBalance>,
        payment_asset: this.txFromJSON<string>,
        consume_credits: this.txFromJSON<null>
  }
}