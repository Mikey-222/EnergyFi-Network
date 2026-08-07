import { Link } from "@tanstack/react-router";
import { Button } from "@/components/energyfi/ui";
import { CreditCard, Loader2 } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useActiveLoans } from "@/lib/energyfi/hooks";
import { fromStroops } from "@/lib/energyfi/contracts";

/** Wallet-agnostic "repay your loan" entry — shown on Home + Market for any
 *  connected wallet that currently has an outstanding financing. Lets a
 *  borrower pay the next installment or settle the whole remaining balance. */
export function RepayBanner() {
  const { address } = useWallet();
  const { loans, loading } = useActiveLoans(address);

  if (!address) return null;
  if (loading)
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-surface hairline p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your loans…
      </div>
    );
  if (loans.length === 0) return null;

  const totalDue = loans.reduce((acc, l) => acc + l.payoffStroops, 0n);
  const overdue = loans.some((l) => l.late > 0);

  return (
    <div
      className={`rounded-2xl hairline p-4 space-y-2 ${
        overdue ? "bg-warning/10 border !border-warning/40" : "bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          {overdue ? (
            <CreditCard className="h-4 w-4 text-warning mt-0.5" />
          ) : (
            <CreditCard className="h-4 w-4 text-primary mt-0.5" />
          )}
          <div>
            <div className="text-sm font-semibold">
              Active loan debt · {fromStroops(totalDue)} USDC
            </div>
            <div className="text-[11px] text-muted-foreground">
              {loans.length === 1
                ? "1 financing to repay"
                : `${loans.length} financings to repay`}
              {overdue ? " · some payments are late" : " · payments scheduled monthly"}
            </div>
          </div>
        </div>
        <Button as={Link} to="/app/market/financing/repay" className="!h-9 !w-auto !px-4 !text-xs">
          Repay
        </Button>
      </div>
    </div>
  );
}