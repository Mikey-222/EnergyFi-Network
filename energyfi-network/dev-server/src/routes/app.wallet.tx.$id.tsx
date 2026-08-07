import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { useEffect, useState } from "react";
import { ExternalLink, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { getPaymentHistory, type PaymentRecord } from "@/lib/energyfi/tokens";
import { cleanPayments, fmtAmount } from "@/lib/energyfi/activity";

export const Route = createFileRoute("/app/wallet/tx/$id")({ component: TxDetail });

function TxDetail() {
  const { id } = useParams({ from: "/app/wallet/tx/$id" });
  const { address, formatAddress, explorerLink } = useWallet();
  const [tx, setTx] = useState<PaymentRecord | null>(null);
  const [state, setState] = useState<"loading" | "found" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setState("missing");
      return;
    }
    getPaymentHistory(address, 50)
      .then((records) => {
        if (cancelled) return;
        const found = cleanPayments(records).find((t) => t.id === id);
        setTx(found ?? null);
        setState(found ? "found" : "missing");
      })
      .catch(() => {
        if (!cancelled) setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [address, id]);

  if (state !== "found" || !tx) {
    return (
      <>
        <ScreenHeader back="/app/wallet/tx" title="Transaction" bell={false} />
        <ScreenBody>
          <Card className="p-8 text-center">
            <div className="text-xs text-muted-foreground">
              {state === "loading" ? "Loading transaction…" : "Transaction not found."}
            </div>
            <Link to="/app/wallet/tx" className="mt-3 inline-block text-xs text-primary">
              Back to transactions
            </Link>
          </Card>
        </ScreenBody>
      </>
    );
  }

  const received = tx.to === address;
  const rows: [string, React.ReactNode][] = [
    [
      "Amount",
      <span className={`tabular font-semibold ${received ? "text-success" : ""}`}>
        {received ? "+" : "−"}
        {fmtAmount(tx.amount)} {tx.asset}
      </span>,
    ],
    [
      "Status",
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-success/15 text-success">
        Completed
      </span>,
    ],
    ["Date", new Date(tx.createdAt).toLocaleString()],
    ["From", <span className="font-mono text-xs">{formatAddress(tx.from)}</span>],
    ["To", <span className="font-mono text-xs">{formatAddress(tx.to)}</span>],
  ];

  return (
    <>
      <ScreenHeader back="/app/wallet/tx" title="Transaction" bell={false} />
      <ScreenBody>
        <Card className="text-center">
          <div
            className={`mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full ${
              received ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {received ? (
              <ArrowDownLeft className="h-5 w-5" />
            ) : (
              <ArrowUpRight className="h-5 w-5" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">{received ? "Received" : "Sent"}</div>
          <div
            className={`mt-1 text-4xl font-semibold font-display tabular ${received ? "text-success" : ""}`}
          >
            {received ? "+" : "−"}
            {fmtAmount(tx.amount)} <span className="text-lg text-muted-foreground">{tx.asset}</span>
          </div>
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-success/15 text-success">
              Completed
            </span>
          </div>
        </Card>
        <Card className="divide-y divide-white/5 p-0">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between p-4">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="text-sm text-right max-w-[220px] truncate">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between p-4">
            <span className="text-xs text-muted-foreground">Stellar tx hash</span>
            <span className="font-mono text-xs text-right max-w-[220px] truncate">
              {tx.hash.slice(0, 16)}…{tx.hash.slice(-6)}
            </span>
          </div>
        </Card>
        <a href={explorerLink(tx.hash)} target="_blank" rel="noreferrer" className="block">
          <Button full variant="ghost">
            <ExternalLink className="h-4 w-4" /> Open in explorer
          </Button>
        </a>
      </ScreenBody>
    </>
  );
}
