import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, BalanceCard } from "@/components/energyfi/ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  QrCode,
  Send,
  ShieldCheck,
  Wallet as WalletIcon,
  PiggyBank,
} from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useInvestorState, usePaymentHistory, usePoolActivity } from "@/lib/energyfi/hooks";
import { useProfile } from "@/lib/energyfi/profile";
import { CIRCE_FAUCET_URL, PROJECT } from "@/lib/energyfi/config";
import {
  cleanPayments,
  dayLabel,
  timeLabel,
  fmtAmount,
  mergePoolActivity,
} from "@/lib/energyfi/activity";
import { useT } from "@/lib/energyfi/i18n";
import { useState } from "react";

export const Route = createFileRoute("/app/wallet/")({ component: WalletHome });

function WalletHome() {
  const {
    address,
    isConnecting,
    connect,
    formatAddress,
    balances,
    addTrustline,
    missingTrustlines,
  } = useWallet();
  const { investor } = useInvestorState(address);
  const [trustlineBusy, setTrustlineBusy] = useState<string | null>(null);
  const { records: history } = usePaymentHistory(address, 20);
  const { records: poolActivity } = usePoolActivity(address);
  const payments = cleanPayments(history);
  const feed = mergePoolActivity(poolActivity, payments);
  const visible = feed.slice(0, 6);
  const profile = useProfile(address);
  const { translate: tr } = useT(address);

  const primary = profile.currency === "EURC" ? "EURC" : "USDC";
  const xlm = balances?.xlm ? Number(balances.xlm).toFixed(2) : "0.00";
  const usdc = balances?.usdc ? Number(balances.usdc).toFixed(2) : "0.00";
  const eurc = balances?.eurc ? Number(balances.eurc).toFixed(2) : "0.00";
  const primaryBal = primary === "EURC" ? eurc : usdc;
  const secondaryBal = primary === "EURC" ? usdc : eurc;

  const onAddTrustline = async (code: "USDC" | "EURC") => {
    setTrustlineBusy(code);
    try {
      await addTrustline(code);
    } catch (err) {
      alert((err instanceof Error ? err.message : undefined) ?? `Failed to add ${code} trustline`);
    } finally {
      setTrustlineBusy(null);
    }
  };

  return (
    <>
      <ScreenHeader
        title={tr("wallet.title")}
        right={
          <Link
            to="/app/wallet/security"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface hairline"
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>
        }
      />
      <ScreenBody>
        {!address ? (
          <div className="rounded-2xl bg-surface hairline p-5 flex flex-col items-center text-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <WalletIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="text-sm font-semibold">Connect your Stellar wallet</div>
              <div className="text-xs text-muted-foreground mt-1">
                Connect Freighter or another Stellar wallet to view balances, save, borrow and refer
                neighbours.
              </div>
            </div>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="rounded-xl energy-gradient glow-energy px-4 h-10 text-sm font-semibold text-background disabled:opacity-60"
            >
              {isConnecting ? "Connecting…" : "Connect wallet"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface hairline p-3.5 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full energy-gradient text-background text-xs font-semibold">
              {formatAddress(address).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">{tr("wallet.connectedWallet")}</div>
              <div className="text-sm font-medium font-mono truncate">{formatAddress(address)}</div>
            </div>
            <span className="text-[10px] rounded-full bg-success/15 text-success px-2 py-0.5">
              Connected
            </span>
          </div>
        )}

        {missingTrustlines.length > 0 && (
          <div className="rounded-2xl bg-amber-500/10 hairline border-amber-500/30 p-4 space-y-2">
            <div className="text-xs font-semibold">
              {tr("wallet.addTrustline", { assets: missingTrustlines.join(" + ") })}
            </div>
            <div className="flex flex-wrap gap-2">
              {missingTrustlines.map((c) => (
                <button
                  key={c}
                  disabled={trustlineBusy === c}
                  onClick={() => onAddTrustline(c)}
                  className="rounded-full bg-amber-500/20 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  {trustlineBusy === c ? "Adding…" : tr("wallet.addTrustlineBtn", { code: c })}
                </button>
              ))}
            </div>
          </div>
        )}

        <BalanceCard
          label={`${primary} · Testnet`}
          amount={primaryBal}
          unit={primary}
          tone="money"
          actions={
            <a
              href={CIRCE_FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-background/20 px-3 py-1 text-xs font-medium"
            >
              {tr("wallet.getTestnet", { asset: primary })}
            </a>
          }
        />
        <BalanceCard
          label={tr("wallet.xlm")}
          amount={xlm}
          unit="XLM"
          tone="neutral"
          actions={
            <>
              <Link
                to="/app/wallet/send"
                className="rounded-full bg-background/20 px-3 py-1 text-xs font-medium"
              >
                {tr("wallet.send")}
              </Link>
              {secondaryBal !== "0.00" && (
                <span className="rounded-full bg-background/20 px-3 py-1 text-xs font-medium">
                  {secondaryBal === usdc ? "USDC" : "EURC"} {secondaryBal}
                </span>
              )}
            </>
          }
        />
        <BalanceCard
          label={`Savings · ${PROJECT.name}`}
          amount={investor?.investedUsd ?? "0"}
          unit="USDC"
          tone="energy"
          actions={
            <Link
              to="/app/market/portfolio"
              className="rounded-full bg-background/20 px-3 py-1 text-xs font-medium"
            >
              Manage
            </Link>
          }
        />

        <div className="grid grid-cols-4 gap-2">
          {[
            { to: "/app/market/invest/amount", icon: PiggyBank, label: tr("wallet.save") },
            { to: "/app/wallet/topup/method", icon: ArrowDownLeft, label: tr("wallet.topup") },
            { to: "/app/wallet/send", icon: Send, label: tr("wallet.send") },
            { to: "/app/wallet/receive", icon: QrCode, label: tr("wallet.receive") },
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

        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {tr("wallet.recentActivity")}
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
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <PiggyBank className="h-5 w-5 opacity-60" />
              {tr("wallet.noActivity")}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {visible.map((t, i) => {
                const group = dayLabel(t.createdAt);
                const prevGroup = i > 0 ? dayLabel(visible[i - 1].createdAt) : "";
                const received = t.to === address;
                const isPool =
                  t.type === "deposit" || t.type === "dividend" || t.type === "interest";
                return (
                  <div key={t.id}>
                    {group !== prevGroup && (
                      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {group}
                      </div>
                    )}
                    {isPool ? (
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
      </ScreenBody>
    </>
  );
}
