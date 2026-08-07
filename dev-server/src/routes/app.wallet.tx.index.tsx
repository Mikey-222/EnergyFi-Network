import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Input, StatusPill } from "@/components/energyfi/ui";
import { useState } from "react";
import { Search, Filter, ArrowDownLeft, ArrowUpRight, PiggyBank } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { usePaymentHistory, usePoolActivity } from "@/lib/energyfi/hooks";
import {
  cleanPayments,
  dayLabel,
  timeLabel,
  fmtAmount,
  mergePoolActivity,
} from "@/lib/energyfi/activity";

export const Route = createFileRoute("/app/wallet/tx/")({ component: TxList });

function TxList() {
  const { address } = useWallet();
  const { records, loading } = usePaymentHistory(address, 50);
  const { records: poolActivity } = usePoolActivity(address);
  const [query, setQuery] = useState("");

  const payments = cleanPayments(records);
  const feed = mergePoolActivity(poolActivity, payments);
  const q = query.trim().toLowerCase();
  const visible = feed.filter(
    (t) =>
      !q ||
      `${t.amount} ${t.asset} ${t.to === address ? "received" : "sent"} ${t.type}`.includes(q),
  );

  return (
    <>
      <ScreenHeader
        back="/app/wallet"
        title="Transactions"
        right={
          <button className="grid h-9 w-9 place-items-center rounded-full bg-surface hairline">
            <Filter className="h-4 w-4" />
          </button>
        }
      />
      <ScreenBody>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions"
            className="pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="rounded-2xl bg-surface hairline overflow-hidden">
          {!address ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Connect a wallet to see your transactions.
            </div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              {loading ? "Loading…" : query ? "No matches." : "No transfers yet."}
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
                              {received ? "Received" : "Sent"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {timeLabel(t.createdAt)} · {t.asset}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-sm font-semibold tabular ${
                              received ? "text-success" : ""
                            }`}
                          >
                            {received ? "+" : "−"}
                            {fmtAmount(t.amount)} {t.asset}
                          </span>
                          <StatusPill status="Completed" />
                        </div>
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
