// Typed Soroban contract clients bound to the connected wallet.
// All amounts are in stroops (1 unit = 1e7 stroops) on-chain; the helper
// functions at the bottom convert to/from human units.
import * as CreditClient from "@/contracts/energy-credit";
import * as InstallmentsClient from "@/contracts/installments";
import * as ProjectClient from "@/contracts/project";
import * as ReferralClient from "@/contracts/referral";
import * as UsdcSacClient from "@/contracts/sac-usdc";
import * as EurcSacClient from "@/contracts/sac-eurc";
import { NETWORK, CONTRACTS, USDC, EURC } from "./config";
import { signTransactionXdr } from "./signer";

export const STROOPS_PER_UNIT = 10_000_000n;

export function toStroops(units: number): bigint {
  return BigInt(Math.round(units * 1e7));
}

export function fromStroops(stroops: bigint | number | string): string {
  const n = BigInt(stroops);
  const whole = n / STROOPS_PER_UNIT;
  const frac = n % STROOPS_PER_UNIT;
  if (frac === 0n) return whole.toString();
  const padded = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole}.${padded}`;
}

type ClientOptions = {
  publicKey: string;
};

function options({ publicKey }: ClientOptions) {
  return {
    ...NETWORK,
    publicKey,
    signTransaction: signTransactionXdr,
  };
}

export function getCreditClient(publicKey: string) {
  return new CreditClient.Client({
    ...options({ publicKey }),
    contractId: CONTRACTS.energyCredit,
  });
}

export function getInstallmentsClient(publicKey: string) {
  return new InstallmentsClient.Client({
    ...options({ publicKey }),
    contractId: CONTRACTS.installments,
  });
}

export function getProjectClient(publicKey: string) {
  return new ProjectClient.Client({
    ...options({ publicKey }),
    contractId: CONTRACTS.project,
  });
}

export function getReferralClient(publicKey: string) {
  return new ReferralClient.Client({
    ...options({ publicKey }),
    contractId: CONTRACTS.referral,
  });
}

export function getUsdcSacClient(publicKey: string) {
  return new UsdcSacClient.Client({
    ...options({ publicKey }),
    contractId: USDC.sac,
  });
}

export function getEurcSacClient(publicKey: string) {
  return new EurcSacClient.Client({
    ...options({ publicKey }),
    contractId: EURC.sac,
  });
}

/** Read a USDC/EURC balance held by any address or contract (stroops). */
export async function getSacBalance(publicKey: string, code: "USDC" | "EURC", id: string) {
  const c = code === "USDC" ? getUsdcSacClient(publicKey) : getEurcSacClient(publicKey);
  const res = await c.balance({ id });
  return res.result as bigint;
}

export type { CreditBalance } from "@/contracts/energy-credit";
export type { Product, Financing } from "@/contracts/installments";
export type { InvestorState } from "@/contracts/project";
