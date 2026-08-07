import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { PhoneFrame, Button, StepDots, Sparkline } from "@/components/energyfi/ui";
import { PiggyBank, Coins, Zap, TrendingUp } from "lucide-react";
import { REFERRAL } from "@/lib/energyfi/config";

export const Route = createFileRoute("/onboarding/intro/$step")({ component: Intro });

const slides = [
  {
    icon: PiggyBank,
    title: "Save with the neighbourhood",
    body: "Deposit USDC into the community pool and earn interest every time a loan is repaid. Withdraw your interest anytime.",
  },
  {
    icon: Coins,
    title: "Borrow from the same pool",
    body: "Need cash? The principal is paid straight to your wallet, and you repay in simple monthly installments.",
  },
  {
    icon: Zap,
    title: "Powered by Stellar",
    body: "Instant, low-fee payments in USDC and EURC. No banks in the way, no crypto knowledge required.",
  },
  {
    icon: TrendingUp,
    title: "Grow by referring",
    body: `Refer a neighbour and you both earn ${REFERRAL.rewardUsd} USDC or EURC — once the referee uses the app.`,
  },
];

function Intro() {
  const { step } = useParams({ from: "/onboarding/intro/$step" });
  const i = Math.max(0, Math.min(3, parseInt(step, 10) - 1));
  const s = slides[i];
  const Icon = s.icon;
  const nextTo = i < 3 ? `/onboarding/intro/${i + 2}` : "/onboarding/wallet-creation";
  return (
    <PhoneFrame>
      <div className="flex justify-end px-5 pt-2">
        <Link
          to="/onboarding/wallet-creation"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Skip
        </Link>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="grid h-28 w-28 place-items-center rounded-3xl energy-gradient glow-energy mb-8">
          <Icon className="h-12 w-12 text-background" />
        </div>
        {i === 1 && (
          <div className="mb-6">
            <div className="mx-auto h-2 w-56 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-2/3 energy-gradient" />
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">Pool funded 67%</div>
          </div>
        )}
        {i === 3 && (
          <div className="mb-6 w-full max-w-xs rounded-2xl bg-surface hairline p-3">
            <div className="text-xs text-muted-foreground mb-1">Interest paid out · 6 months</div>
            <Sparkline data={[2, 5, 4, 7, 6, 8, 6.5]} />
          </div>
        )}
        <h1 className="text-2xl font-semibold font-display">{s.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">{s.body}</p>
      </div>
      <StepDots total={4} active={i} />
      <div className="px-6 pb-8">
        <Button as={Link} to={nextTo}>
          {i < 3 ? "Continue" : "Get started"}
        </Button>
      </div>
    </PhoneFrame>
  );
}
