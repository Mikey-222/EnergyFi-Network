import { createFileRoute, Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, ListRow, Card } from "@/components/energyfi/ui";
import {
  BadgeCheck,
  User,
  Bell,
  Globe,
  CreditCard,
  Gift,
  LifeBuoy,
  FileText,
  LogOut,
  Copy,
  Gauge,
  Wallet as WalletIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useProfile, initialsOf } from "@/lib/energyfi/profile";
import { ADMIN_ADDRESS, REFERRAL } from "@/lib/energyfi/config";
import { useT } from "@/lib/energyfi/i18n";

type ProfileRow = { icon: LucideIcon; title: string; to: LinkProps["to"]; sub?: string };

export const Route = createFileRoute("/app/profile/")({ component: Profile });

function Profile() {
  const { address, formatAddress } = useWallet();
  const profile = useProfile(address);
  const { translate: tr } = useT(address);
  const items: ProfileRow[] = [
    { icon: User, title: tr("profile.edit"), to: "/app/profile/edit" },
    { icon: Bell, title: tr("profile.notifications"), to: "/app/profile/notifications" },
    { icon: Globe, title: tr("profile.language"), to: "/app/profile/language" },
    { icon: CreditCard, title: tr("profile.paymentMethods"), to: "/app/profile/payment-methods" },
    {
      icon: Gift,
      title: tr("profile.refer"),
      to: "/app/profile/refer",
      sub: `${REFERRAL.rewardUsd} USDC per referral`,
    },
    { icon: LifeBuoy, title: tr("profile.help"), to: "/app/profile/help" },
    { icon: FileText, title: tr("profile.legal"), to: "/app/profile/legal" },
    { icon: LogOut, title: tr("profile.logout"), to: "/app/profile/logout" },
  ];
  if (address === ADMIN_ADDRESS) {
    items.push({
      icon: Gauge,
      title: tr("profile.admin"),
      to: "/app/admin",
      sub: "Pools · funding · activity",
    });
  }

  return (
    <>
      <ScreenHeader title={tr("profile.title")} />
      <ScreenBody>
        <Card className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full energy-gradient text-background text-xl font-semibold">
            {initialsOf(profile.name)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold">{profile.name}</div>
              {profile.verified && <BadgeCheck className="h-4 w-4 text-success" />}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
              {address ? formatAddress(address) : tr("profile.notConnected")}{" "}
              <Copy className="h-3 w-3" />
            </div>
          </div>
        </Card>

        <Link
          to="/app/wallet"
          className="flex items-center gap-3 rounded-2xl bg-surface hairline p-4 hover:bg-surface-2"
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <WalletIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{tr("profile.stellarWallet")}</div>
            <div className="text-xs text-muted-foreground font-mono truncate">
              {address ? formatAddress(address) : "Not connected"}
            </div>
          </div>
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 ${address ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
          >
            {address ? tr("home.connected") : tr("home.connect")}
          </span>
        </Link>

        <div className="space-y-2">
          {items.map((it) => (
            <ListRow
              key={it.title}
              to={it.to}
              icon={<it.icon className="h-4 w-4" />}
              title={it.title}
              subtitle={it.sub}
              right={<span className="text-xs text-muted-foreground">›</span>}
            />
          ))}
        </div>
        <div className="text-center text-[10px] text-muted-foreground pt-4">
          EnergyFi Network · v2026.7.20
        </div>
      </ScreenBody>
    </>
  );
}
