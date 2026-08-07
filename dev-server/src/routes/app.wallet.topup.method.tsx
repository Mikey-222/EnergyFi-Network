import { createFileRoute } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody } from "@/components/energyfi/ui";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { CIRCE_FAUCET_URL } from "@/lib/energyfi/config";
import { ExternalLink, Info } from "lucide-react";

export const Route = createFileRoute("/app/wallet/topup/method")({ component: Method });

function Method() {
  const { missingTrustlines, addTrustline } = useWallet();
  return (
    <>
      <ScreenHeader back="/app/wallet" title="Get testnet USDC" bell={false} />
      <ScreenBody>
        <p className="text-sm text-muted-foreground">
          EnergyFi runs on the Stellar testnet. Get free testnet USDC from the Circle faucet, then
          spend it on credits, financing and investments.
        </p>
        <a
          href={CIRCE_FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl energy-gradient glow-energy p-4 text-background font-semibold"
        >
          <ExternalLink className="h-5 w-5" />
          <span className="flex-1">Open Circle faucet (testnet)</span>
        </a>
        <div className="rounded-xl bg-surface hairline p-4 flex gap-3 items-start">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            Select <b>USDC → Stellar Testnet</b>, enter your wallet address (shown on the wallet
            tab), and press Send. Your balance updates within a minute.
          </div>
        </div>
        {missingTrustlines.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
            <div className="text-xs font-semibold mb-2">
              Before receiving tokens, add these trustlines:
            </div>
            <div className="flex flex-wrap gap-2">
              {missingTrustlines.map((c) => (
                <button
                  key={c}
                  onClick={() => addTrustline(c).catch((e) => alert(e?.message ?? "Failed"))}
                  className="rounded-full bg-amber-500/20 px-3 py-1.5 text-xs font-semibold"
                >
                  Add {c} trustline
                </button>
              ))}
            </div>
          </div>
        )}
      </ScreenBody>
    </>
  );
}
