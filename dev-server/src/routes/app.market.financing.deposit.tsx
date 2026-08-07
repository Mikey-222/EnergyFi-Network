import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useProduct, confirmReferralUsageIfPending } from "@/lib/energyfi/hooks";
import { getInstallmentsClient } from "@/lib/energyfi/contracts";

export const Route = createFileRoute("/app/market/financing/deposit")({
  component: Dep,
  validateSearch: (search: Record<string, unknown>) => ({
    product: typeof search.product === "string" ? search.product : "loan_100",
  }),
});

function Dep() {
  const { address, balances } = useWallet();
  const navigate = useNavigate();
  const { product: productId } = useSearch({ from: "/app/market/financing/deposit" });
  const { product, loading } = useProduct(address, productId);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const usdc = Number(balances?.usdc ?? 0);

  const pay = async () => {
    if (!address || !product) return;
    setStatus("sending");
    setError(null);
    try {
      const c = getInstallmentsClient(address);
      const tx = await c.pay_installment({ buyer: address, product_id: product.id });
      await tx.signAndSend();
      confirmReferralUsageIfPending(address);
      navigate({ to: "/app/market/financing/success" });
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Transaction failed");
      setStatus("error");
    }
  };

  return (
    <>
      <ScreenHeader back="/app/market/financing/review" title="First installment" />
      <ScreenBody>
        {loading || !product ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <Card className="text-center">
              <div className="text-xs text-muted-foreground">First monthly installment</div>
              <div className="mt-1 text-5xl font-semibold font-display tabular">
                {product.monthlyUsd} <span className="text-2xl text-muted-foreground">USDC</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {product.months - 1} installments remaining after this
              </div>
            </Card>
            <div className="rounded-xl bg-surface hairline p-4">
              <div className="text-xs text-muted-foreground">Paying from</div>
              <div className="text-sm font-medium mt-1">
                USDC Wallet · {usdc.toFixed(2)} available
              </div>
            </div>
            {usdc < Number(product.monthlyUsd) && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
                Insufficient USDC. Get testnet USDC from the{" "}
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Circle faucet
                </a>
                .
              </div>
            )}
            {status === "error" && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {error}
              </div>
            )}
            <Button
              onClick={pay}
              disabled={status === "sending" || usdc < Number(product.monthlyUsd)}
            >
              {status === "sending" ? "Confirming in wallet…" : `Pay ${product.monthlyUsd} USDC`}
            </Button>
          </>
        )}
      </ScreenBody>
    </>
  );
}
