// Single shared Stellar Wallets Kit instance so the wallet picked in the
// connect modal is the one used for contract signing too.
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";
import { NETWORK } from "./config";

let kit: StellarWalletsKit | null = null;

export function getKit(): StellarWalletsKit {
  if (typeof window === "undefined") {
    throw new Error("StellarWalletsKit can only be used in the browser");
  }
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return kit;
}

// NOTE: stellar-wallets-kit v1.2.2's openModal() resolves immediately — it does
// NOT await the user's wallet selection. getAddress() must be called from
// inside onWalletSelected, otherwise it fires instantly on the default wallet
// (auto-connect) and the choices modal never closes.
//
// `onWalletChosen` lets the UI show an explicit approval step between picking
// a wallet and calling getAddress(). Returning false aborts the connection.
export function connectWallet(options?: {
  onWalletChosen?: (wallet: { id: string; name: string }) => Promise<boolean>;
}): Promise<string> {
  const k = getKit();
  return new Promise<string>((resolve, reject) => {
    k.openModal({
      onWalletSelected: async (option) => {
        k.setWallet(option.id);
        try {
          if (options?.onWalletChosen) {
            const approved = await options.onWalletChosen({
              id: option.id,
              name: option.name,
            });
            if (!approved) {
              reject(new Error("Connection cancelled"));
              return;
            }
          }
          const { address } = await k.getAddress();
          if (address) {
            resolve(address);
          } else {
            reject(new Error("No wallet address returned"));
          }
        } catch (err) {
          reject(
            new Error(
              (err instanceof Error ? err.message : undefined) ?? "Wallet connection failed",
            ),
          );
        }
      },
      onClosed: () => reject(new Error("Wallet modal closed")),
    });
  });
}

/** Sign a transaction XDR with the wallet selected in the connect modal. */
export async function signTransactionXdr(
  txXdr: string,
  opts?: { networkPassphrase?: string },
): Promise<{ signedTxXdr: string }> {
  const k = getKit();
  const res = await k.signTransaction(txXdr, {
    networkPassphrase: opts?.networkPassphrase ?? NETWORK.networkPassphrase,
  });
  if (!res.signedTxXdr) {
    throw new Error("Wallet returned no signature");
  }
  return { signedTxXdr: res.signedTxXdr };
}

export function disconnectWallet(): void {
  try {
    getKit().disconnect();
  } catch {
    // ignore
  }
}
