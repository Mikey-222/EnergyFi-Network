import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { PenLine, Loader2 } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useProduct, confirmReferralUsageIfPending } from "@/lib/energyfi/hooks";
import { getInstallmentsClient } from "@/lib/energyfi/contracts";

export const Route = createFileRoute("/app/market/financing/review")({
  component: Review,
  validateSearch: (search: Record<string, unknown>) => ({
    product: typeof search.product === "string" ? search.product : "loan_100",
  }),
});

function Review() {
  const { address, connect } = useWallet();
  const navigate = useNavigate();
  const { product: productId } = useSearch({ from: "/app/market/financing/review" });
  const { product, loading } = useProduct(address, productId);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const sign = async () => {
    if (!address || !product) return;
    setStatus("sending");
    setError(null);
    try {
      const c = getInstallmentsClient(address);
      const tx = await c.start_financing({ buyer: address, product_id: product.id });
      await tx.signAndSend();
      confirmReferralUsageIfPending(address);
      navigate({ to: "/app/market/financing/deposit", search: { product: product.id } });
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Transaction failed");
      setStatus("error");
    }
  };

  const terms: [string, string][] = product
    ? [
        ["Loan", product.name],
        ["Principal", `${product.priceUsd} USDC`],
        ["Deposit", "None"],
        ["Monthly installment", `${product.monthlyUsd} USDC × ${product.months}`],
        ["Interest paid to lenders", "Included in installments"],
        ["Contract type", "Stellar Financing Contract"],
      ]
    : [];

  return (
    <>
      <ScreenHeader back="/app/market/financing/plan" title="Review & sign" />
      <ScreenBody>
        {loading || !product ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !address ? (
          <div className="rounded-2xl bg-surface hairline p-5 text-center space-y-3">
            <div className="text-sm font-semibold">Connect your wallet</div>
            <div className="text-xs text-muted-foreground">
              Signing this agreement creates your on-chain loan.
            </div>
            <Button onClick={connect}>Connect wallet</Button>
          </div>
        ) : (
          <>
            <Card className="divide-y divide-white/5 p-0">
              {terms.map(([k, v]) => (
                <div key={k} className="flex justify-between p-4">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-sm">{v}</span>
                </div>
              ))}
            </Card>
            <Card className="text-center">
              <PenLine className="h-6 w-6 text-primary mx-auto" />
              <div className="mt-2 text-sm font-medium">Tap to sign</div>
              <div className="mt-3 h-24 rounded-xl bg-background/40 border border-dashed border-white/20 grid place-items-center text-xs text-muted-foreground">
                {status === "sending" ? "Waiting for wallet…" : "Sign here"}
              </div>
            </Card>
            {status === "error" && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {error}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground text-center">
              By signing you agree to EnergyFi's Loan Terms. After approval, the {product.priceUsd}{" "}
              USDC principal is paid to your wallet from the lending pool.
            </p>
            <Button as={Link} to="/app/market/financing/eligibility">
              Eligibility check
            </Button>
            <Button onClick={sign} disabled={status === "sending"}>
              {status === "sending" ? "Signing…" : "Sign & start your loan"}
            </Button>
          </>
        )}
      </ScreenBody>
    </>
  );
}
