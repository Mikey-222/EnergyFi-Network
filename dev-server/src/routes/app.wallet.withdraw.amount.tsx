import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";

export const Route = createFileRoute("/app/wallet/withdraw/amount")({ component: Amt });

function Amt() {
  return (
    <>
      <ScreenHeader back="/app/wallet/withdraw/method" title="Withdraw amount" bell={false} />
      <ScreenBody className="flex flex-col">
        <Card className="text-center">
          <div className="text-xs text-muted-foreground">Cash out</div>
          <div className="mt-2 text-5xl font-semibold font-display tabular">
            250<span className="text-2xl text-muted-foreground">.00</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">USDC · Available 500.00</div>
        </Card>
        <div className="rounded-xl bg-surface hairline p-4 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">You send</span>
            <span className="tabular">250.00 USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee (0.5%)</span>
            <span className="tabular">1.25 USDC</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2">
            <span className="font-medium">You receive</span>
            <span className="tabular font-semibold">₦393,712</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0, "⌫"].map((k) => (
            <button
              key={k}
              className="h-14 rounded-xl bg-surface hairline text-lg font-semibold hover:bg-surface-2"
            >
              {k}
            </button>
          ))}
        </div>
        <Button as={Link} to="/app/wallet/withdraw/success">
          Confirm withdrawal
        </Button>
      </ScreenBody>
    </>
  );
}
