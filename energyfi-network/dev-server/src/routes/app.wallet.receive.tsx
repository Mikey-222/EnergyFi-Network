import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { Copy, Share2, Wallet as WalletIcon } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";

export const Route = createFileRoute("/app/wallet/receive")({ component: Receive });

function Receive() {
  const { address, isConnecting, connect, formatAddress } = useWallet();
  const displayAddress = address ?? "GABC4X5J7K3L9MPQR2ST8UV6WXYZ9";

  return (
    <>
      <ScreenHeader back="/app/wallet" title="Receive USDC" bell={false} />
      <ScreenBody>
        {!address ? (
          <div className="rounded-2xl bg-surface hairline p-5 flex flex-col items-center text-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <WalletIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="text-sm font-semibold">Connect your wallet to receive</div>
              <div className="text-xs text-muted-foreground mt-1">
                You need a connected Stellar wallet to share your receive address.
              </div>
            </div>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="rounded-xl energy-gradient glow-energy px-4 h-10 text-sm font-semibold text-background disabled:opacity-60"
            >
              {isConnecting ? "Connecting…" : "Connect wallet"}
            </button>
            <Link to="/app/wallet" className="text-xs text-primary">
              Back to wallet
            </Link>
          </div>
        ) : (
          <>
            <Card className="flex flex-col items-center">
              <div className="grid h-56 w-56 place-items-center rounded-2xl bg-white p-4">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  {Array.from({ length: 100 }).map((_, i) => {
                    const x = (i % 10) * 10;
                    const y = Math.floor(i / 10) * 10;
                    const filled = Math.random() > 0.45;
                    return filled ? (
                      <rect key={i} x={x} y={y} width="10" height="10" fill="#0A0F14" />
                    ) : null;
                  })}
                  <rect x="0" y="0" width="30" height="30" fill="#0A0F14" />
                  <rect x="5" y="5" width="20" height="20" fill="white" />
                  <rect x="10" y="10" width="10" height="10" fill="#0A0F14" />
                  <rect x="70" y="0" width="30" height="30" fill="#0A0F14" />
                  <rect x="75" y="5" width="20" height="20" fill="white" />
                  <rect x="80" y="10" width="10" height="10" fill="#0A0F14" />
                  <rect x="0" y="70" width="30" height="30" fill="#0A0F14" />
                  <rect x="5" y="75" width="20" height="20" fill="white" />
                  <rect x="10" y="80" width="10" height="10" fill="#0A0F14" />
                </svg>
              </div>
              <div className="mt-4 font-mono text-xs text-center break-all max-w-full">
                {displayAddress}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {address ? formatAddress(address) : ""}
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                onClick={() => navigator.clipboard?.writeText(displayAddress)}
              >
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button
                onClick={() =>
                  navigator.share?.({ title: "My EnergyFi address", text: displayAddress })
                }
              >
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
          </>
        )}
      </ScreenBody>
    </>
  );
}
