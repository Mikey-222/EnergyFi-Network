import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useProduct } from "@/lib/energyfi/hooks";
import { Landmark, Star, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/market/product/$id")({ component: Product });

function Product() {
  const { id } = useParams({ from: "/app/market/product/$id" });
  const { address } = useWallet();
  const { product, loading, error } = useProduct(address, id);

  const interest =
    product && Number(product.monthlyUsd) > 0
      ? ((Number(product.monthlyUsd) * product.months - Number(product.priceUsd)) /
          Number(product.priceUsd)) *
        100
      : 0;
  const specs: [string, string][] = product
    ? [
        ["Principal paid to you", `${product.priceUsd} USDC`],
        ["Term", `${product.months} months`],
        ["Monthly installment", `${product.monthlyUsd} USDC`],
        ["Total repayment", `${(Number(product.monthlyUsd) * product.months).toFixed(2)} USDC`],
        ["Flat interest", `${interest.toFixed(1)}%`],
        ["Deposit", "None — no down payment"],
      ]
    : [];

  return (
    <>
      <ScreenHeader back="/app/market" title={product?.name ?? "Loan"} />
      <ScreenBody>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading from Stellar…
          </div>
        ) : error || !product ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {error ?? "Loan not found on-chain. Connect your wallet and try again."}
          </div>
        ) : (
          <>
            <div className="rounded-2xl overflow-hidden hairline">
              <div className="h-56 money-gradient grid place-items-center">
                <Landmark className="h-32 w-32 text-background/80" />
              </div>
            </div>
            <Card>
              <div className="flex items-center justify-between">
                <div className="text-xl font-semibold font-display">{product.name}</div>
                <div className="flex items-center gap-1 text-xs text-primary">
                  <Star className="h-3.5 w-3.5 fill-current" /> 4.9 · 312
                </div>
              </div>
              <div className="mt-1 text-3xl font-semibold tabular">
                {product.priceUsd} <span className="text-base text-muted-foreground">USDC</span>
              </div>
              <div className="text-xs text-primary mt-1">
                {product.monthlyUsd} USDC × {product.months} months · no deposit
              </div>
            </Card>
            <Card className="divide-y divide-white/5 p-0">
              {specs.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between p-4">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="text-sm text-right">{v}</div>
                </div>
              ))}
            </Card>
            <Button as={Link} to="/app/market/financing/plan" search={{ product: product.id }}>
              Apply for this loan
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Loan terms are fixed in the Stellar financing contract. The principal is disbursed to
              your wallet from the lending pool after you sign.
            </p>
          </>
        )}
      </ScreenBody>
    </>
  );
}
