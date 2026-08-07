import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, PiggyBank, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneFrame } from "./ui";
import { useT } from "@/lib/energyfi/i18n";
import { useWallet } from "./wallet-provider";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tab = {
  to: "/app" | "/app/wallet" | "/app/market/portfolio" | "/app/market" | "/app/profile";
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { address } = useWallet();
  const { translate, isRtl } = useT(address);

  const tabs: Tab[] = [
    { to: "/app", label: translate("tab.home"), icon: Home, match: (p: string) => p === "/app" },
    {
      to: "/app/wallet",
      label: translate("tab.wallet"),
      icon: Wallet,
      match: (p: string) => p.startsWith("/app/wallet"),
    },
    {
      to: "/app/market/portfolio",
      label: translate("tab.savings"),
      icon: PiggyBank,
      match: (p: string) =>
        p.startsWith("/app/market/portfolio") || p.startsWith("/app/market/invest"),
    },
    {
      to: "/app/market",
      label: translate("tab.market"),
      icon: ShoppingBag,
      match: (p: string) => p.startsWith("/app/market"),
    },
    {
      to: "/app/profile",
      label: translate("tab.profile"),
      icon: User,
      match: (p: string) => p.startsWith("/app/profile"),
    },
  ];

  return (
    <PhoneFrame>
      <div dir={isRtl ? "rtl" : "ltr"} className="contents">
        <div className="flex-1 flex flex-col">{children}</div>
        <nav className="absolute bottom-0 inset-x-0 border-t border-white/10 bg-background/95 backdrop-blur-xl">
          <div className="grid grid-cols-5 px-2 pt-2 pb-6">
            {tabs.map((t) => {
              const active = t.match(pathname);
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-1.5 text-[10px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-xl transition-all",
                      active && "bg-primary/15",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </PhoneFrame>
  );
}
