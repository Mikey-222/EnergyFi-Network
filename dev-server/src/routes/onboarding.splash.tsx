import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sun } from "lucide-react";
import { PhoneFrame } from "@/components/energyfi/ui";

export const Route = createFileRoute("/onboarding/splash")({ component: Splash });

function Splash() {
  const nav = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => nav({ to: "/onboarding/intro/$step", params: { step: "1" } }), 1400);
    return () => clearTimeout(t);
  }, [nav]);
  return (
    <PhoneFrame>
      <div className="flex-1 grid place-items-center">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl energy-gradient glow-energy animate-pulse">
            <Sun className="h-10 w-10 text-background" />
          </div>
          <div className="mt-6 text-2xl font-semibold font-display">EnergyFi</div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-1">
            Network
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
