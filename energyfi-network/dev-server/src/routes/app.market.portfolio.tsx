import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useInvestorState } from "@/lib/energyfi/hooks";
import { getProjectClient } from "@/lib/energyfi/contracts";
import { useState } from "react";
import { PROJECT } from "@/lib/energyfi/config";

export const Route = createFileRoute("/app/market/portfolio")({ component: Portfolio });

function Portfolio() {
  const { address } = useWallet();
  const { investor, projectStats, refresh } = useInvestorState(address);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const claimable = Number(investor?.claimableUsd ?? 0);

  const claim = async () => {
    if (!address) return;
    setStatus("sending");
    setError(null);
    try {
      const c = getProjectClient(address);
      const tx = await c.claim_dividends({ investor: address });
      await tx.signAndSend();
      await refresh();
      setStatus("idle");
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Claim failed");
      setStatus("error");
    }
  };

  return (
    <>
      <ScreenHeader back="/app/market" title="My savings" />
      <ScreenBody>
        <Card className="money-gradient text-background">
          <div className="text-xs opacity-80">Total saved</div>
          <div className="mt-1 text-4xl font-semibold font-display tabular">
            {investor?.investedUsd ?? "0"} <span className="text-lg opacity-80">USDC</span>
          </div>
          <div className="mt-1 text-xs opacity-80">
            {investor?.shares ?? "0"} pool tokens · {investor?.claimedUsd ?? "0"} USDC interest
            earned
          </div>
        </Card>
        {claimable > 0 && (
          <Card className="border border-success/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Claimable interest</div>
                <div className="text-xl font-semibold text-success tabular">
                  {investor?.claimableUsd} USDC
                </div>
              </div>
              <Button
                onClick={claim}
                variant="money"
                disabled={status === "sending"}
                className="!h-10 !px-4"
              >
                {status === "sending" ? "Claiming…" : "Claim"}
              </Button>
            </div>
            {status === "error" && <div className="mt-2 text-xs text-red-300">{error}</div>}
          </Card>
        )}
        <div className="space-y-2">
          <Link
            to="/app/market/invest/$id"
            params={{ id: PROJECT.id }}
            className="block rounded-2xl bg-surface hairline p-4 hover:bg-surface-2"
          >
            <div className="flex justify-between">
              <div>
                <div className="text-sm font-semibold">{PROJECT.name}</div>
                <div className="text-xs text-muted-foreground">
                  {investor?.shares ?? "0"} pool tokens · {investor?.investedUsd ?? "0"} USDC
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular">
                  {projectStats?.sharePriceUsd ?? "10"} USDC/token
                </div>
                <div className="text-xs text-success">{PROJECT.yieldPct}% projected APY</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="px-1 text-[11px] text-muted-foreground">
          Principal is locked in the pool — you can claim earned interest, but savings can't be
          withdrawn.
        </div>
      </ScreenBody>
    </>
  );
}
