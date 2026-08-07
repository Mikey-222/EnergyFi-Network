import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { useState } from "react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { getProjectClient, toStroops } from "@/lib/energyfi/contracts";
import { confirmReferralUsageIfPending } from "@/lib/energyfi/hooks";
import { PROJECT } from "@/lib/energyfi/config";

export const Route = createFileRoute("/app/market/invest/confirm")({
  component: Conf,
  validateSearch: (search: Record<string, unknown>) => ({
    amount: typeof search.amount === "number" ? search.amount : 100,
    tokens: typeof search.tokens === "number" ? search.tokens : 0,
  }),
});

function Conf() {
  const { address, balances, connect } = useWallet();
  const navigate = useNavigate();
  const { amount, tokens } = useSearch({ from: "/app/market/invest/confirm" });
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const usdc = Number(balances?.usdc ?? 0);
  const insufficient = usdc < amount;

  const rows: [string, string][] = [
    ["Pool", PROJECT.name],
    ["Pool tokens", String(tokens)],
    ["Deposit amount", `${amount} USDC`],
    ["Projected APY", `${PROJECT.yieldPct}% / yr`],
    ["Payment source", "USDC wallet"],
    ["Network fee", "0.00001 XLM"],
  ];

  const invest = async () => {
    if (!address) return;
    setStatus("sending");
    setError(null);
    try {
      const c = getProjectClient(address);
      const tx = await c.invest({ investor: address, amount: toStroops(amount) });
      await tx.signAndSend();
      confirmReferralUsageIfPending(address);
      navigate({ to: "/app/market/invest/success" });
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Transaction failed");
      setStatus("error");
    }
  };

  return (
    <>
      <ScreenHeader back="/app/market/invest/amount" title="Review deposit" />
      <ScreenBody>
        {!address ? (
          <div className="rounded-2xl bg-surface hairline p-5 text-center space-y-3">
            <div className="text-sm font-semibold">Connect your wallet</div>
            <Button onClick={connect}>Connect wallet</Button>
          </div>
        ) : (
          <>
            <Card className="divide-y divide-white/5 p-0">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between p-4">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-sm">{v}</span>
                </div>
              ))}
            </Card>
            {insufficient && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
                Insufficient USDC. Get testnet USDC from the{" "}
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Circle faucet
                </a>
                .
              </div>
            )}
            {status === "error" && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {error}
              </div>
            )}
            <Button
              onClick={invest}
              variant="money"
              disabled={!address || insufficient || status === "sending"}
            >
              {status === "sending" ? "Confirming in wallet…" : `Confirm & deposit ${amount} USDC`}
            </Button>
          </>
        )}
      </ScreenBody>
    </>
  );
}
