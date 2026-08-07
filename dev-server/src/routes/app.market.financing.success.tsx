import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Button } from "@/components/energyfi/ui";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/market/financing/success")({ component: Suc });

function Suc() {
  return (
    <>
      <ScreenHeader title="Loan active" bell={false} />
      <ScreenBody className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-24 w-24 text-success my-10" />
        <h2 className="text-2xl font-semibold font-display">Your loan is active</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Your first installment was paid on-chain. The principal is now being paid to your wallet
          from the lending pool. Track installments in your wallet activity.
        </p>
        <div className="w-full mt-auto pt-8 space-y-2">
          <Button as={Link} to="/app/wallet">
            View my wallet
          </Button>
          <Button as={Link} to="/app" variant="ghost">
            Back home
          </Button>
        </div>
      </ScreenBody>
    </>
  );
}
