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
    contractId: "CBURYW3CWH7L3R3RUADXCRNOQIOSKJEGDTBT5PPLS3ZMHKXCXDYFABAE",
  }
} as const

export type DataKey = {tag: "Admin", values: void} | {tag: "UsdcAsset", values: void} | {tag: "EurcAsset", values: void} | {tag: "Reward", values: void} | {tag: "Referrer", values: readonly [string]} | {tag: "Referees", values: readonly [string]} | {tag: "Currency", values: readonly [string]} | {tag: "Confirmed", values: readonly [string]} | {tag: "Claimed", values: readonly [string, string, string]};





export interface Client {
  /**
   * Construct and simulate a reward transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  reward: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a claimed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claimed: ({referrer, referee, currency}: {referrer: string, referee: string, currency: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a referees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  referees: ({referrer}: {referrer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Links a neighbour's wallet address to the caller's. No payout yet: the
   * invite stays pending until the referee confirms app usage and the
   * reward is claimed (both sides then get `reward` in the chosen
   * currency).
   * 
   * Guards: no self-referrals, one referee per wallet (first referrer
   * wins), max `MAX_REFERRALS` referees per referrer.
   */
  register: ({referrer, referee, currency}: {referrer: string, referee: string, currency: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a confirmed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  confirmed: ({referee}: {referee: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a eurc_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  eurc_asset: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a usdc_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  usdc_asset: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a currency_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  currency_of: ({referee}: {referee: string}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a referrer_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  referrer_of: ({referee}: {referee: string}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a confirm_usage transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The referee's own wallet confirms that they are actively using the app.
   * This is the anti-farming gate: an invite earns nothing until the
   * referee signs this. Only a wallet that has been invited can confirm.
   */
  confirm_usage: ({referee}: {referee: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a max_referrals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  max_referrals: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a claim_referral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pays `reward` to BOTH the referrer and the referee — but only once the
   * referee has confirmed app usage. Anyone may call (the app does it for
   * either side); the payout is idempotent per (referrer, referee,
   * currency). The whole call reverts if the chosen currency pool is
   * underfunded.
   */
  claim_referral: ({referrer, referee, currency}: {referrer: string, referee: string, currency: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a referrer_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  referrer_count: ({referrer}: {referrer: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, usdc_asset, eurc_asset, reward}: {admin: string, usdc_asset: string, eurc_asset: string, reward: i128},
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
    return ContractClient.deploy({admin, usdc_asset, eurc_asset, reward}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAJVXNkY0Fzc2V0AAAAAAAAAAAAAAAAAAAJRXVyY0Fzc2V0AAAAAAAAAAAAAAAAAAAGUmV3YXJkAAAAAAABAAAAOXJlZmVyZWUgLT4gcmVmZXJyZXIgKGEgd2FsbGV0IGNhbiBvbmx5IGJlIHJlZmVycmVkIG9uY2UpLgAAAAAAAAhSZWZlcnJlcgAAAAEAAAATAAAAAQAAACpyZWZlcnJlciAtPiBsaXN0IG9mIHJlZmVyZWVzIHRoZXkgaW52aXRlZC4AAAAAAAhSZWZlcmVlcwAAAAEAAAATAAAAAQAAAEByZWZlcmVlIC0+IGN1cnJlbmN5IG9mIHRoZWlyIHBlbmRpbmcgaW52aXRlIChmaXJzdCBpbnZpdGUgd2lucykuAAAACEN1cnJlbmN5AAAAAQAAABMAAAABAAAAiHJlZmVyZWUgLT4gdXNhZ2UgY29uZmlybWVkIGJ5IHRoZSByZWZlcmVlJ3Mgb3duIHdhbGxldCAoYW50aS1mYXJtaW5nCmdhdGU6IHJld2FyZHMgb25seSB1bmxvY2sgYWZ0ZXIgdGhlIHJlZmVyZWUgYWN0dWFsbHkgdXNlcyB0aGUgYXBwKS4AAAAJQ29uZmlybWVkAAAAAAAAAQAAABMAAAABAAAANShyZWZlcnJlciwgcmVmZXJlZSwgY3VycmVuY3kpIC0+IHBheW91dCBhbHJlYWR5IG1hZGUuAAAAAAAAB0NsYWltZWQAAAAAAwAAABMAAAATAAAAEQ==",
        "AAAABQAAAAAAAAAAAAAAC1JlZmVyZWVQYWlkAAAAAAIAAAAIcmVmZXJyYWwAAAAMcGFpZF9yZWZlcmVlAAAABAAAAAAAAAAHcmVmZXJlZQAAAAATAAAAAAAAAAAAAAAIcmVmZXJyZXIAAAATAAAAAAAAAAAAAAAIY3VycmVuY3kAAAARAAAAAAAAAAAAAAAGcmV3YXJkAAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADFJlZmVycmVyUGFpZAAAAAIAAAAIcmVmZXJyYWwAAAANcGFpZF9yZWZlcnJlcgAAAAAAAAQAAAAAAAAACHJlZmVycmVyAAAAEwAAAAAAAAAAAAAAB3JlZmVyZWUAAAAAEwAAAAAAAAAAAAAACGN1cnJlbmN5AAAAEQAAAAAAAAAAAAAABnJld2FyZAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADlJlZmVycmFsSm9pbmVkAAAAAAACAAAACHJlZmVycmFsAAAABmpvaW5lZAAAAAAAAgAAAAAAAAAIcmVmZXJyZXIAAAATAAAAAAAAAAAAAAAHcmVmZXJlZQAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADlVzYWdlQ29uZmlybWVkAAAAAAACAAAACHJlZmVycmFsAAAAD3VzYWdlX2NvbmZpcm1lZAAAAAABAAAAAAAAAAdyZWZlcmVlAAAAABMAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAGcmV3YXJkAAAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAHY2xhaW1lZAAAAAADAAAAAAAAAAhyZWZlcnJlcgAAABMAAAAAAAAAB3JlZmVyZWUAAAAAEwAAAAAAAAAIY3VycmVuY3kAAAARAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAIcmVmZXJlZXMAAAABAAAAAAAAAAhyZWZlcnJlcgAAABMAAAABAAAD6gAAABM=",
        "AAAAAAAAAUZMaW5rcyBhIG5laWdoYm91cidzIHdhbGxldCBhZGRyZXNzIHRvIHRoZSBjYWxsZXIncy4gTm8gcGF5b3V0IHlldDogdGhlCmludml0ZSBzdGF5cyBwZW5kaW5nIHVudGlsIHRoZSByZWZlcmVlIGNvbmZpcm1zIGFwcCB1c2FnZSBhbmQgdGhlCnJld2FyZCBpcyBjbGFpbWVkIChib3RoIHNpZGVzIHRoZW4gZ2V0IGByZXdhcmRgIGluIHRoZSBjaG9zZW4KY3VycmVuY3kpLgoKR3VhcmRzOiBubyBzZWxmLXJlZmVycmFscywgb25lIHJlZmVyZWUgcGVyIHdhbGxldCAoZmlyc3QgcmVmZXJyZXIKd2lucyksIG1heCBgTUFYX1JFRkVSUkFMU2AgcmVmZXJlZXMgcGVyIHJlZmVycmVyLgAAAAAACHJlZ2lzdGVyAAAAAwAAAAAAAAAIcmVmZXJyZXIAAAATAAAAAAAAAAdyZWZlcmVlAAAAABMAAAAAAAAACGN1cnJlbmN5AAAAEQAAAAA=",
        "AAAAAAAAAAAAAAAJY29uZmlybWVkAAAAAAAAAQAAAAAAAAAHcmVmZXJlZQAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAKZXVyY19hc3NldAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAKdXNkY19hc3NldAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAALY3VycmVuY3lfb2YAAAAAAQAAAAAAAAAHcmVmZXJlZQAAAAATAAAAAQAAABE=",
        "AAAAAAAAAAAAAAALcmVmZXJyZXJfb2YAAAAAAQAAAAAAAAAHcmVmZXJlZQAAAAATAAAAAQAAABM=",
        "AAAAAAAAAPlJbml0aWFsaXplLiBgdXNkY19hc3NldGAvYGV1cmNfYXNzZXRgIGFyZSB0aGUgU3RlbGxhciBBc3NldCBDb250cmFjdHMgdGhlCnJld2FyZHMgYXJlIHBhaWQgZnJvbTsgYHJld2FyZGAgaXMgdGhlIHBlci1yZWZlcnJhbCBhbW91bnQgaW4gc3Ryb29wcwooMC4wMDAxIFVTREMvRVVSQyA9IDFfMDAwIHN0cm9vcHMpLiBUaGUgYWRtaW4gZnVuZHMgYm90aCBwb29scyBieQp0cmFuc2ZlcnJpbmcgdG9rZW5zIGludG8gdGhpcyBjb250cmFjdC4AAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKdXNkY19hc3NldAAAAAAAEwAAAAAAAAAKZXVyY19hc3NldAAAAAAAEwAAAAAAAAAGcmV3YXJkAAAAAAALAAAAAA==",
        "AAAAAAAAAM1UaGUgcmVmZXJlZSdzIG93biB3YWxsZXQgY29uZmlybXMgdGhhdCB0aGV5IGFyZSBhY3RpdmVseSB1c2luZyB0aGUgYXBwLgpUaGlzIGlzIHRoZSBhbnRpLWZhcm1pbmcgZ2F0ZTogYW4gaW52aXRlIGVhcm5zIG5vdGhpbmcgdW50aWwgdGhlCnJlZmVyZWUgc2lnbnMgdGhpcy4gT25seSBhIHdhbGxldCB0aGF0IGhhcyBiZWVuIGludml0ZWQgY2FuIGNvbmZpcm0uAAAAAAAADWNvbmZpcm1fdXNhZ2UAAAAAAAABAAAAAAAAAAdyZWZlcmVlAAAAABMAAAAA",
        "AAAAAAAAAAAAAAANbWF4X3JlZmVycmFscwAAAAAAAAAAAAABAAAABA==",
        "AAAAAAAAARtQYXlzIGByZXdhcmRgIHRvIEJPVEggdGhlIHJlZmVycmVyIGFuZCB0aGUgcmVmZXJlZSDigJQgYnV0IG9ubHkgb25jZSB0aGUKcmVmZXJlZSBoYXMgY29uZmlybWVkIGFwcCB1c2FnZS4gQW55b25lIG1heSBjYWxsICh0aGUgYXBwIGRvZXMgaXQgZm9yCmVpdGhlciBzaWRlKTsgdGhlIHBheW91dCBpcyBpZGVtcG90ZW50IHBlciAocmVmZXJyZXIsIHJlZmVyZWUsCmN1cnJlbmN5KS4gVGhlIHdob2xlIGNhbGwgcmV2ZXJ0cyBpZiB0aGUgY2hvc2VuIGN1cnJlbmN5IHBvb2wgaXMKdW5kZXJmdW5kZWQuAAAAAA5jbGFpbV9yZWZlcnJhbAAAAAAAAwAAAAAAAAAIcmVmZXJyZXIAAAATAAAAAAAAAAdyZWZlcmVlAAAAABMAAAAAAAAACGN1cnJlbmN5AAAAEQAAAAA=",
        "AAAAAAAAAAAAAAAOcmVmZXJyZXJfY291bnQAAAAAAAEAAAAAAAAACHJlZmVycmVyAAAAEwAAAAEAAAAE" ]),
      options
    )
  }
  public readonly fromJSON = {
    reward: this.txFromJSON<i128>,
        claimed: this.txFromJSON<boolean>,
        version: this.txFromJSON<u32>,
        referees: this.txFromJSON<Array<string>>,
        register: this.txFromJSON<null>,
        confirmed: this.txFromJSON<boolean>,
        eurc_asset: this.txFromJSON<string>,
        usdc_asset: this.txFromJSON<string>,
        currency_of: this.txFromJSON<string>,
        referrer_of: this.txFromJSON<string>,
        confirm_usage: this.txFromJSON<null>,
        max_referrals: this.txFromJSON<u32>,
        claim_referral: this.txFromJSON<null>,
        referrer_count: this.txFromJSON<u32>
  }
}