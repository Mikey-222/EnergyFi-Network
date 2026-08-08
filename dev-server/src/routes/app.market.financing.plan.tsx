import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { Loader2, PiggyBank } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useProduct, useActiveLoans, useInvestorState } from "@/lib/energyfi/hooks";

export const Route = createFileRoute("/app/market/financing/plan")({
  component: Plan,
  validateSearch: (search: Record<string, unknown>) => ({
    product: typeof search.product === "string" ? search.product : "loan_100",
  }),
});

function Plan() {
  const { address } = useWallet();
  const { product: productId } = useSearch({ from: "/app/market/financing/plan" });
  const { product, loading, error } = useProduct(address, productId);
  const { loans } = useActiveLoans(address);
  const { investor, projectStats } = useInvestorState(address);

  const requiredPledgeUsd = product ? +(+product.priceUsd * 0.25).toFixed(2) : null;
  const savingsUsd =
    investor && projectStats ? +(Number(investor.shares) * Number(projectStats.sharePriceUsd)).toFixed(2) : null;
  const shortfallUsd =
    savingsUsd != null && requiredPledgeUsd != null && savingsUsd < requiredPledgeUsd
      ? +(requiredPledgeUsd - savingsUsd).toFixed(2)
      : null;
  const topUpUsd =
    savingsUsd != null && shortfallUsd != null
      ? +Math.ceil(shortfallUsd).toFixed(2) // pool invests whole shares only (min 1 USDC)
      : null;
  const pledgeMet = savingsUsd != null && requiredPledgeUsd != null && savingsUsd >= requiredPledgeUsd;

  return (
    <>
      <ScreenHeader back="/app/market" title="Loan plan" />
      <ScreenBody>
        {loans.length > 0 && (
          <Card className="border-success/25">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs">
                <span className="font-semibold text-success">
                  {loans.length === 1 ? "1 active loan" : `${loans.length} active loans`}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  — track installments and pay them back here.
                </span>
              </div>
              <Button
                as={Link}
                to="/app/market/financing/repay"
                className="!h-9 shrink-0 !px-3 !text-xs"
              >
                Repay
              </Button>
            </div>
          </Card>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading plan from Stellar…
          </div>
        ) : error || !product ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {error ?? "Loan not found. Connect your wallet and try again."}
          </div>
        ) : (
          <>
            <Card className="text-center">
              <div className="text-xs text-muted-foreground">Monthly installment</div>
              <div className="mt-1 text-4xl font-semibold font-display tabular">
                {product.monthlyUsd} <span className="text-lg text-muted-foreground">USDC</span>
              </div>
              <div className="text-xs text-muted-foreground">
                for {product.months} months · {product.name}
              </div>
            </Card>
            {requiredPledgeUsd != null && (
              <Card
                className={pledgeMet ? "border-success/25" : "border-warning/25"}
              >
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  Savings pledge required
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pledge needed (25%)</span>
                  <span className="tabular font-medium">{requiredPledgeUsd} USDC</span>
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-muted-foreground">Your pool savings</span>
                  <span className="tabular font-medium">
                    {savingsUsd != null ? `${savingsUsd} USDC` : "—"}
                  </span>
                </div>
                {!address ? (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Connect your wallet to check how much you already have saved.
                  </p>
                ) : pledgeMet ? (
                  <p className="mt-3 text-[11px] text-success">
                    Your savings cover the pledge — you're eligible for this loan.
                  </p>
                ) : shortfallUsd != null && shortfallUsd > 0 ? (
                  <div className="mt-3 rounded-xl bg-warning/10 border border-warning/25 p-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      Loans are capped at 4x your savings in the pool — a 25% pledge. Save{" "}
                      <span className="text-warning font-semibold">
                        {topUpUsd != null ? `${topUpUsd} USDC` : `${shortfallUsd} USDC`}
                      </span>{" "}
                      more to qualify (pool savings are held in whole shares).
                    </p>
                    <Button
                      as={Link}
                      to="/app/market/invest/$id"
                      params={{ id: "neighbourhood-pool" }}
                      className="!h-9 mt-2 w-full !text-xs"
                    >
                      <PiggyBank className="h-3.5 w-3.5" /> Save in the pool
                    </Button>
                  </div>
                ) : null}
              </Card>
            )}
            <Card>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Principal to your wallet</span>
                <span className="tabular font-medium">{product.priceUsd} USDC</span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-muted-foreground">Deposit</span>
                <span className="tabular font-medium">None</span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-muted-foreground">Total repayment</span>
                <span className="tabular font-medium">
                  {product.months} × {product.monthlyUsd} USDC
                </span>
              </div>
            </Card>
            <Card>
              <div className="text-xs text-muted-foreground mb-2">How it works</div>
              <ul className="text-xs space-y-1.5 text-foreground/80">
                <li>• You sign the loan agreement on-chain</li>
                <li>• The principal is paid to your wallet from the lending pool</li>
                <li>• You repay monthly in USDC to the financing contract</li>
                <li>• Repayments flow back to lenders as interest (1% platform fee)</li>
              </ul>
            </Card>
            <Button as={Link} to="/app/market/financing/review" search={{ product: product.id }}>
              Continue to review
            </Button>
          </>
        )}
      </ScreenBody>
    </>
  );
}
