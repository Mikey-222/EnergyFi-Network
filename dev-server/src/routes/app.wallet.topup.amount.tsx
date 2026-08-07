import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";

export const Route = createFileRoute("/app/wallet/topup/amount")({ component: Amount });

function Amount() {
  return (
    <>
      <ScreenHeader back="/app/wallet/topup/method" title="Amount" bell={false} />
      <ScreenBody className="flex flex-col">
        <Card className="text-center">
          <div className="text-xs text-muted-foreground">Top up</div>
          <div className="mt-2 text-5xl font-semibold font-display tabular">
            100<span className="text-2xl text-muted-foreground">.00</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">USDC · ≈ ₦158,400</div>
        </Card>
        <div className="grid grid-cols-4 gap-2">
          {[50, 100, 250, 500].map((n) => (
            <button
              key={n}
              className={`h-10 rounded-full text-xs font-semibold ${n === 100 ? "bg-primary text-background" : "bg-surface hairline"}`}
            >
              {n}
            </button>
          ))}
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
        <Button as={Link} to="/app/wallet/topup/processing">
          Continue
        </Button>
      </ScreenBody>
    </>
  );
}
