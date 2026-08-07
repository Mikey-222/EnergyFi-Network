// React hooks for reading EnergyFi contract state (simulated, read-only).
import { useCallback, useEffect, useState } from "react";
import {
  getCreditClient,
  getInstallmentsClient,
  getProjectClient,
  getReferralClient,
  fromStroops,
} from "@/lib/energyfi/contracts";
import { PRODUCT_CATALOG, PRODUCT_IDS, REFERRAL } from "@/lib/energyfi/config";
import type { LinkProps } from "@tanstack/react-router";
import type { Product, Financing, InvestorState } from "@/lib/energyfi/contracts";
import { getPaymentHistory, type PaymentRecord } from "@/lib/energyfi/tokens";
import { cachedRead } from "@/lib/energyfi/cache";
import { getPoolActivity, getInstallmentsActivity, type PoolActivityRecord } from "@/lib/energyfi/pool-events";

export type CatalogProduct = {
  id: string;
  name: string;
  tag: string;
  img: string;
  category: string;
  active: boolean;
  priceUsd: string;
  monthlyUsd: string;
  months: number;
  depositUsd: string;
  provider: string;
};

export function useCreditBalance(publicKey?: string | null) {
  const [balance, setBalance] = useState<{
    kwh: string;
    totalConsumed: string;
    totalPurchased: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const c = getCreditClient(publicKey);
      const res = await c.get_balance({ account: publicKey });
      const b = res.result as unknown as {
        kwh: bigint;
        total_consumed: bigint;
        total_purchased: bigint;
      };
      setBalance({
        kwh: fromStroops(b.kwh),
        totalConsumed: fromStroops(b.total_consumed),
        totalPurchased: fromStroops(b.total_purchased),
      });
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Failed to load credit balance");
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, error, refresh };
}

export function useCreditPrice(publicKey?: string | null) {
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setPrice(null);
      return;
    }
    setLoading(true);
    try {
      const c = getCreditClient(publicKey);
      const res = await c.price();
      setPrice(fromStroops(res.result as bigint));
    } catch {
      setPrice(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { price, loading, refresh };
}

export type ActiveLoan = {
  productId: string;
  name: string;
  /** Per-installment amount, raw stroops. */
  monthlyStroops: bigint;
  months: number;
  installmentsPaid: number;
  late: number;
  disbursed: boolean;
  /** USDC already paid in, raw stroops. */
  totalPaidStroops: bigint;
  /** Principal still outstanding, raw stroops. */
  outstandingStroops: bigint;
  /** Pay off in full now (remaining installments), raw stroops. */
  payoffStroops: bigint;
  /** UNIX seconds when the financing was started (ledger timestamp). */
  startedAt: number | null;
};

/** The connected wallet's active loans (started, not fully repaid). */
export function useActiveLoans(publicKey?: string | null) {
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setLoans([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const c = getInstallmentsClient(publicKey);
      const rows: ActiveLoan[] = [];
      for (const id of PRODUCT_IDS) {
        try {
          const fRes = await c.get_financing({ buyer: publicKey, product_id: id });
          const fin = fRes.result as unknown as Financing;
          const meta = PRODUCT_CATALOG[id] ?? { name: id, tag: "", img: "kit", category: "Other" };
          const p = (await c.get_product({ product_id: id })).result as unknown as import("@/contracts/installments").Product;
          if (fin.installments_paid >= p.months) continue; // fully repaid
          const remaining = BigInt(p.months) - BigInt(fin.installments_paid);
          rows.push({
            productId: id,
            name: meta.name,
            monthlyStroops: BigInt(p.monthly),
            months: Number(p.months),
            installmentsPaid: fin.installments_paid,
            late: fin.late,
            disbursed: fin.disbursed,
            totalPaidStroops: fin.total_paid,
            outstandingStroops: fin.principal_outstanding,
            payoffStroops: remaining * BigInt(p.monthly),
            startedAt: typeof fin.started_at === "bigint" ? Number(fin.started_at) : fin.started_at ?? null,
          });
        } catch {
          // no financing for this product
        }
      }
      setLoans(rows);
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Failed to load your loans");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loans, loading, error, refresh };
}

export function useProducts(publicKey?: string | null) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setProducts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const c = getInstallmentsClient(publicKey);
      const list: CatalogProduct[] = [];
      for (const id of PRODUCT_IDS) {
        try {
          const res = await c.get_product({ product_id: id });
          const p = res.result as unknown as Product;
          const meta = PRODUCT_CATALOG[id] ?? { name: id, tag: "", img: "kit", category: "Other" };
          list.push({
            id,
            name: meta.name,
            tag: meta.tag,
            img: meta.img,
            category: meta.category,
            active: p.active,
            priceUsd: fromStroops(p.price),
            monthlyUsd: fromStroops(p.monthly),
            months: p.months,
            depositUsd: fromStroops(p.deposit),
            provider: p.provider,
          });
        } catch {
          // product not registered yet
        }
      }
      setProducts(list);
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { products, loading, error, refresh };
}

export function useProduct(publicKey: string | null | undefined, productId: string) {
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setProduct(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const c = getInstallmentsClient(publicKey);
      const res = await c.get_product({ product_id: productId });
      const p = res.result as unknown as Product;
      const meta = PRODUCT_CATALOG[productId] ?? {
        name: productId,
        tag: "",
        img: "kit",
        category: "Other",
      };
      setProduct({
        id: productId,
        name: meta.name,
        tag: meta.tag,
        img: meta.img,
        category: meta.category,
        active: p.active,
        priceUsd: fromStroops(p.price),
        monthlyUsd: fromStroops(p.monthly),
        months: p.months,
        depositUsd: fromStroops(p.deposit),
        provider: p.provider,
      });
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Failed to load product");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey, productId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { product, loading, error, refresh };
}

export function useFinancing(publicKey: string | null | undefined, productId: string) {
  const [financing, setFinancing] = useState<Financing | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setFinancing(null);
      return;
    }
    setLoading(true);
    try {
      const c = getInstallmentsClient(publicKey);
      const res = await c.get_financing({ buyer: publicKey, product_id: productId });
      setFinancing(res.result as unknown as Financing);
    } catch {
      setFinancing(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey, productId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { financing, loading, refresh };
}

export type InvestorView = {
  shares: string;
  investedUsd: string;
  claimedUsd: string;
  claimableUsd: string;
};

export function useInvestorState(publicKey?: string | null) {
  const [investor, setInvestor] = useState<InvestorView | null>(null);
  const [projectStats, setProjectStats] = useState<{
    totalRaisedUsd: string;
    totalSold: string;
    sharePriceUsd: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setInvestor(null);
      setProjectStats(null);
      return;
    }
    setLoading(true);
    try {
      const c = getProjectClient(publicKey);
      const [inv, claim, raised, sold, sp] = await Promise.all([
        cachedRead(`project:investor:${publicKey}`, 12_000, () =>
          c.get_investor({ investor: publicKey }),
        ),
        cachedRead(`project:claimable:${publicKey}`, 12_000, () =>
          c.claimable({ investor: publicKey }),
        ),
        cachedRead(`project:raised`, 30_000, () => c.total_raised()),
        cachedRead(`project:sold`, 30_000, () => c.total_sold()),
        cachedRead(`project:shareprice`, 30_000, () => c.share_price()),
      ]);
      const i = inv.result as unknown as InvestorState;
      setInvestor({
        shares: fromStroops(i.shares),
        investedUsd: fromStroops(i.invested),
        claimedUsd: fromStroops(i.claimed),
        claimableUsd: fromStroops(claim.result as bigint),
      });
      setProjectStats({
        totalRaisedUsd: fromStroops(raised.result as bigint),
        totalSold: fromStroops(sold.result as bigint),
        sharePriceUsd: fromStroops(sp.result as bigint),
      });
    } catch (err) {
      console.error("Failed to load investor state:", err);
      setInvestor(null);
      setProjectStats(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { investor, projectStats, loading, refresh };
}

export type ReferralView = {
  rewardUsd: string;
  maxReferrals: number;
  count: number;
  referees: string[];
  /** address of the referrer who invited me, null if I wasn't invited. */
  myReferrer: string | null;
  /** currency of my pending invite ("USDC" | "EURC"). */
  myCurrency: string | null;
  /** whether my wallet already confirmed app usage. */
  usageConfirmed: boolean;
  /** whether my own invite (myReferrer → me) has been paid out. */
  myInviteClaimed: boolean;
  /** referee address -> payout done (any currency). */
  claimed: Record<string, boolean>;
};

export function useReferralState(publicKey?: string | null) {
  const [referral, setReferral] = useState<ReferralView | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setReferral(null);
      return;
    }
    setLoading(true);
    try {
      const c = getReferralClient(publicKey);
      const [reward, max, count, list, myRef, confirmed] = await Promise.all([
        c.reward(),
        c.max_referrals(),
        c.referrer_count({ referrer: publicKey }),
        c.referees({ referrer: publicKey }),
        c
          .referrer_of({ referee: publicKey })
          .then((r) => r.result)
          .catch(() => null),
        c.confirmed({ referee: publicKey }).then((r) => r.result),
      ]);
      const referees = list.result as unknown as string[];
      const claimedPairs = await Promise.all(
        referees.map(async (r) => {
          const [u, e] = await Promise.all([
            c.claimed({ referrer: publicKey, referee: r, currency: "USDC" }),
            c.claimed({ referrer: publicKey, referee: r, currency: "EURC" }),
          ]);
          return [r, u.result || e.result] as const;
        }),
      );
      let myCurrency: string | null = null;
      let myInviteClaimed = false;
      if (myRef) {
        myCurrency = await c
          .currency_of({ referee: publicKey })
          .then((r) => r.result)
          .catch(() => null);
        if (myCurrency) {
          myInviteClaimed = (
            await c.claimed({
              referrer: myRef,
              referee: publicKey,
              currency: myCurrency,
            })
          ).result;
        }
      }
      setReferral({
        rewardUsd: fromStroops(reward.result as bigint),
        maxReferrals: max.result,
        count: count.result,
        referees,
        myReferrer: myRef,
        myCurrency,
        usageConfirmed: confirmed,
        myInviteClaimed,
        claimed: Object.fromEntries(claimedPairs),
      });
    } catch (err) {
      console.error("Failed to load referral state:", err);
      setReferral(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { referral, loading, refresh };
}

export type AppNotification = {
  id: string;
  icon: "payment" | "loan" | "interest" | "referral" | "promo";
  title: string;
  body: string;
  to: LinkProps["to"];
  search?: { product?: string };
};

export type NotificationGroup = {
  label: string;
  items: AppNotification[];
};

export function useNotifications(publicKey?: string | null) {
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setGroups([]);
      return;
    }
    setLoading(true);
    try {
      const ic = getInstallmentsClient(publicKey);
      const pc = getProjectClient(publicKey);
      const rc = getReferralClient(publicKey);

      const [financings, inv, claim, list, referredBy, history, isDefaultedRes, poolActivity, instActivity] =
        await Promise.all([
          Promise.all(
            PRODUCT_IDS.map(async (id) => {
              try {
                const f = await ic.get_financing({ buyer: publicKey, product_id: id });
                return { fin: f.result as unknown as Financing, productId: id };
              } catch {
                return null;
              }
            }),
          ),
          pc.get_investor({ investor: publicKey }),
          pc.claimable({ investor: publicKey }),
          rc.referees({ referrer: publicKey }),
          rc.referrer_of({ referee: publicKey }).catch(() => null),
          getPaymentHistory(publicKey, 8),
          ic.is_defaulted({ buyer: publicKey }).catch(() => null),
          getPoolActivity(publicKey).catch(() => []),
          getInstallmentsActivity(publicKey).catch(() => []),
        ]);

      const live: AppNotification[] = [];
      const isDefaulted = Boolean(isDefaultedRes?.result);

      if (isDefaulted) {
        live.push({
          id: "loan-defaulted",
          icon: "loan",
          title: "Loan settled as defaulted",
          body: "This wallet is flagged as defaulted — new loans are blocked. Contact the platform admin to review.",
          to: "/app/market",
        });
      }

      for (const f of financings) {
        if (!f || isDefaulted) continue;
        const { fin, productId } = f;
        const meta = PRODUCT_CATALOG[fin.product_id] ?? PRODUCT_CATALOG[productId];
        const label = meta?.name ?? fin.product_id;
        const monthly = meta?.monthlyUsd ?? 0;
        const price = meta?.priceUsd ?? 0;
        const months = 12;
        if (fin.late > 0) {
          live.push({
            id: `loan-late-${fin.product_id}`,
            icon: "loan",
            title: "Loan installment overdue",
            body: `${label}: ${fin.late} installment(s) late · ${monthly} USDC each — repay to keep your pool standing`,
            to: "/app/market/financing/deposit",
            search: { product: fin.product_id },
          });
        } else if (fin.disbursed && fin.installments_paid === 0) {
          live.push({
            id: `loan-disbursed-${fin.product_id}`,
            icon: "loan",
            title: "Loan disbursed to your wallet",
            body: `${price} USDC principal paid · first installment ${monthly} USDC`,
            to: "/app/market/financing/deposit",
            search: { product: fin.product_id },
          });
        } else if (fin.installments_paid < months) {
          live.push({
            id: `loan-due-${fin.product_id}`,
            icon: "loan",
            title: `Installment ${fin.installments_paid + 1}/${months} due`,
            body: `${monthly} USDC for ${label}`,
            to: "/app/market/financing/deposit",
            search: { product: fin.product_id },
          });
        } else {
          live.push({
            id: `loan-done-${fin.product_id}`,
            icon: "loan",
            title: "Loan paid off",
            body: `${label} fully repaid — your interest flows to savers`,
            to: "/app/market",
          });
        }
      }

      const claimable = BigInt(claim.result as bigint);
      if (claimable > 0n) {
        live.push({
          id: "interest-claim",
          icon: "interest",
          title: "Interest ready to claim",
          body: `${fromStroops(claimable)} USDC earned on your savings — claim it anytime`,
          to: "/app/market/portfolio",
        });
      }
      const invested = BigInt((inv.result as unknown as InvestorState).invested);
      const lastKey = `energyfi.lastInvested:${publicKey}`;
      let prevInvested = 0n;
      try {
        prevInvested = BigInt(localStorage.getItem(lastKey) ?? "0");
      } catch {
        // storage unavailable — skip the delta notification
      }
      if (invested > prevInvested) {
        live.push({
          id: "deposit-confirmed",
          icon: "interest",
          title: "Deposit confirmed",
          body: `+${fromStroops(invested - prevInvested)} USDC added to your savings — it's now earning in the pool`,
          to: "/app/market/portfolio",
        });
      }
      try {
        localStorage.setItem(lastKey, invested.toString());
      } catch {
        // storage unavailable — non-critical
      }
      if (invested > 0n) {
        live.push({
          id: "interest-accruing",
          icon: "interest",
          title: "Your savings are earning",
          body: "Interest accrues from neighbourhood loan repayments — check your savings view",
          to: "/app/market/portfolio",
        });
      }

      // Real routed-interest events: a repayment landed and the pool credited
      // this wallet's share of it. `poolActivity` is newest-first.
      const recentInterest = poolActivity.filter(
        (r) => r.kind === "interest" && Date.now() - Date.parse(r.createdAt) < 24 * 60 * 60 * 1000,
      );
      if (recentInterest.length > 0) {
        live.push({
          id: "interest-earned",
          icon: "interest",
          title: "Interest from loan repayment",
          body: `+${recentInterest[0].amountUsd} USDC earned from a neighbourhood repayment — routed straight into the pool`,
          to: "/app/market/portfolio",
        });
      }

      const referred = list.result as unknown as string[];
      if (referred.length > 0) {
        live.push({
          id: "referral-reward",
          icon: "referral",
          title: `Referral rewards · ${referred.length} invite${referred.length > 1 ? "s" : ""}`,
          body: `${REFERRAL.rewardUsd} USDC each — paid to both sides once the neighbour confirms app usage`,
          to: "/app/profile/refer",
        });
      }
      if (referredBy && referredBy.result && referredBy.result !== publicKey) {
        live.push({
          id: "referral-welcome",
          icon: "referral",
          title: "You were invited to EnergyFi",
          body: `Confirm app usage to unlock your ${REFERRAL.rewardUsd} USDC welcome bonus`,
          to: "/app/profile/refer",
        });
      }

      // Platform + loan lifecycle events from the installments contract
      // (fee claims, withdrawals, disbursals, late/default flags).
      for (const r of instActivity.slice(0, 5)) {
        if (Date.now() - Date.parse(r.createdAt) > 7 * 24 * 60 * 60 * 1000) continue;
        const entry: AppNotification = {
          id: `inst-${r.id}`,
          icon: "loan" as const,
          title:
            r.kind === "fee"
              ? "Platform fee claimed"
              : r.kind === "withdraw"
                ? "Provider withdrawal"
                : r.kind === "disbursed"
                  ? "Loan disbursed"
                  : r.kind === "late"
                    ? "Loan marked late"
                    : r.kind === "defaulted"
                      ? "Loan defaulted"
                      : "Default cleared",
          body:
            r.amountUsd
              ? `${r.amountUsd} USDC · ${new Date(r.createdAt).toLocaleDateString()}`
              : new Date(r.createdAt).toLocaleDateString(),
          to: r.kind === "fee" || r.kind === "withdraw" ? "/app/admin" : "/app/market",
        };
        live.push(entry);
      }

      const payments: AppNotification[] = history
        .filter((t) => t.asset === "USDC" || t.asset === "EURC")
        .slice(0, 3)
        .map((t) => ({
          id: `pay-${t.id}`,
          icon: "payment" as const,
          title: t.to === publicKey ? "Payment received" : "Payment sent",
          body: `${t.amount} ${t.asset} · ${new Date(t.createdAt).toLocaleDateString()}`,
          to: "/app/wallet",
        }));

      const offers: AppNotification[] = [
        {
          id: "promo-loans",
          icon: "promo",
          title: "New: neighbourhood loans",
          body: "Borrow from 50 USDC — principal paid straight to your wallet, repay monthly",
          to: "/app/market",
        },
        {
          id: "promo-refer",
          icon: "promo",
          title: "Refer a neighbour",
          body: `You both earn ${REFERRAL.rewardUsd} USDC or EURC once the referee uses the app`,
          to: "/app/profile/refer",
        },
      ];

      const groups: NotificationGroup[] = [];
      if (live.length > 0) groups.push({ label: "Now", items: live });
      if (payments.length > 0) groups.push({ label: "Activity", items: payments });
      groups.push({ label: "Offers", items: offers });
      setGroups(groups);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { groups, loading, refresh };
}

/** Live payment history for a wallet, refetched when the address changes. */
export function usePaymentHistory(publicKey?: string | null, limit = 20) {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!publicKey) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPaymentHistory(publicKey, limit)
      .then((r) => {
        if (!cancelled) setRecords(r);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, limit]);

  return { records, loading };
}

/**
 * Savings-pool activity (deposits + dividend claims) read from on-chain
 * contract events — Horizon can't see these, so they never appear in the
 * regular payment feeds.
 */
export function usePoolActivity(publicKey?: string | null) {
  const [records, setRecords] = useState<PoolActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!publicKey) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPoolActivity(publicKey)
      .then((r) => {
        if (!cancelled) setRecords(r);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  return { records, loading };
}

/**
 * Platform + loan lifecycle activity from the installments contract
 * (provider withdrawals, fee claims, disbursals, late/default flags).
 * Complements `usePoolActivity` — Horizon never exposes these events.
 */
export function useInstallmentsActivity(publicKey?: string | null) {
  const [records, setRecords] = useState<PoolActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!publicKey) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getInstallmentsActivity(publicKey)
      .then((r) => {
        if (!cancelled) setRecords(r);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  return { records, loading };
}

/**
 * Auto-unlocks a pending referral invite for `address` after they complete a
 * real app flow (invest, financing, installment). Fire-and-forget: never
 * blocks or breaks the main action. Requires the referee's own wallet to sign.
 */
export async function confirmReferralUsageIfPending(address: string) {
  try {
    const c = getReferralClient(address);
    const myRef = await c
      .referrer_of({ referee: address })
      .then((r) => r.result)
      .catch(() => null);
    if (!myRef) return;
    const confirmed = await c.confirmed({ referee: address });
    if (confirmed.result) return;
    const tx = await c.confirm_usage({ referee: address });
    await tx.signAndSend();
  } catch {
    // Non-blocking: referral confirmation must never break the main flow.
  }
}
