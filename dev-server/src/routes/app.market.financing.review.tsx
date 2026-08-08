import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { PenLine, Loader2, PiggyBank, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useProduct, confirmReferralUsageIfPending } from "@/lib/energyfi/hooks";
import { getInstallmentsClient, fromStroops } from "@/lib/energyfi/contracts";
import type { EligibilityResult } from "@/contracts/installments";

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
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setChecking(true);
    getInstallmentsClient(address)
      .check_eligibility({ borrower: address, product_id: productId })
      .then((res) => {
        if (!cancelled) setEligibility(res.result as unknown as EligibilityResult);
      })
      .catch(() => {
        if (!cancelled) setEligibility(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, productId]);

  const pledgeMet =
    eligibility != null &&
    eligibility.eligible &&
    !eligibility.defaulted &&
    !eligibility.already_started;
  const shortfallUsd =
    eligibility && eligibility.savings < eligibility.required_pledge
      ? fromStroops(eligibility.required_pledge - eligibility.savings)
      : null;
  const topUpUsd =
    shortfallUsd != null ? +Math.ceil(Number(shortfallUsd)).toFixed(2) : null;

  const sign = async () => {
    if (!address || !product) return;
    if (!pledgeMet) {
      setError("This loan needs a 25% pool-savings pledge. Save first, then come back.");
      setStatus("error");
      return;
    }
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
            {checking ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your pledge…
              </div>
            ) : eligibility &&
              !eligibility.defaulted &&
              !eligibility.already_started &&
              eligibility.savings < eligibility.required_pledge ? (
              <Card className="border-warning/25">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-semibold text-warning">Pledge not met</div>
                    <p className="mt-1 text-muted-foreground">
                      This loan needs{" "}
                      <span className="font-semibold text-foreground">
                        {fromStroops(eligibility.required_pledge)} USDC
                      </span>{" "}
                      in pool savings (a 25% pledge). You currently have{" "}
                      <span className="font-semibold text-foreground">
                        {fromStroops(eligibility.savings)} USDC
                      </span>
                      {shortfallUsd ? (
                        <>
                          {" "}
                          — save{" "}
                          <span className="font-semibold text-warning">
                            {topUpUsd} USDC
                          </span>{" "}
                          more (whole shares only).
                        </>
                      ) : (
                        "."
                      )}
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
                </div>
              </Card>
            ) : eligibility?.defaulted ? (
              <Card className="border-destructive/25">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-semibold text-destructive">Account defaulted</div>
                    <p className="mt-1 text-muted-foreground">
                      This wallet was settled as defaulted on a previous loan. New financings are
                      blocked until the platform admin clears the flag.
                    </p>
                  </div>
                </div>
              </Card>
            ) : eligibility?.already_started ? (
              <Card className="border-destructive/25">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-semibold text-destructive">Loan already started</div>
                    <p className="mt-1 text-muted-foreground">
                      You already have a financing for this product. Track and repay it from the
                      repay screen.
                    </p>
                  </div>
                </div>
              </Card>
            ) : eligibility ? (
              <Card className="border-success/25">
                <p className="text-xs text-success">
                  Your pool savings cover the 25% pledge — you're eligible to sign.
                </p>
              </Card>
            ) : null}
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
            <Button onClick={sign} disabled={status === "sending" || (checking && !eligibility)}>
              {status === "sending" ? "Signing…" : "Sign & start your loan"}
            </Button>
          </>
        )}
      </ScreenBody>
    </>
  );
}
