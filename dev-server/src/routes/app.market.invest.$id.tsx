import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useInvestorState } from "@/lib/energyfi/hooks";
import { PiggyBank, AlertTriangle, Loader2 } from "lucide-react";
import { PROJECT } from "@/lib/energyfi/config";

export const Route = createFileRoute("/app/market/invest/$id")({ component: Detail });

function Detail() {
  const { id } = useParams({ from: "/app/market/invest/$id" });
  const { address } = useWallet();
  const { projectStats, loading } = useInvestorState(address);

  const sharePrice = Number(projectStats?.sharePriceUsd ?? "10");
  const totalSold = Number(projectStats?.totalSold ?? "0");
  const totalRaised = Number(projectStats?.totalRaisedUsd ?? "0");
  const funded = Math.min(100, Math.round((totalRaised / (1000 * sharePrice)) * 100));

  if (id !== PROJECT.id) {
    return (
      <>
        <ScreenHeader back="/app/market" title="Coming soon" />
        <ScreenBody>
          <div className="rounded-2xl bg-surface hairline p-8 text-center text-sm text-muted-foreground">
            This pool is not open yet. Only <b>{PROJECT.name}</b> is live on Stellar.
          </div>
          <Button as={Link} to="/app/market/invest/$id" params={{ id: PROJECT.id }}>
            View live savings pool
          </Button>
        </ScreenBody>
      </>
    );
  }

  return (
    <>
      <ScreenHeader back="/app/market" title="Savings pool" />
      <ScreenBody>
        <div className="rounded-2xl overflow-hidden hairline h-48 money-gradient grid place-items-center">
          <PiggyBank className="h-24 w-24 text-background/70" />
        </div>
        <Card>
          <div className="text-sm font-semibold font-display">{PROJECT.name}</div>
          <div className="text-xs text-muted-foreground">
            {PROJECT.country} · {PROJECT.capacity}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading on-chain data…
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Deposits", `${totalRaised} USDC`],
                  ["Projected APY", `${PROJECT.yieldPct}%`],
                  ["Pool tokens", `${totalSold}`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                    <div className="text-sm font-semibold tabular">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full money-gradient" style={{ width: `${funded}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Pool deposits {funded}% of the 1,000-token target
              </div>
            </>
          )}
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            How it works
          </div>
          <p className="mt-2 text-sm">
            Your USDC earns interest from neighbourhood loan repayments. Borrowers receive the
            principal and repay in monthly installments; repayments are deposited into the pool and
            paid out pro-rata to savers as interest you can claim anytime. Your principal stays
            locked in the pool — savings are not withdrawable.
          </p>
        </Card>
        <div className="flex items-start gap-3 rounded-xl bg-warning/10 border border-warning/30 p-3.5">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <p className="text-xs">
            Returns are projected, not guaranteed. Your savings grow only if borrowers repay.
          </p>
        </div>
        <Button as={Link} to="/app/market/invest/amount">
          Deposit now
        </Button>
      </ScreenBody>
    </>
  );
}
