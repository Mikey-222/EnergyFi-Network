import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PhoneFrame, ScreenHeader, ScreenBody, Button } from "@/components/energyfi/ui";
import {
  Wallet as WalletIcon,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";

export const Route = createFileRoute("/onboarding/wallet-creation")({ component: WalletCreation });

function WalletCreation() {
  const nav = useNavigate();
  const { connect, address, isConnecting, error, formatAddress } = useWallet();
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    const addr = await connect();
    if (addr) {
      setConnected(true);
      // Small delay so the user sees the success state before entering the app
      setTimeout(() => nav({ to: "/app" }), 1200);
    }
  };

  return (
    <PhoneFrame>
      <ScreenHeader title="Connect your wallet" bell={false} />
      <ScreenBody className="flex flex-col items-center text-center">
        <div className="my-8 grid h-24 w-24 place-items-center rounded-3xl money-gradient glow-money">
          <WalletIcon className="h-10 w-10 text-background" />
        </div>
        <h2 className="text-xl font-semibold font-display">Connect an external wallet</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          EnergyFi works with your own Stellar wallet. Connect Freighter, Albedo, xBull or any
          supported wallet to continue.
        </p>

        {address && connected ? (
          <div className="mt-8 w-full rounded-xl bg-success/10 border border-success/30 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            <div className="text-left">
              <div className="text-sm font-medium">Wallet connected</div>
              <div className="text-xs text-muted-foreground font-mono">
                {formatAddress(address)}
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 w-full rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-left">{error}</p>
          </div>
        ) : null}

        <div className="mt-auto w-full space-y-2 pt-8">
          <Button onClick={handleConnect} disabled={isConnecting || connected}>
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Opening wallet…
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" /> Connect wallet
              </>
            )}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Your keys stay in your wallet. EnergyFi never sees your secret phrase.
          </p>
        </div>
      </ScreenBody>
    </PhoneFrame>
  );
}
