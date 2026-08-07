// Helpers for rendering on-chain payment history cleanly across screens.
import type { PaymentRecord } from "@/lib/energyfi/tokens";
import type { PoolActivityRecord } from "@/lib/energyfi/pool-events";

/** "Today" / "Yesterday" / "Aug 4" group labels. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "2:14 PM" short time for secondary rows. */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "20.0000000" -> "20"; "0.01" stays "0.01". */
export function fmtAmount(amount: string): string {
  return Number(amount).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

/**
 * Drop non-payment operations (contract calls) and rows without amounts so
 * feeds only show meaningful transfers.
 */
export function cleanPayments(records: PaymentRecord[]): PaymentRecord[] {
  return records.filter((t) => t.type === "payment" && t.amount !== "unknown");
}

/** How many operations were filtered out as contract-call noise. */
export function hiddenInvokeCount(records: PaymentRecord[]): number {
  return records.length - cleanPayments(records).length;
}

/**
 * Merge savings-pool activity (deposits, dividend claims) with Horizon
 * payments into one newest-first feed. Pool rows carry type "deposit" or
 * "dividend" so feeds can render them distinctly from regular transfers.
 */
export function mergePoolActivity(
  pool: PoolActivityRecord[],
  payments: PaymentRecord[],
): PaymentRecord[] {
  const rows: PaymentRecord[] = pool.map((p) => ({
    id: p.id,
    type: p.kind,
    amount: p.amountUsd,
    asset: "USDC",
    from: "",
    to: "",
    createdAt: p.createdAt,
    hash: p.txHash,
  }));
  return [...rows, ...payments].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
