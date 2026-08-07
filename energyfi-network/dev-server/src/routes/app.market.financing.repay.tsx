import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { Loader2, CheckCircle2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useActiveLoans, confirmReferralUsageIfPending } from "@/lib/energyfi/hooks";
import { getInstallmentsClient, fromStroops } from "@/lib/energyfi/contracts";

export const Route = createFileRoute("/app/market/financing/repay")({
  component: Repay,
});

const MONTH_SECONDS = 30 * 24 * 60 * 60;

/** Next installment due (UNIX ms) for a loan started at `startedAt`.
 *  Each payment due falls a fixed month later; installments already paid
 *  push the window forward. Without a start timestamp we fall back to "—".
 */
function nextDueMs(startedAt: number | null, installmentsPaid: number): number | null {
  if (!startedAt) return null;
  return (startedAt + (installmentsPaid + 1) * MONTH_SECONDS) * 1000;
}

function formatDelta(ms: number): string {
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function Repay() {
  const { address, balances, connect } = useWallet();
  const { loans, loading, error, refresh } = useActiveLoans(address);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const act = async (key: string, run: () => Promise<unknown>) => {
    if (!address) return;
    setBusy(key);
    setResult((r) => ({ ...r, [key]: "" }));
    try {
      await run();
      confirmReferralUsageIfPending(address);
      setResult((r) => ({ ...r, [key]: "ok" }));
      await refresh();
    } catch (err) {
      setResult((r) => ({
        ...r,
        [key]: (err instanceof Error ? err.message : undefined) ?? "Transaction failed",
      }));
    } finally {
      setBusy(null);
    }
  };

  const usdc = Number(balances?.usdc ?? 0);

  return (
    <>
      <ScreenHeader back="/app/market" title="Repay your loan" />
      <ScreenBody>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !address ? (
          <Card className="text-center space-y-3">
            <div className="text-sm font-semibold">Connect your wallet</div>
            <div className="text-xs text-muted-foreground">
              See your active loans and pay installments or pay them off in full.
            </div>
            <Button onClick={connect}>Connect wallet</Button>
          </Card>
        ) : loans.length === 0 ? (
          <Card className="text-center">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
            <div className="mt-3 text-sm font-semibold">No active loans</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Loans you start appear here with a monthly schedule and a pay‑off in full option.
            </div>
            <div className="mt-4">
              <Button as={Link} to="/app/market/financing/plan">
                Take a loan
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
{loans.map((loan) => {
              const due = nextDueMs(loan.startedAt, loan.installmentsPaid);
              const overdue = due !== null && now > due;
              const key = `loan-${loan.productId}`;
              return (
                <Card key={key} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{loan.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {loan.installmentsPaid}/{loan.months} installments paid ·{" "}
                        {loan.disbursed ? "disbursed" : "awaiting disbursal"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        overdue
                          ? "bg-red-500/15 text-red-300"
                          : loan.late > 0
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-success/10 text-success"
                      }`}
                    >
                      {overdue ? "Overdue" : loan.late > 0 ? `${loan.late} late` : "On track"}
                    </span>
                  </div>

                  <div className="rounded-xl bg-background/40 border border-white/5 px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Outstanding principal</span>
                      <span className="tabular">{fromStroops(loan.outstandingStroops)} USDC</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Next installment</span>
                      <span className="tabular">{fromStroops(loan.monthlyStroops)} USDC</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Due in</span>
                      <span className="tabular">
                        {due
                          ? overdue
                            ? `overdue · ${formatDelta(now - due)}`
                            : formatDelta(due - now)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pay off balance in full</span>
                      <span className="tabular">{fromStroops(loan.payoffStroops)} USDC</span>
                    </div>
                  </div>

                  {usdc < Number(fromStroops(loan.monthlyStroops)) && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-300">
                      <Wallet className="h-3.5 w-3.5 inline -mt-0.5 mr-1.5" />
                      Only {usdc.toFixed(2)} USDC in your wallet — get testnet USDC to cover
                      repayments.
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={busy !== null || usdc < Number(fromStroops(loan.monthlyStroops))}
                      onClick={() =>
                        act(`${key}-installment`, async () => {
                          const c = getInstallmentsClient(address);
                          const tx = await c.pay_installment({
                            buyer: address,
                            product_id: loan.productId,
                          });
                          await tx.signAndSend();
                        })
                      }
                    >
                      {busy === `${key}-installment`
                        ? "Confirming…"
                        : `Pay installment (${fromStroops(loan.monthlyStroops)})`}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={busy !== null}
                      onClick={() =>
                        act(`${key}-payoff`, async () => {
                          const c = getInstallmentsClient(address);
                          const tx = await c.payoff_loan({
                            buyer: address,
                            product_id: loan.productId,
                          });
                          await tx.signAndSend();
                        })
                      }
                    >
                      {busy === `${key}-payoff`
                        ? "Confirming…"
                        : `Pay off in full (${fromStroops(loan.payoffStroops)})`}
                    </Button>
                  </div>

                  {result[`${key}-installment`] === "ok" && (
                    <div className="text-xs text-success">
                      Installment paid — interest was routed to the pool.
                    </div>
                  )}
                  {result[`${key}-payoff`] === "ok" && (
                    <div className="text-xs text-success">
                      Loan paid off in full. Your loan is settled.
                    </div>
                  )}
                  {result[`${key}-installment`] && result[`${key}-installment`] !== "ok" && (
                    <div className="text-xs text-red-300">{result[`${key}-installment`]}</div>
                  )}
                  {result[`${key}-payoff`] && result[`${key}-payoff`] !== "ok" && (
                    <div className="text-xs text-red-300">{result[`${key}-payoff`]}</div>
                  )}
                </Card>
              );
            })}

            <p className="text-[11px] text-muted-foreground text-center">
              Need help deciding? Open{" "}
              <span className="text-primary">
                <Link to="/app/market/financing/plan">financing</Link>
              </span>{" "}
              or contact support from the profile.
            </p>
          </div>
        )}
      </ScreenBody>
    </>
  );
}