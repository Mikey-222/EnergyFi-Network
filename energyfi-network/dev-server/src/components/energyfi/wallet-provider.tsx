import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { stellar } from "@/lib/stellar";
import { connectWallet, disconnectWallet } from "@/lib/energyfi/signer";
import { getBalances, addTrustline, type WalletBalances } from "@/lib/energyfi/tokens";

type WalletContextValue = {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  balances: WalletBalances | null;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
  formatAddress: (address: string) => string;
  explorerLink: (hash: string, type?: "tx" | "account") => string;
  hasTrustline: (code: string) => boolean;
  addTrustline: (code: "USDC" | "EURC") => Promise<string>;
  missingTrustlines: Array<"USDC" | "EURC">;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    walletName: string;
    resolve: (approved: boolean) => void;
  } | null>(null);

  const refreshBalances = useCallback(async () => {
    if (!address) return;
    try {
      const b = await getBalances(address);
      setBalances(b);
    } catch (err) {
      console.error("Failed to load balances:", err);
      setBalances(null);
    }
  }, [address]);

  // Load balances when address changes
  useEffect(() => {
    if (address) {
      refreshBalances();
    } else {
      setBalances(null);
    }
  }, [address, refreshBalances]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const addr = await connectWallet({
        onWalletChosen: ({ name }) =>
          new Promise<boolean>((resolve) => {
            setPendingApproval({ walletName: name, resolve });
          }),
      });
      if (addr) {
        setAddress(addr);
        refreshBalances();
      }
      return addr;
    } catch (err) {
      const msg = (err instanceof Error ? err.message : undefined) ?? "Wallet connection failed";
      setError(msg);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalances]);

  const disconnect = useCallback(() => {
    try {
      disconnectWallet();
      stellar.disconnect();
    } catch {
      // ignore
    }
    setAddress(null);
    setBalances(null);
    setError(null);
  }, []);

  const formatAddress = useCallback((addr: string) => stellar.formatAddress(addr), []);

  const explorerLink = useCallback(
    (hash: string, type?: "tx" | "account") => stellar.getExplorerLink(hash, type),
    [],
  );

  const hasTrustline = useCallback(
    (code: string) => {
      if (code === "USDC") return balances?.usdc !== undefined;
      if (code === "EURC") return balances?.eurc !== undefined;
      return false;
    },
    [balances],
  );

  const missingTrustlines = useMemo(() => {
    const missing: Array<"USDC" | "EURC"> = [];
    if (balances?.usdc === undefined) missing.push("USDC");
    if (balances?.eurc === undefined) missing.push("EURC");
    return missing;
  }, [balances]);

  const addTrustlineFn = useCallback(
    async (code: "USDC" | "EURC") => {
      if (!address) throw new Error("Wallet not connected");
      const hash = await addTrustline(address, code);
      await refreshBalances();
      return hash;
    },
    [address, refreshBalances],
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnecting,
        error,
        balances,
        connect,
        disconnect,
        refreshBalances,
        formatAddress,
        explorerLink,
        hasTrustline,
        addTrustline: addTrustlineFn,
        missingTrustlines,
      }}
    >
      {children}

      {pendingApproval && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-surface hairline p-6 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full energy-gradient glow-energy">
              <svg
                className="h-6 w-6 text-background"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
            <h3 className="font-semibold font-display">Approve connection</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Approve the connection with{" "}
              <span className="text-foreground font-medium">{pendingApproval.walletName}</span> to
              link your wallet to EnergyFi.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  pendingApproval.resolve(false);
                  setPendingApproval(null);
                }}
                className="h-11 rounded-xl bg-surface-2 hairline text-sm font-medium hover:brightness-110"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  pendingApproval.resolve(true);
                  setPendingApproval(null);
                }}
                className="h-11 rounded-xl energy-gradient glow-energy text-sm font-semibold text-background hover:brightness-110"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}
