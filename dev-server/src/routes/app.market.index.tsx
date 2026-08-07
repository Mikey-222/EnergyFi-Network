import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody } from "@/components/energyfi/ui";
import { useState } from "react";
import { Landmark, Sun, Loader2, Percent, PiggyBank } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { RepayBanner } from "@/components/energyfi/repay-banner";
import { useProducts, useInvestorState } from "@/lib/energyfi/hooks";
import { PROJECT } from "@/lib/energyfi/config";
import { useT } from "@/lib/energyfi/i18n";

export const Route = createFileRoute("/app/market/")({ component: Market });

const icons: Record<string, LucideIcon> = {
  loan: Landmark,
};

function Market() {
  const { address } = useWallet();
  const { translate: tr } = useT(address);
  const { products, loading } = useProducts(address);
  const { investor } = useInvestorState(address);
  const [mode, setMode] = useState<"borrow" | "lend">("borrow");

  return (
    <>
      <ScreenHeader title={tr("market.title")} />
      <ScreenBody>
        <RepayBanner />
        <div className="rounded-full bg-surface hairline p-1 flex">
          {(["borrow", "lend"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 h-10 rounded-full text-sm font-medium capitalize ${mode === m ? "bg-primary text-background" : "text-muted-foreground"}`}
            >
              {m === "borrow" ? tr("market.borrow") : tr("market.lend")}
            </button>
          ))}
        </div>

        {mode === "borrow" ? (
          <>
            <div className="rounded-2xl bg-surface hairline p-4 text-xs text-muted-foreground">
              {tr("market.borrowBlurb")}
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {tr("market.loading")}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {products
                .filter((p) => p.active)
                .map((p) => {
                  const Icon = icons[p.img] ?? Landmark;
                  return (
                    <Link
                      key={p.id}
                      to="/app/market/product/$id"
                      params={{ id: p.id }}
                      className="rounded-2xl bg-surface hairline overflow-hidden hover:bg-surface-2"
                    >
                      <div className="h-28 money-gradient grid place-items-center relative">
                        <Icon className="h-14 w-14 text-background/80" />
                        <div className="absolute top-2 left-2 rounded-full bg-background/40 backdrop-blur px-2 py-0.5 text-[10px]">
                          {p.tag}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground tabular">
                          {p.monthlyUsd} USDC/mo · {p.months} months
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
            {!loading && products.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {tr("market.noLoans")}
              </div>
            )}
          </>
        ) : (
          <>
            <Link
              to="/app/market/portfolio"
              className="block rounded-2xl money-gradient text-background p-4"
            >
              <div className="text-xs opacity-80">Your savings</div>
              <div className="mt-1 text-2xl font-semibold font-display tabular">
                {investor?.investedUsd ?? "0"} USDC
              </div>
              <div className="text-xs opacity-80">
                {investor?.shares ?? "0"} pool tokens ·{" "}
                {investor?.claimableUsd !== "0"
                  ? `${investor?.claimableUsd} USDC interest ready`
                  : "interest accruing"}
              </div>
            </Link>
            <div className="space-y-3">
              <Link
                to="/app/market/invest/$id"
                params={{ id: PROJECT.id }}
                className="block rounded-2xl bg-surface hairline overflow-hidden hover:bg-surface-2"
              >
                <div className="h-24 money-gradient grid place-items-center">
                  <PiggyBank className="h-12 w-12 text-background/70" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{PROJECT.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {PROJECT.country} · {PROJECT.capacity}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Projected APY</div>
                      <div className="text-sm font-semibold text-success tabular">
                        {PROJECT.yieldPct}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Live on Stellar · savings pool</span>
                    <span>1 USDC = 1 pool token</span>
                  </div>
                </div>
              </Link>
              <div className="rounded-2xl bg-surface hairline p-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 mb-1">
                  <Percent className="h-3.5 w-3.5" />
                  How savings work
                </div>
                You deposit USDC into the pool and earn interest when loan repayments are
                distributed as revenue — a projected {PROJECT.yieldPct}% APY. Your principal stays
                locked in the pool; earned interest becomes claimable as it accrues.
              </div>
            </div>
          </>
        )}
      </ScreenBody>
    </>
  );
}
