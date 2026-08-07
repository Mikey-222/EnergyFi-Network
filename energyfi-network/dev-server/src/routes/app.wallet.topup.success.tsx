import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Button } from "@/components/energyfi/ui";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/wallet/topup/success")({ component: Success });

function Success() {
  return (
    <>
      <ScreenHeader title="Top-up complete" bell={false} />
      <ScreenBody className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-24 w-24 text-success my-10" />
        <div className="text-xs text-muted-foreground">Added to your wallet</div>
        <div className="mt-1 text-4xl font-semibold font-display tabular">
          +100 <span className="text-lg text-muted-foreground">USDC</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">New balance · 600.00 USDC</div>
        <div className="mt-auto w-full pt-10 space-y-2">
          <Button as={Link} to="/app/wallet">
            Done
          </Button>
          <Button as={Link} to="/app/market" variant="ghost">
            Explore loans
          </Button>
        </div>
      </ScreenBody>
    </>
  );
}
