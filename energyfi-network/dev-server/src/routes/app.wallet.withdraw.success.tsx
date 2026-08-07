import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Button } from "@/components/energyfi/ui";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/wallet/withdraw/success")({ component: S });

function S() {
  return (
    <>
      <ScreenHeader title="Withdrawal sent" bell={false} />
      <ScreenBody className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-24 w-24 text-success my-10" />
        <div className="text-4xl font-semibold font-display tabular">
          -250 <span className="text-lg text-muted-foreground">USDC</span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Arriving in your bank within 1–2 hours.
        </div>
        <div className="mt-auto w-full pt-10">
          <Button as={Link} to="/app/wallet">
            Done
          </Button>
        </div>
      </ScreenBody>
    </>
  );
}
