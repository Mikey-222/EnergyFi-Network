import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { Loader2, CheckCircle2, XCircle, PiggyBank } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useProduct } from "@/lib/energyfi/hooks";
import { useSearch } from "@tanstack/react-router";
import { getInstallmentsClient, fromStroops } from "@/lib/energyfi/contracts";
import type { EligibilityResult } from "@/contracts/installments";

export const Route = createFileRoute("/app/market/financing/eligibility")({
  component: Eli,
  validateSearch: (search: Record<string, unknown>) => ({
    product: typeof search.product === "string" ? search.product : "loan_100",
  }),
});

function Eli() {
  const { address } = useWallet();
  const { product: productId } = useSearch({ from: "/app/market/financing/eligibility" });
  const { product } = useProduct(address, productId);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getInstallmentsClient(address)
      .check_eligibility({ borrower: address, product_id: productId })
      .then((res) => {
        if (!cancelled) setResult(res.result as unknown as EligibilityResult);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, productId]);

  const principalUsd = result?.principal != null ? fromStroops(result.principal) : "—";
  const savingsUsd = result?.savings != null ? fromStroops(result.savings) : "—";
  const maxLoanUsd = result?.max_principal != null ? fromStroops(result.max_principal) : "—";
  const pledgeUsd = result?.required_pledge != null ? fromStroops(result.required_pledge) : "—";
  const shortfallUsd =
    result && result.savings < result.required_pledge
      ? fromStroops(result.required_pledge - result.savings)
      : null;

  return (
    <>
      <ScreenHeader back="/app/market/financing/plan" title="Eligibility check" />
      <ScreenBody className="flex flex-col items-center text-center">
        {loading ? (
          <>
            <Loader2 className="h-16 w-16 text-primary animate-spin my-10" />
            <p className="text-sm">Checking your eligibility…</p>
            <p className="text-xs text-muted-foreground mt-1">
              Verifying your default history and pool savings on-chain.
            </p>
          </>
        ) : failed || !result ? (
          <>
            <XCircle className="h-16 w-16 text-red-400 my-8" />
            <div className="text-xl font-semibold font-display">Check failed</div>
            <Card className="w-full mt-4">
              <p className="text-sm text-muted-foreground">
                We could not read your eligibility from the contract. Make sure you are connected
                and try again.
              </p>
            </Card>
            <Button
              as={Link}
              to="/app/market/financing/plan"
              search={{ product: productId }}
              className="mt-6"
            >
              Back to plan
            </Button>
          </>
        ) : result.defaulted ? (
          <>
            <XCircle className="h-16 w-16 text-red-400 my-8" />
            <div className="text-xl font-semibold font-display">Not eligible</div>
            <Card className="w-full mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Verdict</span>
                <span className="font-semibold text-red-400">Defaulted account</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground text-left">
                This wallet was settled as defaulted on a previous loan. New financings are blocked
                until the platform admin clears the flag.
              </p>
            </Card>
          </>
        ) : result.already_started ? (
          <>
            <XCircle className="h-16 w-16 text-warning my-8" />
            <div className="text-xl font-semibold font-display">Already started</div>
            <Card className="w-full mt-4">
              <p className="text-sm text-muted-foreground">
                You already have a financing for this product. Open it from your notifications or
                the financing deposit screen.
              </p>
            </Card>
            <Button
              as={Link}
              to="/app/market/financing/deposit"
              search={{ product: productId }}
              className="mt-6"
            >
              Go to my loan
            </Button>
          </>
        ) : !result.eligible ? (
          <>
            <PiggyBank className="h-16 w-16 text-warning my-8" />
            <div className="text-xl font-semibold font-display">Save first</div>
            <Card className="w-full mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Loan principal</span>
                <span className="font-semibold tabular">{principalUsd} USDC</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Your pool savings</span>
                <span className="font-semibold tabular">{savingsUsd} USDC</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Savings required</span>
                <span className="font-semibold tabular">{pledgeUsd} USDC</span>
              </div>
              {shortfallUsd && (
                <p className="mt-3 text-xs text-muted-foreground text-left">
                  Loans are capped at 4x your savings in the neighbourhood pool — a 25% pledge. Save{" "}
                  <span className="text-warning font-semibold">{shortfallUsd} USDC</span> more to
                  qualify for this loan.
                </p>
              )}
            </Card>
            <Button
              as={Link}
              to="/app/market/invest/$id"
              params={{ id: "neighbourhood-pool" }}
              className="mt-6"
            >
              Save in the pool
            </Button>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-16 w-16 text-success my-8" />
            <div className="text-xl font-semibold font-display">Eligible</div>
            <Card className="w-full mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pool savings</span>
                <span className="font-semibold tabular">{savingsUsd} USDC</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Max loan at 4x</span>
                <span className="font-semibold tabular">{maxLoanUsd} USDC</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Principal</span>
                <span className="font-semibold tabular">{principalUsd} USDC</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Monthly</span>
                <span className="font-semibold tabular">
                  {product?.monthlyUsd ?? "—"} USDC × {product?.months ?? "—"}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Deposit</span>
                <span className="font-semibold tabular">None</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Default history</span>
                <span className="font-semibold text-success">Clean</span>
              </div>
            </Card>
            <Button
              as={Link}
              to="/app/market/financing/review"
              search={{ product: productId }}
              className="mt-6"
            >
              Continue
            </Button>
          </>
        )}
      </ScreenBody>
    </>
  );
}
