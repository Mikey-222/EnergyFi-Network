import { createFileRoute } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, ListRow, Button } from "@/components/energyfi/ui";
import {
  KeyRound,
  FileKey,
  Smartphone,
  Eye,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";

export const Route = createFileRoute("/app/wallet/security")({ component: Sec });

function Sec() {
  const { address, isConnecting, connect, disconnect, explorerLink } = useWallet();

  return (
    <>
      <ScreenHeader back="/app/wallet" title="Wallet & security" bell={false} />
      <ScreenBody>
        <div className="flex items-start gap-3 rounded-xl bg-warning/10 border border-warning/30 p-3.5">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
          <p className="text-xs">
            Your wallet is managed by your external Stellar wallet. EnergyFi never stores your
            recovery phrase or secret key.
          </p>
        </div>

        <div className="rounded-2xl bg-surface hairline p-4">
          {address ? (
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Wallet connected</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{address}</div>
              </div>
              {address.startsWith("G") && (
                <a
                  href={explorerLink(address, "account")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="text-sm font-medium">No wallet connected</div>
              <div className="text-xs text-muted-foreground mt-1 mb-3">
                Connect your external Stellar wallet to enable payments.
              </div>
              <Button onClick={connect} disabled={isConnecting} className="!w-auto px-5">
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <ListRow
            icon={<Eye className="h-4 w-4" />}
            title="Manage wallet in app"
            subtitle="Freighter / Albedo / xBull"
          />
          <ListRow
            icon={<FileKey className="h-4 w-4" />}
            title="Export secret key"
            subtitle="Handled by your external wallet"
          />
          <ListRow
            icon={<KeyRound className="h-4 w-4" />}
            title="Change wallet PIN"
            subtitle="Set in your wallet app"
          />
          <ListRow
            icon={<Smartphone className="h-4 w-4" />}
            title="Connected devices"
            subtitle="2 active"
          />
        </div>

        {address && (
          <Button variant="destructive" onClick={disconnect}>
            Disconnect wallet
          </Button>
        )}
      </ScreenBody>
    </>
  );
}
