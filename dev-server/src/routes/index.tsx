import { createFileRoute, Link } from "@tanstack/react-router";
import { PiggyBank, ArrowRight, Smartphone, HandCoins, Users } from "lucide-react";
import { REFERRAL } from "@/lib/energyfi/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EnergyFi — Save, borrow & grow together" },
      {
        name: "description",
        content:
          "A community credit pool on Stellar: savings that earn interest, neighbourhood loans, and referral rewards. Every transaction on-chain.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen night-bg grid-lines">
      <div className="mx-auto max-w-5xl px-6 pt-20 pb-24">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl energy-gradient glow-energy">
            <PiggyBank className="h-5 w-5 text-background" />
          </div>
          <div className="text-lg font-semibold font-display">EnergyFi</div>
        </div>

        <div className="mt-20 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
            Fintech app · Testnet prototype
          </p>
          <h1 className="mt-4 text-5xl font-semibold font-display leading-[1.05]">
            Save, borrow and grow.
            <br />
            <span className="bg-gradient-to-r from-primary to-[color:var(--energy-glow)] bg-clip-text text-transparent">
              Your money, in your community.
            </span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground max-w-lg">
            A community credit pool on Stellar. Deposit savings that earn interest from loan
            repayments, borrow from the same pool, and earn {REFERRAL.rewardUsd} USDC or EURC for
            every neighbour you refer. Fully on-chain, fully navigable.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/onboarding/splash"
              className="inline-flex items-center gap-2 rounded-xl energy-gradient glow-energy px-5 h-12 text-sm font-semibold text-background"
            >
              <Smartphone className="h-4 w-4" /> Start onboarding <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-xl bg-surface hairline px-5 h-12 text-sm font-semibold text-foreground hover:bg-surface-2"
            >
              Skip to app home
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { t: "7", l: "Onboarding screens", icon: Smartphone },
            { t: "36", l: "In-app screens across 5 tabs", icon: HandCoins },
            { t: "4", l: "Live contracts on Stellar testnet", icon: Users },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-surface hairline p-5">
              <s.icon className="h-5 w-5 text-primary" />
              <div className="mt-3 text-3xl font-semibold font-display tabular">{s.t}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
