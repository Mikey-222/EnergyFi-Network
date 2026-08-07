import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ScreenHeader, ScreenBody, Field, Input, Button } from "@/components/energyfi/ui";
import { QrCode, Loader2, CheckCircle2, AlertCircle, Wallet as WalletIcon } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { stellar } from "@/lib/stellar";

export const Route = createFileRoute("/app/wallet/send")({ component: Send });

function Send() {
  const nav = useNavigate();
  const { address, isConnecting, connect, formatAddress } = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    if (!address) return;
    if (!to.trim() || !amount.trim()) {
      setError("Recipient and amount are required.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await stellar.sendPayment({
        from: address,
        to: to.trim(),
        amount: amount.trim(),
        memo: memo.trim() || undefined,
      });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => nav({ to: "/app/wallet" }), 1200);
      } else {
        setError("Payment was not successful. Please try again.");
      }
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : undefined) ??
          "Payment failed. Please check the address and balance.",
      );
    } finally {
      setSending(false);
    }
  };

  if (!address) {
    return (
      <>
        <ScreenHeader back="/app/wallet" title="Send USDC" bell={false} />
        <ScreenBody>
          <div className="rounded-2xl bg-surface hairline p-5 flex flex-col items-center text-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <WalletIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="text-sm font-semibold">Connect your wallet to send</div>
              <div className="text-xs text-muted-foreground mt-1">
                You need a connected Stellar wallet to send payments.
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
        </ScreenBody>
      </>
    );
  }

  return (
    <>
      <ScreenHeader back="/app/wallet" title="Send USDC" bell={false} />
      <ScreenBody>
        <div className="rounded-xl bg-surface hairline p-3.5 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full energy-gradient text-background text-xs font-semibold">
            {formatAddress(address).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">From</div>
            <div className="text-sm font-medium font-mono truncate">{formatAddress(address)}</div>
          </div>
        </div>

        <Field label="Recipient wallet or contact">
          <div className="flex gap-2">
            <Input
              placeholder="GAB…XYZ or @username"
              className="flex-1"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <button className="grid h-12 w-12 place-items-center rounded-xl bg-surface hairline">
              <QrCode className="h-5 w-5" />
            </button>
          </div>
        </Field>
        <Field label="Amount (USDC)">
          <Input
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Memo (optional)">
          <Input
            placeholder="What's this for?"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </Field>
        <div className="rounded-xl bg-surface hairline p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network fee</span>
            <span className="tabular">0.00001 XLM</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Arrives in</span>
            <span>~5 seconds</span>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/30 p-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <p className="text-xs">Payment sent successfully!</p>
          </div>
        ) : null}

        <Button onClick={handleSend} disabled={sending || success}>
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            "Confirm & send"
          )}
        </Button>
      </ScreenBody>
    </>
  );
}
