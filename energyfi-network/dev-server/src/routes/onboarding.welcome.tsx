import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame, ScreenBody, Button } from "@/components/energyfi/ui";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/onboarding/welcome")({ component: Welcome });

function Welcome() {
  return (
    <PhoneFrame>
      <ScreenBody className="flex flex-col items-center text-center pt-16">
        <div className="grid h-24 w-24 place-items-center rounded-3xl energy-gradient glow-energy">
          <Sparkles className="h-12 w-12 text-background" />
        </div>
        <h1 className="mt-8 text-3xl font-semibold font-display">You're all set, Ada</h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xs">
          Your wallet is ready. Let's power up your future.
        </p>
        <div className="mt-auto w-full pt-16">
          <Button as={Link} to="/app">
            Enter EnergyFi
          </Button>
        </div>
      </ScreenBody>
    </PhoneFrame>
  );
}
