/**
 * On-chain savings-pool activity (deposits, dividend claims, routed interest)
 * read from Soroban contract events. Horizon never exposes these: an `invest`
 * is an `invoke_host_function`, so the payment feeds can't see it. The project
 * contract emits `project/invest`, `project/dividend` and `project/revenue`
 * events — we decode those here. Since v5, the installments contract routes
 * the interest of every loan repayment into the pool, so `revenue` events are
 * the saver's real income stream.
 *
 * Event shape (soroban-sdk `#[contractevent]` derive):
 *   topics: [Symbol("project"), Symbol("invest"|"dividend"|"revenue")]
 *   value:  map { investor?: Address, amount|shares|payout: i128 }
 */
import { xdr, StrKey } from "@stellar/stellar-sdk";
import { NETWORK, CONTRACTS } from "./config";
import { cachedRead } from "./cache";
import { fromStroops, getProjectClient } from "./contracts";

export type PoolActivityRecord = {
  /** Stable unique id for list keys / links. */
  id: string;
  kind: "deposit" | "dividend" | "interest" | "withdraw" | "fee" | "disbursed" | "late" | "defaulted" | "default_cleared";
  amountUsd: string;
  createdAt: string;
  txHash: string;
};

type RawEvent = {
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  topic: string[];
  value: string;
};

/** Ledger windows (recent → deep) searched for the wallet's events. */
const WINDOWS = [2_000, 100_000, 250_000];

async function rpcCall(
  method: string,
  params: unknown,
): Promise<{ sequence?: number; events?: RawEvent[] }> {
  const res = await fetch(NETWORK.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed (${res.status})`);
  const json = (await res.json()) as {
    error?: { message?: string };
    result?: { sequence?: number; events?: RawEvent[] };
  };
  if (json.error) throw new Error(json.error.message ?? `RPC ${method} failed`);
  return json.result ?? {};
}

function scv(b64: string): xdr.ScVal {
  return xdr.ScVal.fromXDR(b64, "base64");
}

function symOf(s: xdr.ScVal): string | null {
  try {
    return s.switch().name === "scvSymbol" ? s.sym().toString() : null;
  } catch {
    return null;
  }
}

function i128Of(s: xdr.ScVal): bigint | null {
  try {
    const i = s.i128();
    return (i.hi().toBigInt() << 64n) | i.lo().toBigInt();
  } catch {
    return null;
  }
}

function addressOf(s: xdr.ScVal): string | null {
  try {
    const a = s.address();
    return a.switch().name === "scAddressTypeAccount"
      ? StrKey.encodeEd25519PublicKey(a.accountId().ed25519())
      : null;
  } catch {
    return null;
  }
}

/**
 * Decode a raw RPC event. `revenue` events are pool-wide (no investor field):
 * they carry `investor: null` and are prorated to the wallet's share of the
 * pool by the caller.
 */
function parsePoolEvent(
  ev: RawEvent,
): { kind: "deposit" | "dividend" | "interest"; investor: string | null; amount: bigint } | null {
  if (!ev.topic || ev.topic.length < 2) return null;
  const t0 = symOf(scv(ev.topic[0]));
  const t1 = symOf(scv(ev.topic[1]));
  if (t0 !== "project" || (t1 !== "invest" && t1 !== "dividend" && t1 !== "revenue")) return null;
  let investor: string | null = null;
  let amount: bigint | null = null;
  try {
    const map = scv(ev.value).map();
    if (map) {
      for (const entry of map) {
        const k = entry.key().sym();
        if (k === "investor") investor = addressOf(entry.val());
        else if (k === "amount" || k === "payout") amount = i128Of(entry.val());
      }
    }
  } catch {
    return null;
  }
  if (amount === null) return null;
  if (t1 === "revenue") return { kind: "interest", investor: null, amount };
  if (!investor) return null;
  return { kind: t1 === "invest" ? "deposit" : "dividend", investor, amount };
}

/** Deposits + dividend claims + routed interest for `publicKey`, newest first. */
export function getPoolActivity(publicKey: string): Promise<PoolActivityRecord[]> {
  return cachedRead(`poolActivity:${publicKey}`, 25_000, async () => {
    const [latest, investorRes, soldRes] = await Promise.all([
      rpcCall("getLatestLedger", {}).then((r) => r.sequence ?? 0),
      cachedRead(`project:investor:${publicKey}`, 12_000, () =>
        getProjectClient(publicKey).get_investor({ investor: publicKey }),
      ),
      cachedRead(`project:sold`, 30_000, () => getProjectClient(publicKey).total_sold()),
    ]);
    if (latest <= 0) return [];
    const shares = BigInt((investorRes.result as unknown as { shares: bigint }).shares ?? 0n);
    const totalSold = BigInt(soldRes.result as bigint);
    for (const w of WINDOWS) {
      const res = await rpcCall("getEvents", {
        startLedger: latest - w,
        filters: [{ type: "contract", contractIds: [CONTRACTS.project] }],
      });
      const events = res.events ?? [];
      // NOTE: never `break` on an empty window — an empty recent window only
      // means the pool was quiet; the wallet's events may live deeper.
      if (events.length === 0) continue;
      const rows: PoolActivityRecord[] = [];
      for (const ev of events) {
        const p = parsePoolEvent(ev);
        if (!p) continue;
        if (p.kind === "interest") {
          // Revenue events are pool-wide: show the wallet's prorated share
          // (shares are static — there are no withdrawals — so the split is
          // exact modulo rounding).
          if (shares === 0n || totalSold === 0n) continue;
          const myShare = (p.amount * shares) / totalSold;
          if (myShare <= 0n) continue;
          rows.push({
            id: `pool:${ev.txHash}:interest`,
            kind: "interest",
            amountUsd: fromStroops(myShare),
            createdAt: ev.ledgerClosedAt ?? new Date().toISOString(),
            txHash: ev.txHash,
          });
        } else {
          if (p.investor !== publicKey) continue;
          rows.push({
            id: `pool:${ev.txHash}:${p.kind}`,
            kind: p.kind,
            amountUsd: fromStroops(p.amount),
            createdAt: ev.ledgerClosedAt ?? new Date().toISOString(),
            txHash: ev.txHash,
          });
        }
      }
      if (rows.length > 0) return rows.reverse();
    }
    return [];
  });
}

/** Decode an installments-contract event for the feed. */
function parseInstallmentsEvent(
  ev: RawEvent,
): { kind: PoolActivityRecord["kind"]; address: string; amount: bigint } | null {
  if (!ev.topic || ev.topic.length < 2) return null;
  const t0 = symOf(scv(ev.topic[0]));
  const t1 = symOf(scv(ev.topic[1]));
  if (t0 === "project") {
    // Interest routed from installments -> pool (same-transaction transfer).
    if (t1 !== "revenue") return null;
    const map = scv(ev.value).map();
    let amount: bigint | null = null;
    if (map) {
      for (const entry of map) {
        if (entry.key().sym() === "amount") amount = i128Of(entry.val());
      }
    }
    return amount === null ? null : { kind: "interest", address: "", amount };
  }
  // installments-contract events carry topics
  // ["product"|"loan"|"admin", <event name>].
  if (t0 !== "product" && t0 !== "loan" && t0 !== "admin") return null;
  const map = scv(ev.value).map();
  let address = "";
  let amount = 0n;
  if (map) {
    for (const entry of map) {
      const k = entry.key().sym();
      if (k === "provider" || k === "buyer" || k === "admin") address = addressOf(entry.val()) ?? "";
      else if (k === "payout" || k === "amount" || k === "principal") amount = i128Of(entry.val()) ?? 0n;
    }
  }
  const kinds: Record<string, PoolActivityRecord["kind"]> = {
    withdraw: "withdraw",
    fees_claimed: "fee",
    disbursed: "disbursed",
    late: "late",
    defaulted: "defaulted",
    default_cleared: "default_cleared",
  };
  if (t1 === null) return null;
  const kind = kinds[t1];
  return kind ? { kind, address, amount } : null;
}

/**
 * Platform + loan lifecycle activity from the installments contract
 * (provider withdrawals, fee claims, disbursals, late/default flags) —
 * events Horizon never exposes. Returns rows for events touching
 * `publicKey` (as provider, buyer, or admin), newest first.
 */
export function getInstallmentsActivity(publicKey: string): Promise<PoolActivityRecord[]> {
  return cachedRead(`installmentsActivity:${publicKey}`, 25_000, async () => {
    const latest = await rpcCall("getLatestLedger", {}).then((r) => r.sequence ?? 0);
    if (latest <= 0) return [];
    for (const w of WINDOWS) {
      const res = await rpcCall("getEvents", {
        startLedger: latest - w,
        filters: [{ type: "contract", contractIds: [CONTRACTS.installments, CONTRACTS.project] }],
      });
      const events = res.events ?? [];
      if (events.length === 0) continue;
      const rows: PoolActivityRecord[] = [];
      for (const ev of events) {
        const p = parseInstallmentsEvent(ev);
        if (!p) continue;
        // Pool-wide revenue rows are handled by getPoolActivity; here only
        // events naming this wallet count.
        if (p.kind === "interest") continue;
        if (p.address !== publicKey) continue;
        const labels: Record<PoolActivityRecord["kind"], { label: string; usd: string }> = {
          withdraw: { label: "Provider withdrawal", usd: fromStroops(p.amount) },
          fee: { label: "Platform fee claimed", usd: fromStroops(p.amount) },
          disbursed: { label: "Loan disbursed", usd: fromStroops(p.amount) },
          late: { label: "Loan marked late", usd: "" },
          defaulted: { label: "Loan defaulted", usd: "" },
          default_cleared: { label: "Default cleared", usd: "" },
          deposit: { label: "", usd: "" },
          dividend: { label: "", usd: "" },
          interest: { label: "", usd: "" },
        };
        rows.push({
          id: `inst:${ev.txHash}:${p.kind}`,
          kind: p.kind,
          amountUsd: labels[p.kind].usd,
          createdAt: ev.ledgerClosedAt ?? new Date().toISOString(),
          txHash: ev.txHash,
        });
      }
      if (rows.length > 0) return rows.reverse();
    }
    return [];
  });
}
