import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame, ScreenBody, Button } from "@/components/energyfi/ui";
import { WifiOff } from "lucide-react";
export const Route = createFileRoute("/app/offline")({ component: O });
function O() {
  return (
    <PhoneFrame>
      <ScreenBody className="flex flex-col items-center text-center pt-24">
        <WifiOff className="h-20 w-20 text-muted-foreground mb-6" />
        <h2 className="text-xl font-semibold font-display">You're offline</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Any payment you started will retry automatically once you're back online.
        </p>
        <div className="w-full mt-auto pt-8">
          <Button as={Link} to="/app">
            Retry now
          </Button>
        </div>
      </ScreenBody>
    </PhoneFrame>
  );
}
