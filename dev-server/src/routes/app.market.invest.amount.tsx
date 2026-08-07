import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button, Field, Input } from "@/components/energyfi/ui";
import { useState } from "react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useInvestorState } from "@/lib/energyfi/hooks";
import { PROJECT } from "@/lib/energyfi/config";

export const Route = createFileRoute("/app/market/invest/amount")({ component: Amt });

function Amt() {
  const { address } = useWallet();
  const navigate = useNavigate();
  const { projectStats } = useInvestorState(address);
  const [amount, setAmount] = useState(100);
  const sharePrice = Number(projectStats?.sharePriceUsd ?? "10");
  const tokens = Math.floor(amount / sharePrice);

  return (
    <>
      <ScreenHeader back="/app/market" title="Deposit amount" />
      <ScreenBody>
        <Card className="text-center">
          <div className="text-xs text-muted-foreground">Depositing to {PROJECT.name}</div>
          <div className="mt-1 text-5xl font-semibold font-display tabular">
            {amount} <span className="text-2xl text-muted-foreground">USDC</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            = {tokens} pool tokens · {sharePrice} USDC each · projected {PROJECT.yieldPct}% APY
          </div>
        </Card>
        <Field label="Amount (USDC)">
          <Input
            type="number"
            min={sharePrice}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          />
        </Field>
        <div className="grid grid-cols-4 gap-2">
          {[100, 500, 1000, 2500].map((n) => (
            <button
              key={n}
              onClick={() => setAmount(n)}
              className={`h-10 rounded-full text-xs font-semibold ${n === amount ? "bg-money text-background" : "bg-surface hairline"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <Button
          as={Link}
          to="/app/market/invest/confirm"
          search={{ amount, tokens }}
          variant="money"
          disabled={tokens < 1}
        >
          Review
        </Button>
      </ScreenBody>
    </>
  );
}
