import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody } from "@/components/energyfi/ui";
import { Building2, Store, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/wallet/withdraw/method")({ component: Method });

function Method() {
  const opts = [
    {
      icon: Building2,
      label: "Bank account",
      sub: "GTBank ••• 4421",
      to: "/app/wallet/withdraw/amount",
    },
    {
      icon: Store,
      label: "Cash agent pickup",
      sub: "Instant · 0.5% fee",
      to: "/app/wallet/withdraw/amount",
    },
  ];
  return (
    <>
      <ScreenHeader back="/app/wallet" title="Cash out" bell={false} />
      <ScreenBody>
        <p className="text-sm text-muted-foreground">Where should we send it?</p>
        {opts.map((o) => (
          <Link
            key={o.label}
            to={o.to}
            className="flex items-center gap-3 rounded-xl bg-surface hairline p-4 hover:bg-surface-2"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-money/15 text-money">
              <o.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{o.label}</div>
              <div className="text-xs text-muted-foreground">{o.sub}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </ScreenBody>
    </>
  );
}
