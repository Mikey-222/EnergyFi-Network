import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button, Field, Input } from "@/components/energyfi/ui";
import { useCallback, useEffect, useState } from "react";
import {
  Landmark,
  Coins,
  PiggyBank,
  Lock,
  RefreshCw,
  Loader2,
  ArrowUpCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import {
  getUsdcSacClient,
  getEurcSacClient,
  getProjectClient,
  getReferralClient,
  getInstallmentsClient,
  getSacBalance,
  fromStroops,
  toStroops,
} from "@/lib/energyfi/contracts";
import { getPaymentHistory, type PaymentRecord } from "@/lib/energyfi/tokens";
import { cleanPayments, dayLabel, hiddenInvokeCount, fmtAmount } from "@/lib/energyfi/activity";
import { getInstallmentsActivity, type PoolActivityRecord } from "@/lib/energyfi/pool-events";
import {
  CONTRACTS,
  ADMIN_ADDRESS,
  PROJECT,
  REFERRAL,
  PRODUCT_IDS,
  PRODUCT_CATALOG,
} from "@/lib/energyfi/config";
import type { Financing } from "@/contracts/installments";

export const Route = createFileRoute("/app/admin")({ component: Admin });

type PoolBalance = { label: string; usdc: string | null; eurc: string | null; hint?: string };

type LoanRow = {
  buyer: string;
  productId: string;
  financing: Financing | null;
  defaulted: boolean;
};

type ProductCorpus = {
  productId: string;
  name: string;
  totalPaid: bigint;
  withdrawn: bigint;
};

function Admin() {
  const { address, formatAddress, explorerLink, balances } = useWallet();
  const [pools, setPools] = useState<PoolBalance[]>([]);
  const [activity, setActivity] = useState<PaymentRecord[]>([]);
  const [instActivity, setInstActivity] = useState<PoolActivityRecord[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [corpora, setCorpora] = useState<ProductCorpus[]>([]);
  const [stats, setStats] = useState<{
    sharePrice: string;
    totalSold: string;
    referrals: string;
    fees: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isAdmin = !!address && address === ADMIN_ADDRESS;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const MONTH_SECONDS = 30 * 24 * 60 * 60;
  /** Next installment due (ms) — each payment pushes the window one month. */
  const nextDueMs = (financing: Financing) =>
    financing.started_at
      ? (Number(financing.started_at) + (financing.installments_paid + 1) * MONTH_SECONDS) * 1000
      : null;

  const countdown = (ms: number | null) => {
    if (!ms) return null;
    const diff = ms - now;
    const abs = Math.abs(Math.floor(diff / 1000));
    const d = Math.floor(abs / 86400);
    const h = Math.floor((abs % 86400) / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const base = `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    return diff >= 0 ? base : `overdue · ${base}`;
  };

  const refresh = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const ic = getInstallmentsClient(address);

    // Pools — SAC balance reads (RPC). Isolated: a failure here must not
    // blank the loan/product sections below.
    try {
      const poolDefs: { label: string; code: "USDC" | "EURC"; id: string; hint: string }[] = [
        {
          label: "Referral rewards · USDC pool",
          code: "USDC",
          id: CONTRACTS.referral,
          hint: `Pays ${REFERRAL.rewardUsd} to both sides once the referee uses the app`,
        },
        {
          label: "Referral rewards · EURC pool",
          code: "EURC",
          id: CONTRACTS.referral,
          hint: "Same reward in EURC",
        },
        {
          label: "Loan escrow (installments)",
          code: "USDC",
          id: CONTRACTS.installments,
          hint: "Funds borrower principals via disburse_loan",
        },
        {
          label: "Savings pool (project)",
          code: "USDC",
          id: CONTRACTS.project,
          hint: "Holds deposits + revenue; pays interest",
        },
      ];
      const settled = await Promise.all(
        poolDefs.map(async (p) => {
          try {
            return {
              label: p.label,
              hint: p.hint,
              usdc:
                p.code === "USDC" ? fromStroops(await getSacBalance(address, "USDC", p.id)) : null,
              eurc:
                p.code === "EURC" ? fromStroops(await getSacBalance(address, "EURC", p.id)) : null,
            };
          } catch {
            return { label: p.label, hint: p.hint, usdc: null, eurc: null };
          }
        }),
      );
      setPools(settled);
    } catch {
      // pools unavailable — keep whatever we had
    }

    // Stats — project/referral/installments views (RPC). Isolated.
    try {
      const pc = getProjectClient(address);
      const rc = getReferralClient(address);
      const [sp, sold, count, fees] = await Promise.all([
        pc.share_price(),
        pc.total_sold(),
        rc.referrer_count({ referrer: address }),
        ic.fees_owed(),
      ]);
      setStats({
        sharePrice: fromStroops(sp.result as bigint),
        totalSold: fromStroops(sold.result as bigint),
        referrals: String(count.result),
        fees: fromStroops(fees.result as bigint),
      });
    } catch {
      // stats unavailable
    }

    // Recent transfers — Horizon-based. Isolated: the WI-FI uplink is known
    // to drop Horizon TLS; that must not blank the loans section.
    try {
      const history = await getPaymentHistory(address, 20);
      setActivity(history);
      setInstActivity(await getInstallmentsActivity(address));
    } catch {
      // activity unavailable
    }

    const rows: LoanRow[] = [];
    try {
      const countRes = await ic.borrower_count();
      const count = Number(countRes.result);
      const buyers = new Map<string, boolean>();
      for (let i = 0; i < Math.min(count, 20); i++) {
        const b = await ic.borrower_at({ index: i });
        const buyer = b.result as string;
        const d = await ic.is_defaulted({ buyer });
        buyers.set(buyer, d.result as boolean);
      }
      for (const [buyer, defaulted] of buyers) {
        for (const id of PRODUCT_IDS) {
          try {
            const f = await ic.get_financing({ buyer, product_id: id });
            rows.push({
              buyer,
              productId: id,
              financing: f.result as unknown as Financing,
              defaulted,
            });
          } catch {
            // no financing for this product
          }
        }
      }
    } catch (err) {
      console.error("failed to load loan rows:", err);
    }
    setLoans(rows);

    const corpusRows: ProductCorpus[] = [];
    for (const id of PRODUCT_IDS) {
      try {
        const p = (await ic.get_product({ product_id: id })).result as unknown as import("@/contracts/installments").Product;
        corpusRows.push({
          productId: id,
          name: PRODUCT_CATALOG[id]?.name ?? id,
          totalPaid: p.total_paid,
          withdrawn: p.withdrawn,
        });
      } catch {
        // product not registered
      }
    }
    setCorpora(corpusRows);
    setLoading(false);
  }, [address, isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const payments = cleanPayments(activity);
  const hiddenInvokes = hiddenInvokeCount(activity);
  const instRows: PaymentRecord[] = instActivity.map((r) => ({
    id: r.id,
    type: r.kind,
    amount: r.amountUsd ?? "",
    asset: "USDC",
    from: "",
    to: "",
    createdAt: r.createdAt,
    hash: r.txHash ?? "",
  }));
  const merged = [...instRows, ...payments].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const visible = showAll ? merged : merged.slice(0, 8);

  const fund = async (key: string, run: () => Promise<unknown>) => {
    setBusy(key);
    setResults((r) => ({ ...r, [key]: "" }));
    try {
      await run();
      setResults((r) => ({ ...r, [key]: "ok" }));
      await refresh();
    } catch (err) {
      setResults((r) => ({
        ...r,
        [key]: (err instanceof Error ? err.message : undefined) ?? "Transaction failed",
      }));
    } finally {
      setBusy(null);
    }
  };

  const runLoanAction = async (
    key: string,
    kind: "disburse" | "late" | "settle" | "clear",
    row: LoanRow,
  ) => {
    if (!address) return;
    const admin = address;
    setBusy(key);
    setResults((r) => ({ ...r, [key]: "" }));
    try {
      const ic = getInstallmentsClient(admin);
      if (kind === "disburse") {
        const tx = await ic.disburse_loan({
          buyer: row.buyer,
          product_id: row.productId,
        });
        await tx.signAndSend();
      } else if (kind === "late") {
        const tx = await ic.mark_late({
          admin,
          buyer: row.buyer,
          product_id: row.productId,
        });
        await tx.signAndSend();
      } else if (kind === "settle") {
        const tx = await ic.settle_default({
          admin,
          buyer: row.buyer,
          product_id: row.productId,
        });
        await tx.signAndSend();
      } else {
        const tx = await ic.clear_default({ admin, buyer: row.buyer });
        await tx.signAndSend();
      }
      setResults((r) => ({ ...r, [key]: "ok" }));
      await refresh();
    } catch (err) {
      setResults((r) => ({
        ...r,
        [key]: (err instanceof Error ? err.message : undefined) ?? "Transaction failed",
      }));
    } finally {
      setBusy(null);
    }
  };

  const runProviderWithdraw = async (productId: string) => {
    if (!address) return;
    const key = `withdraw-${productId}`;
    setBusy(key);
    setResults((r) => ({ ...r, [key]: "" }));
    try {
      const tx = await getInstallmentsClient(address).withdraw({
        provider: address,
        product_id: productId,
      });
      await tx.signAndSend();
      setResults((r) => ({ ...r, [key]: "ok" }));
      await refresh();
    } catch (err) {
      setResults((r) => ({
        ...r,
        [key]: (err instanceof Error ? err.message : undefined) ?? "Transaction failed",
      }));
    } finally {
      setBusy(null);
    }
  };

  const smallBtn =
    "rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed";

  const actions: { key: string; title: string; sac: boolean; to: string; hint: string }[] = [
    {
      key: "ref-usdc",
      title: "Fund referral USDC pool",
      sac: true,
      to: CONTRACTS.referral,
      hint: "1 USDC ≈ 50 referrals",
    },
    {
      key: "ref-eurc",
      title: "Fund referral EURC pool",
      sac: true,
      to: CONTRACTS.referral,
      hint: "1 EURC ≈ 50 referrals",
    },
    {
      key: "escrow",
      title: "Fund loan escrow",
      sac: true,
      to: CONTRACTS.installments,
      hint: "Liquidity for borrower principals",
    },
    {
      key: "revenue",
      title: "Deposit pool revenue",
      sac: false,
      to: CONTRACTS.project,
      hint: "Distributes loan repayments to savers — drives the projected APY",
    },
  ];

  return (
    <>
      <ScreenHeader back="/app/profile" title="Admin console" />
      <ScreenBody>
        {!isAdmin ? (
          <div className="rounded-2xl bg-surface hairline p-8 text-center space-y-3">
            <Lock className="h-10 w-10 text-warning mx-auto" />
            <div className="text-sm font-semibold">Admin only</div>
            <p className="text-xs text-muted-foreground">
              This console is restricted to the platform owner wallet. Your address{" "}
              {address ? (
                <span className="font-mono">{formatAddress(address)}</span>
              ) : (
                "(not connected)"
              )}{" "}
              is not authorised.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading contracts…
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-surface hairline p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Operator wallet</div>
                <div className="text-sm font-medium font-mono truncate">
                  {formatAddress(address)}
                </div>
              </div>
              <button
                onClick={refresh}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {stats && (
                <>
                  <div className="rounded-2xl bg-surface hairline p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Share price</div>
                    <div className="text-lg font-semibold tabular">{stats.sharePrice} USDC</div>
                  </div>
                  <div className="rounded-2xl bg-surface hairline p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Tokens sold</div>
                    <div className="text-lg font-semibold tabular">{stats.totalSold}</div>
                  </div>
                  <div className="rounded-2xl bg-surface hairline p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">My referrals</div>
                    <div className="text-lg font-semibold tabular">{stats.referrals}/5</div>
                  </div>
                  <div className="rounded-2xl bg-surface hairline p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Projected APY</div>
                    <div className="text-lg font-semibold tabular">{PROJECT.yieldPct}%</div>
                  </div>
                  <div className="rounded-2xl bg-surface hairline p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Accrued fees</div>
                    <div className="text-lg font-semibold tabular">{stats.fees} USDC</div>
                  </div>
                </>
              )}
            </div>

            <div className="text-xs uppercase tracking-widest text-muted-foreground px-1">
              Pool balances
            </div>
            <div className="space-y-2">
              {pools.map((p) => (
                <div key={p.label} className="rounded-2xl bg-surface hairline p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {p.label.includes("escrow") ? (
                        <Landmark className="h-4 w-4 text-primary" />
                      ) : p.label.includes("referral") ? (
                        <Coins className="h-4 w-4 text-primary" />
                      ) : (
                        <PiggyBank className="h-4 w-4 text-primary" />
                      )}
                      {p.label}
                    </div>
                    <div className="text-sm font-semibold tabular">
                      {p.usdc ? `${p.usdc} USDC` : ""}
                      {p.usdc && p.eurc ? " · " : ""}
                      {p.eurc ? `${p.eurc} EURC` : ""}
                      {!p.usdc && !p.eurc ? "—" : ""}
                    </div>
                  </div>
                  {p.hint && <div className="mt-1 text-[11px] text-muted-foreground">{p.hint}</div>}
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground px-1">
              Your wallet: {Number(balances?.usdc ?? 0).toFixed(2)} USDC ·{" "}
              {Number(balances?.eurc ?? 0).toFixed(2)} EURC ·{" "}
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Circle faucet
              </a>
            </div>

            <div className="text-xs uppercase tracking-widest text-muted-foreground px-1">
              Fund the platform
            </div>
            <div className="space-y-3">
              {actions.map((a) => (
                <Card key={a.key}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="text-[11px] text-muted-foreground">{a.hint}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="USDC"
                        value={amounts[a.key] ?? ""}
                        onChange={(e) => setAmounts((m) => ({ ...m, [a.key]: e.target.value }))}
                        className="!w-28"
                      />
                    </div>
                  </div>
                  <Button
                    className="mt-3"
                    disabled={busy !== null || !amounts[a.key] || Number(amounts[a.key]) <= 0}
                    onClick={() => {
                      const n = Number(amounts[a.key]);
                      fund(a.key, async () => {
                        if (a.sac) {
                          const c =
                            a.key === "ref-eurc"
                              ? getEurcSacClient(address)
                              : getUsdcSacClient(address);
                          const tx = await c.transfer({
                            from: address,
                            to: a.to,
                            amount: toStroops(n),
                          });
                          await tx.signAndSend();
                        } else {
                          const tx = await getProjectClient(address).deposit_revenue({
                            amount: toStroops(n),
                          });
                          await tx.signAndSend();
                        }
                      });
                    }}
                  >
                    {busy === a.key ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 mr-2" />
                    )}
                    {busy === a.key ? "Funding…" : "Send"}
                  </Button>
                  {results[a.key] === "ok" && (
                    <div className="mt-2 text-xs text-success">Funded — balance updated above.</div>
                  )}
                  {results[a.key] && results[a.key] !== "ok" && (
                    <div className="mt-2 text-xs text-red-300">{results[a.key]}</div>
                  )}
                </Card>
              ))}
            </div>

            <div className="text-xs uppercase tracking-widest text-muted-foreground px-1">
              Loans &amp; defaults
            </div>
            <Card>
              {loans.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No financings yet — borrowers appear here once they start a loan.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {loans.map((row) => {
                    const meta = PRODUCT_CATALOG[row.productId];
                    const key = `loan-${row.buyer}-${row.productId}`;
                    const status = row.defaulted
                      ? { label: "Defaulted", cls: "text-red-400" }
                      : !row.financing
                        ? { label: "Not started", cls: "text-muted-foreground" }
                        : !row.financing.disbursed
                          ? { label: "Started · pending disburse", cls: "text-warning" }
                          : row.financing.late > 0
                            ? {
                                label: `Late · ${row.financing.late} installment${
                                  row.financing.late > 1 ? "s" : ""
                                }`,
                                cls: "text-warning",
                              }
                            : row.financing.installments_paid > 0
                              ? {
                                  label: `Active · ${row.financing.installments_paid}/12 paid`,
                                  cls: "text-success",
                                }
                              : { label: "Disbursed", cls: "text-primary" };
                    return (
                      <div key={key} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{meta?.name ?? row.productId}</div>
                            <a
                              href={explorerLink(row.buyer, "account")}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-muted-foreground font-mono truncate hover:text-primary"
                              title={row.buyer}
                            >
                              {row.buyer}
                              <ExternalLink className="inline h-3 w-3 -mt-0.5 ml-1 opacity-60" />
                            </a>
                          </div>
                          <span className={`shrink-0 text-xs font-semibold ${status.cls}`}>
                            {status.label}
                          </span>
                        </div>
                        {row.financing && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] text-muted-foreground">
                              {fromStroops(row.financing.principal_outstanding)} USDC outstanding
                            </div>
                            {row.financing.started_at &&
                              (() => {
                                const due = nextDueMs(row.financing);
                                const next = row.financing.installments_paid + 1;
                                const overdue = due !== null && now > due;
                                if (row.financing.installments_paid >= 12n)
                                  return (
                                    <div className="text-[11px] text-muted-foreground">
                                      settled · all {row.financing.installments_paid}/12 paid
                                    </div>
                                  );
                                return (
                                  <div
                                    className={`text-[11px] tabular ${
                                      overdue ? "text-red-400 font-medium" : "text-muted-foreground"
                                    }`}
                                  >
                                    {row.financing.disbursed
                                      ? `#${next} due ${countdown(due)}`
                                      : `starts • installment #${next} in ${countdown(due)}`}
                                  </div>
                                );
                              })()}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!row.defaulted && !row.financing.disbursed && (
                                <button
                                  disabled={busy !== null}
                                  onClick={() => runLoanAction(key, "disburse", row)}
                                  className={`${smallBtn} bg-success/15 text-success`}
                                  title="Pays the principal from the loan escrow to the borrower's wallet"
                                >
                                  {busy === key ? "…" : "Disburse"}
                                </button>
                              )}
                              {!row.defaulted && row.financing.disbursed && (
                                <>
                                  <button
                                    disabled={busy !== null}
                                    onClick={() => runLoanAction(key, "late", row)}
                                    className={`${smallBtn} bg-warning/15 text-warning`}
                                  >
                                    {busy === key ? "…" : "Mark late"}
                                  </button>
                                  <button
                                    disabled={busy !== null}
                                    onClick={() => runLoanAction(key, "settle", row)}
                                    className={`${smallBtn} bg-red-400/15 text-red-400`}
                                  >
                                    {busy === key ? "…" : "Settle default"}
                                  </button>
                                </>
                              )}
                              {row.defaulted && (
                                <button
                                  disabled={busy !== null}
                                  onClick={() => runLoanAction(key, "clear", row)}
                                  className={`${smallBtn} bg-primary/15 text-primary`}
                                >
                                  {busy === key ? "…" : "Clear default"}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {results[key] === "ok" && (
                          <div className="text-xs text-success">Done — state updated above.</div>
                        )}
                        {results[key] && results[key] !== "ok" && (
                          <div className="text-xs text-red-300">{results[key]}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="text-xs uppercase tracking-widest text-muted-foreground px-1">
              Provider withdrawals (loan corpus)
            </div>
            <Card>
              {corpora.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No registered loan products found.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {corpora.map((c) => {
                    const settled = c.totalPaid - c.withdrawn;
                    const fee = settled * 1n / 100n;
                    const key = `withdraw-${c.productId}`;
                    return (
                      <div key={key} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground tabular">
                              settled {fromStroops(settled)} USDC · 1% fee {fromStroops(fee)} ·
                              withdrawn {fromStroops(c.withdrawn)}
                            </div>
                          </div>
                          <Button
                            className="!h-9 !w-auto !px-4 !text-xs"
                            disabled={busy !== null || settled <= 0n}
                            onClick={() => runProviderWithdraw(c.productId)}
                          >
                            {busy === key
                              ? "Withdrawing…"
                              : `Withdraw → wallet ${fromStroops(settled - fee)} · fee ${fromStroops(fee)}`}
                          </Button>
                        </div>
                        {results[key] === "ok" && (
                          <div className="text-xs text-success">
                            Withdrawn — 1% fee accrued to the fee pool below.
                          </div>
                        )}
                        {results[key] && results[key] !== "ok" && (
                          <div className="text-xs text-red-300">{results[key]}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="text-xs uppercase tracking-widest text-muted-foreground px-1">
              Platform fees
            </div>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Accrued platform fees</div>
                  <div className="text-[11px] text-muted-foreground">
                    1% withheld from provider withdrawals — claimable to your wallet
                  </div>
                </div>
                <div className="text-sm font-semibold tabular">
                  {stats ? `${stats.fees} USDC` : "—"}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="USDC"
                  value={amounts["claim-fees"] ?? ""}
                  onChange={(e) => setAmounts((m) => ({ ...m, "claim-fees": e.target.value }))}
                  className="!w-28"
                />
                <Button
                  disabled={
                    busy !== null || !amounts["claim-fees"] || Number(amounts["claim-fees"]) <= 0
                  }
                  onClick={() => {
                    const n = Number(amounts["claim-fees"]);
                    fund("claim-fees", async () => {
                      const tx = await getInstallmentsClient(address).claim_fees({
                        admin: address,
                        amount: toStroops(n),
                      });
                      await tx.signAndSend();
                    });
                  }}
                >
                  {busy === "claim-fees" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Banknote className="h-4 w-4 mr-2" />
                  )}
                  {busy === "claim-fees" ? "Claiming…" : "Claim"}
                </Button>
                {stats && Number(stats.fees) > 0 && (
                  <button
                    onClick={() => setAmounts((m) => ({ ...m, "claim-fees": stats.fees }))}
                    className="text-xs text-primary"
                  >
                    Claim all ({stats.fees} USDC)
                  </button>
                )}
              </div>
              {results["claim-fees"] === "ok" && (
                <div className="mt-2 text-xs text-success">Claimed — fees sent to your wallet.</div>
              )}
              {results["claim-fees"] && results["claim-fees"] !== "ok" && (
                <div className="mt-2 text-xs text-red-300">{results["claim-fees"]}</div>
              )}
            </Card>

            <div className="text-xs uppercase tracking-widest text-muted-foreground px-1">
              Recent transfers
            </div>
            <div className="rounded-2xl bg-surface hairline overflow-hidden">
              {merged.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No transfers yet.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {visible.map((t, i) => {
                    const group = dayLabel(t.createdAt);
                    const prevGroup = i > 0 ? dayLabel(visible[i - 1].createdAt) : "";
                    const received = t.to === address;
                    const isInst =
                      t.type === "withdraw" ||
                      t.type === "fee" ||
                      t.type === "disbursed" ||
                      t.type === "late" ||
                      t.type === "defaulted" ||
                      t.type === "default_cleared";
                    const instTitle =
                      t.type === "withdraw"
                        ? "Provider withdrawal"
                        : t.type === "fee"
                          ? "Platform fee claimed"
                          : t.type === "disbursed"
                            ? "Loan disbursed"
                            : t.type === "late"
                              ? "Loan marked late"
                              : t.type === "defaulted"
                                ? "Loan defaulted"
                                : "Default cleared";
                    return (
                      <div key={t.id}>
                        {group !== prevGroup && (
                          <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                            {group}
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                                isInst
                                  ? "bg-primary/15 text-primary"
                                  : received
                                    ? "bg-success/15 text-success"
                                    : "bg-warning/15 text-warning"
                              }`}
                            >
                              {isInst ? (
                                <Banknote className="h-3.5 w-3.5" />
                              ) : received ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium">
                                {isInst ? instTitle : received ? "Received" : "Sent"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {new Date(t.createdAt).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}{" "}
                                · {t.asset}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-sm font-semibold tabular ${
                                isInst ? "" : received ? "text-success" : ""
                              }`}
                            >
                              {isInst
                                ? t.amount
                                  ? `+${fmtAmount(t.amount)} ${t.asset}`
                                  : "—"
                                : received
                                  ? "+"
                                  : "−"}
                              {!isInst && `${fmtAmount(t.amount)} ${t.asset}`}
                            </span>
                            {t.hash && (
                              <a
                                href={explorerLink(t.hash)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {hiddenInvokes > 0 && (
                <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-white/5">
                  {hiddenInvokes} contract call{hiddenInvokes === 1 ? "" : "s"} hidden
                </div>
              )}
              {payments.length > 8 && !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full py-2.5 text-xs font-medium text-primary border-t border-white/5"
                >
                  Show all {payments.length} transfers
                </button>
              )}
            </div>
            <Link to="/app/profile" className="block text-center text-xs text-primary py-2">
              Back to profile
            </Link>
          </>
        )}
      </ScreenBody>
    </>
  );
}
