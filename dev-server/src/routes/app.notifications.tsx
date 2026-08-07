import { createFileRoute, Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, EmptyState, Button } from "@/components/energyfi/ui";
import { useNotifications } from "@/lib/energyfi/hooks";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { CreditCard, HandCoins, TrendingUp, Users, Sparkles, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  payment: CreditCard,
  loan: HandCoins,
  interest: TrendingUp,
  referral: Users,
  promo: Sparkles,
};

export const Route = createFileRoute("/app/notifications")({ component: N });

function N() {
  const { address, connect, isConnecting } = useWallet();
  const { groups, loading } = useNotifications(address);

  return (
    <>
      <ScreenHeader back="/app" title="Notifications" bell={false} />
      <ScreenBody>
        {!address ? (
          <div className="rounded-2xl bg-surface hairline p-5 flex flex-col items-center text-center gap-3 mt-4">
            <div className="text-sm font-semibold">Connect your wallet</div>
            <div className="text-xs text-muted-foreground">
              Notifications are built from your live on-chain activity — loans, interest and
              referrals.
            </div>
            <Button onClick={connect} disabled={isConnecting}>
              {isConnecting ? "Connecting…" : "Connect wallet"}
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your on-chain activity…
          </div>
        ) : groups.every((g) => g.items.length === 0) ? (
          <EmptyState
            title="No notifications yet"
            subtitle="We'll let you know when something needs your attention."
          />
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <div className="text-xs uppercase tracking-widest text-muted-foreground px-1 mb-2">
                {g.label}
              </div>
              <div className="space-y-2">
                {g.items.map((n) => {
                  const Icon = iconMap[n.icon] ?? Sparkles;
                  return (
                    <Link
                      key={n.id}
                      to={n.to}
                      search={n.search as LinkProps["search"]}
                      className="flex gap-3 rounded-2xl bg-surface hairline p-4 hover:bg-surface-2"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-xs text-muted-foreground">{n.body}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </ScreenBody>
    </>
  );
}
