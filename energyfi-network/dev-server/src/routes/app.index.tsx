import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, BalanceCard, Button } from "@/components/energyfi/ui";
import { wallet } from "@/components/energyfi/mock";
import {
  PiggyBank,
  ArrowUpFromLine,
  Users,
  LifeBuoy,
  ArrowRight,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet as WalletIcon,
} from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { RepayBanner } from "@/components/energyfi/repay-banner";
import {
  useInvestorState,
  useProduct,
  usePaymentHistory,
  usePoolActivity,
  useInstallmentsActivity,
} from "@/lib/energyfi/hooks";
import { PROJECT, REFERRAL } from "@/lib/energyfi/config";
import { useProfile, firstNameOf, initialsOf } from "@/lib/energyfi/profile";
import {
  cleanPayments,
  dayLabel,
  timeLabel,
  fmtAmount,
  mergePoolActivity,
} from "@/lib/energyfi/activity";
import type { PaymentRecord } from "@/lib/energyfi/tokens";
import { useT } from "@/lib/energyfi/i18n";

export const Route = createFileRoute("/app/")({ component: Home });

function Home() {
  const { address, balances, formatAddress } = useWallet();
  const profile = useProfile(address);
  const { translate: tr } = useT(address);
  const { investor } = useInvestorState(address);
  const { product: starterLoan } = useProduct(address, "loan_100");
  const { records: history, loading: historyLoading } = usePaymentHistory(address, 20);
  const { records: poolActivity } = usePoolActivity(address);
  const { records: instActivity } = useInstallmentsActivity(address);
  const payments = cleanPayments(history);
  const feed = mergePoolActivity(poolActivity, payments);
  const instFeed = instActivity.map((r) => ({
    id: r.id,
    type: r.kind,
    amount: r.amountUsd || "0",
    asset: "USDC",
    from: "",
    to: "",
    createdAt: r.createdAt,
    hash: r.txHash,
  })) as PaymentRecord[];
  const visible = [...feed, ...instFeed]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 4);
  const xlmBalance = balances?.xlm ? Number(balances.xlm).toFixed(2) : wallet.usdc.toFixed(2);
  const claimable = Number(investor?.claimableUsd ?? 0);
  const saved = Number(investor?.investedUsd ?? 0);

  return (
    <>
      <ScreenHeader
        title={
          profile.name && profile.name !== "New user"
            ? `${tr("home.goodMorning")}, ${firstNameOf(profile.name)}`
            : tr("home.goodMorning")
        }
        subtitle={tr("home.subtitle")}
        right={
          <div className="grid h-9 w-9 place-items-center rounded-full energy-gradient text-background font-semibold text-xs">
            {initialsOf(profile.name)}
          </div>
        }
      />
      <ScreenBody>
        <Link
          to="/app/wallet"
          className="flex items-center gap-3 rounded-2xl bg-surface hairline p-3.5 hover:bg-surface-2"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <WalletIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">
              {address ? tr("home.walletConnected") : tr("home.connectWallet")}
            </div>
            <div className="text-xs text-muted-foreground font-mono truncate">
              {address ? formatAddress(address) : tr("home.linkWallet")}
            </div>
          </div>
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 ${address ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
          >
            {address ? tr("home.connected") : tr("home.connect")}
          </span>
        </Link>

        <BalanceCard
          label={address ? tr("wallet.xlm") : "Energy Wallet · USDC"}
          amount={address ? xlmBalance : wallet.usdc.toFixed(2)}
          unit={address ? "XLM" : "USDC"}
          tone="money"
          actions={
            <Link
              to="/app/wallet/topup/method"
              className="rounded-full bg-background/20 px-3 py-1 text-xs font-medium"
            >
              {tr("home.topUp")}
            </Link>
          }
        />

        <RepayBanner />

        <Card className="money-gradient text-background">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-80">
                {tr("home.savings")} · {PROJECT.name}
              </div>
              <div className="mt-1 text-3xl font-semibold font-display tabular">
                {saved.toFixed(2)} <span className="text-base opacity-80">USDC</span>
              </div>
              <div className="mt-1 text-xs opacity-80">
                {PROJECT.yieldPct}% projected APY · {investor?.shares ?? "0"}{" "}
                {tr("home.poolTokens")}
                {claimable > 0 && (
                  <span className="font-semibold">
                    {" "}
                    · {claimable.toFixed(2)} USDC {tr("home.interestReady")}
                  </span>
                )}
              </div>
            </div>
            <PiggyBank className="h-10 w-10 opacity-80" />
          </div>
          <div className="mt-4 flex gap-2">
            {claimable > 0 ? (
              <Button
                as={Link}
                to="/app/market/portfolio"
                variant="ghost"
                className="!h-10 !px-4 bg-background/20 !text-background"
              >
                {tr("home.claimInterest")}
              </Button>
            ) : (
              <Button
                as={Link}
                to="/app/market/invest/amount"
                variant="ghost"
                className="!h-10 !px-4 bg-background/20 !text-background"
              >
                {tr("home.deposit")}
              </Button>
            )}
            <Button
              as={Link}
              to="/app/market/portfolio"
              variant="ghost"
              className="!h-10 !px-4 bg-background/20 !text-background"
            >
              {tr("home.viewSavings")}
            </Button>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
            <HandCoins className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("home.neighbourhoodLoans")}
            </div>
            <div className="mt-1 text-base font-semibold font-display">
              {tr("home.borrowFrom")}{" "}
              {starterLoan?.monthlyUsd ? `${starterLoan.monthlyUsd} USDC/mo` : "the pool"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {starterLoan
                ? `${tr("home.loansFrom")}`
                : "Principal paid straight to your wallet, repaid monthly"}
            </div>
            <Link
              to="/app/market"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              {tr("home.borrowNow")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        <div className="grid grid-cols-4 gap-2">
          {[
            { to: "/app/market/invest/amount", icon: PiggyBank, label: tr("home.save") },
            { to: "/app/wallet/topup/method", icon: ArrowUpFromLine, label: tr("home.topUp") },
            { to: "/app/profile/refer", icon: Users, label: tr("home.invite") },
            { to: "/app/profile/help", icon: LifeBuoy, label: tr("home.help") },
          ].map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface hairline py-3 hover:bg-surface-2"
            >
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <a.icon className="h-4 w-4" />
              </div>
              <span className="text-[11px]">{a.label}</span>
            </Link>
          ))}
        </div>

        <Card className="energy-gradient text-background">
          <p className="text-xs opacity-80">Promo</p>
          <p className="mt-1 text-sm font-semibold">
            {tr("home.promo", { reward: REFERRAL.rewardUsd })}
          </p>
        </Card>

        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {tr("home.recentActivity")}
          </h2>
          <Link to="/app/wallet/tx" className="text-xs text-primary">
            {tr("home.seeAll")}
          </Link>
        </div>
        <div className="rounded-2xl bg-surface hairline overflow-hidden">
          {!address ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {tr("home.connectToSee")}
            </div>
          ) : feed.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {historyLoading ? "Loading…" : tr("home.noTransfers")}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {visible.map((t, i) => {
                const group = dayLabel(t.createdAt);
                const prevGroup = i > 0 ? dayLabel(visible[i - 1].createdAt) : "";
                const received = t.to === address;
                const isPool =
                  t.type === "deposit" || t.type === "dividend" || t.type === "interest";
                const isInst =
                  t.type === "withdraw" ||
                  t.type === "fee" ||
                  t.type === "disbursed" ||
                  t.type === "late" ||
                  t.type === "defaulted" ||
                  t.type === "default_cleared";
                const instTitle =
                  t.type === "withdraw"
                    ? "Provider withdrawal"
                    : t.type === "fee"
                      ? "Platform fee claimed"
                      : t.type === "disbursed"
                        ? "Loan disbursed"
                        : t.type === "late"
                          ? "Loan marked late"
                          : t.type === "defaulted"
                            ? "Loan defaulted"
                            : "Default cleared";
                return (
                  <div key={t.id}>
                    {group !== prevGroup && (
                      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {group}
                      </div>
                    )}
                    {isInst ? (
                      <Link
                        to={t.type === "fee" || t.type === "withdraw" ? "/app/admin" : "/app/market"}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                            <HandCoins className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{instTitle}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {timeLabel(t.createdAt)}
                            </div>
                          </div>
                        </div>
                        {Number(t.amount) > 0 ? (
                          <span className="text-sm font-semibold tabular shrink-0">
                            {fmtAmount(t.amount)} {t.asset}
                          </span>
                        ) : null}
                      </Link>
                    ) : isPool ? (
                      <Link
                        to="/app/market/portfolio"
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                            <PiggyBank className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {t.type === "deposit"
                                ? "Deposit to pool"
                                : t.type === "interest"
                                  ? "Interest earned"
                                  : "Interest claimed"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {timeLabel(t.createdAt)} · {t.asset}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular shrink-0 text-success">
                          +{fmtAmount(t.amount)} {t.asset}
                        </span>
                      </Link>
                    ) : (
                      <Link
                        to="/app/wallet/tx/$id"
                        params={{ id: t.id }}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                              received ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                            }`}
                          >
                            {received ? (
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {received ? tr("home.received") : tr("home.sent")}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {timeLabel(t.createdAt)} · {t.asset}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-semibold tabular shrink-0 ${
                            received ? "text-success" : ""
                          }`}
                        >
                          {received ? "+" : "−"}
                          {fmtAmount(t.amount)} {t.asset}
                        </span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Button as={Link} to="/app/market" variant="ghost">
          {tr("home.exploreMarket")}
        </Button>
      </ScreenBody>
    </>
  );
}
