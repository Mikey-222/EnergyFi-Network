import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Button } from "@/components/energyfi/ui";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/market/invest/success")({ component: Suc });

function Suc() {
  return (
    <>
      <ScreenHeader title="Deposit confirmed" bell={false} />
      <ScreenBody className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-24 w-24 text-success my-10" />
        <div className="text-4xl font-semibold font-display tabular">5 pool tokens</div>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Added to your savings. Interest is earned from loan repayments and can be claimed anytime
          from your savings view.
        </p>
        <div className="w-full mt-auto pt-8 space-y-2">
          <Button as={Link} to="/app/market/portfolio" variant="money">
            View savings
          </Button>
          <Button as={Link} to="/app/market" variant="ghost">
            Back to market
          </Button>
        </div>
      </ScreenBody>
    </>
  );
}
