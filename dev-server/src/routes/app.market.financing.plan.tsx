import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { Loader2 } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useProduct, useActiveLoans } from "@/lib/energyfi/hooks";

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
