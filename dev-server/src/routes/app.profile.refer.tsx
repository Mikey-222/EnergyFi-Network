import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ScreenHeader, ScreenBody, Card, Button, Input } from "@/components/energyfi/ui";
import { Copy, CheckCircle2, Loader2, Users, Wallet, Lock, Gift } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
import { useReferralState } from "@/lib/energyfi/hooks";
import { getReferralClient } from "@/lib/energyfi/contracts";
import { REFERRAL } from "@/lib/energyfi/config";

export const Route = createFileRoute("/app/profile/refer")({ component: R });

function isValidAddress(value: string) {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}

function R() {
  const { address, connect, formatAddress } = useWallet();
  const { referral, loading, refresh } = useReferralState(address);
  const [neighbour, setNeighbour] = useState("");
  const [currency, setCurrency] = useState<"USDC" | "EURC">("USDC");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refer = async () => {
    if (!address || !isValidAddress(neighbour)) return;
    setStatus("sending");
    setError(null);
    try {
      const c = getReferralClient(address);
      const tx = await c.register({
        referrer: address,
        referee: neighbour.trim(),
        currency,
      });
      await tx.signAndSend();
      setNeighbour("");
      setStatus("idle");
      refresh();
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Transaction failed");
      setStatus("error");
    }
  };

  const unlockReward = async () => {
    if (!address || !referral?.myReferrer || !referral.myCurrency) return;
    setUnlockBusy(true);
    setUnlockMsg(null);
    setError(null);
    try {
      const c = getReferralClient(address);
      if (!referral.usageConfirmed) {
        const confirmTx = await c.confirm_usage({ referee: address });
        await confirmTx.signAndSend();
      }
      if (!referral.myInviteClaimed) {
        const claimTx = await c.claim_referral({
          referrer: referral.myReferrer,
          referee: address,
          currency: referral.myCurrency,
        });
        await claimTx.signAndSend();
      }
      setUnlockMsg(
        `Reward unlocked — ${REFERRAL.rewardUsd} ${referral.myCurrency} paid to you and your neighbour.`,
      );
      refresh();
    } catch (err) {
      setError((err instanceof Error ? err.message : undefined) ?? "Transaction failed");
      setStatus("error");
    } finally {
      setUnlockBusy(false);
    }
  };

  const remaining = Math.max(0, REFERRAL.maxPerWallet - (referral?.count ?? 0));
  const pendingReferees = (referral?.referees ?? []).filter((r) => !referral?.claimed[r]);
  const inviteCurrency = referral?.myCurrency ?? currency;

  return (
    <>
      <ScreenHeader back="/app/profile" title="Refer & earn" />
      <ScreenBody>
        <Card className="text-center energy-gradient text-background">
          <Users className="h-10 w-10 mx-auto" />
          <div className="mt-2 text-2xl font-semibold font-display">
            Earn {REFERRAL.rewardUsd} USDC or {REFERRAL.rewardUsd} EURC
          </div>
          <div className="text-xs opacity-80">
            for every neighbour you refer — unlocked for both once they use the app
          </div>
        </Card>

        {!address ? (
          <Card className="text-center">
            <Wallet className="h-6 w-6 text-primary mx-auto" />
            <div className="mt-2 text-sm font-medium">Connect your wallet</div>
            <div className="text-xs text-muted-foreground mt-1">
              Your referral rewards are paid to your Stellar wallet.
            </div>
            <Button className="mt-4" onClick={connect}>
              Connect wallet
            </Button>
          </Card>
        ) : (
          <>
            {referral?.myReferrer && (
              <Card>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Gift className="h-4 w-4 text-primary" /> Your neighbour invite
                </div>
                <div className="mt-2 text-sm font-medium">
                  {formatAddress(referral.myReferrer)} invited you to EnergyFi.
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {referral.myInviteClaimed
                    ? `The ${REFERRAL.rewardUsd} ${inviteCurrency} reward was paid to both wallets.`
                    : referral.usageConfirmed
                      ? "You confirmed app usage. Claim the reward for you and your neighbour now."
                      : `Reward locked: ${REFERRAL.rewardUsd} ${inviteCurrency} for you and your neighbour is only paid after you use the app.`}
                </div>
                {!referral.myInviteClaimed && (
                  <Button className="mt-3" onClick={unlockReward} disabled={unlockBusy}>
                    {unlockBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Unlocking…
                      </>
                    ) : referral.usageConfirmed ? (
                      <>
                        <Gift className="h-4 w-4" /> Claim my reward
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" /> Unlock my reward — I've used the app
                      </>
                    )}
                  </Button>
                )}
                {unlockMsg && (
                  <div className="mt-2 rounded-xl bg-success/10 border border-success/30 p-3 text-xs text-success">
                    {unlockMsg}
                  </div>
                )}
              </Card>
            )}

            <Card>
              <div className="text-xs text-muted-foreground">Refer a neighbour's wallet</div>
              <Input
                className="mt-2 font-mono"
                placeholder="G…"
                value={neighbour}
                onChange={(e) => setNeighbour(e.target.value)}
                disabled={status === "sending"}
              />
              <div className="mt-3 flex gap-2">
                {REFERRAL.currencies.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`flex-1 h-9 rounded-full text-xs font-semibold ${currency === c ? "bg-primary text-background" : "bg-surface hairline"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <Button
                className="mt-3 w-full"
                onClick={refer}
                disabled={!isValidAddress(neighbour) || status === "sending" || remaining === 0}
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending invite…
                  </>
                ) : (
                  `Send invite · ${REFERRAL.rewardUsd} ${currency} × 2 on activation`
                )}
              </Button>
              {!isValidAddress(neighbour) && neighbour.length > 0 && (
                <p className="mt-2 text-[11px] text-destructive">
                  Enter a valid Stellar address starting with G.
                </p>
              )}
              {status === "error" && (
                <div className="mt-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Invites are free. The {REFERRAL.rewardUsd} reward is paid to both wallets only after
                your neighbour confirms app usage.
              </p>
              {remaining === 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground text-center">
                  You've reached the maximum of {REFERRAL.maxPerWallet} referrals per wallet.
                </p>
              )}
            </Card>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [String(referral?.count ?? 0), "Invited"],
                [String(remaining), "Slots left"],
                [`${REFERRAL.rewardUsd} ${currency}`, "Per referral"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-surface hairline p-3">
                  <div className="text-2xl font-semibold tabular">{v}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
                </div>
              ))}
            </div>

            <Card>
              <div className="text-xs text-muted-foreground">Your invites</div>
              {loading ? (
                <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading from Stellar…
                </div>
              ) : (referral?.referees ?? []).length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No invites yet. Each one pays {REFERRAL.rewardUsd} USDC (or EURC) to you and your
                  neighbour once they use the app.
                </div>
              ) : (
                <div className="mt-2 divide-y divide-white/5">
                  {(referral?.referees ?? []).map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <div className="font-mono text-xs">{formatAddress(r)}</div>
                      {referral?.claimed[r] ? (
                        <div className="flex items-center gap-1 text-[11px] text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Lock className="h-3 w-3" /> Waiting for them to use the app
                        </div>
                      )}
                    </div>
                  ))}
                  {pendingReferees.length > 0 && (
                    <p className="pt-2 text-[11px] text-muted-foreground">
                      {pendingReferees.length} invite{pendingReferees.length > 1 ? "s" : ""} still
                      pending — the reward unlocks once the referee confirms app usage.
                    </p>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <div className="text-xs text-muted-foreground">Your referral address</div>
              <button
                className="mt-2 flex w-full items-center justify-between rounded-xl bg-surface hairline p-3 font-mono text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <span className="truncate">{address}</span>
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0" />
                )}
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Share this address with neighbours, or type theirs above. Rewards only unlock after
                the referee uses the app — max {REFERRAL.maxPerWallet} referrals per wallet.
              </p>
            </Card>

            <p className="text-[11px] text-muted-foreground text-center">
              Referral rewards are paid from the pool funded by EnergyFi. See{" "}
              <Link to="/app/profile/legal" className="underline">
                terms
              </Link>
              .
            </p>
          </>
        )}
      </ScreenBody>
    </>
  );
}
