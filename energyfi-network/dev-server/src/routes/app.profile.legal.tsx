import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card } from "@/components/energyfi/ui";
import {
  FileText,
  Scale,
  Gavel,
  TrendingDown,
  ShieldCheck,
  ScrollText,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/app/profile/legal")({
  component: L,
  validateSearch: (search: Record<string, unknown>): { doc?: string } => ({
    doc: typeof search.doc === "string" ? search.doc : undefined,
  }),
});

type LegalSection = { heading: string; body: string[] };

type LegalDoc = {
  id: string;
  title: string;
  icon: LucideIcon;
  updated: string;
  sections: LegalSection[];
};

const docs: LegalDoc[] = [
  {
    id: "terms",
    title: "Terms of Service",
    icon: Scale,
    updated: "6 Aug 2026",
    sections: [
      {
        heading: "What this is",
        body: [
          "EnergyFi is a demonstration fintech app running entirely on the Stellar testnet. The USDC and EURC used are testnet tokens with no monetary value.",
          "The app provides three services: a community savings pool (project contract), neighbourhood loans (installments contract) and a referral program (referral contract).",
        ],
      },
      {
        heading: "Your wallet",
        body: [
          "You must own and control the Stellar wallet you connect. All actions are signed from your wallet; EnergyFi never holds or can move your funds.",
          "Transactions you submit are public on the Stellar network by design and cannot be undone by the app.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Contract-level limits protect the demo: max 5 referrals per wallet, no self-referrals, and referral rewards require confirmed app usage (see Referral Terms).",
          "This demo may change or be reset at any time; testnet balances may disappear.",
        ],
      },
    ],
  },
  {
    id: "referral",
    title: "Referral Terms",
    icon: Gavel,
    updated: "6 Aug 2026",
    sections: [
      {
        heading: "How it works",
        body: [
          "Inviting a neighbour records a pending invite — nothing is paid at that point. Registering wallet addresses alone earns nothing.",
          "The reward unlocks only after the referee confirms app usage with their own wallet signature: automatically after their first real flow (save, take a loan, pay an installment), or via the 'Unlock my reward' button on the Refer & earn page.",
        ],
      },
      {
        heading: "Reward",
        body: [
          "0.0001 USDC or 0.0001 EURC is paid to BOTH the referrer and the referee, once, in the currency of the invite.",
          "Rewards are paid from the on-chain pool funded by EnergyFi. If a pool is underfunded, the claim fails and the invite stays pending.",
        ],
      },
      {
        heading: "Limits",
        body: [
          "Max 5 invites per wallet. One referrer per wallet (first invite wins). Self-referrals are rejected by the contract.",
        ],
      },
    ],
  },
  {
    id: "financing",
    title: "Financing Agreement Template",
    icon: FileText,
    updated: "6 Aug 2026",
    sections: [
      {
        heading: "Loan terms",
        body: [
          "Each product fixes the principal, a monthly installment and a term of 12 months. Total repayment is approximately the principal plus 10% flat.",
          "The principal is disbursed from the loan escrow to the borrower's wallet by the administrator (disburse_loan); the borrower repays through monthly installments (pay_installment).",
          "No down payment is required. This demo has no collateral or late-payment penalties.",
        ],
      },
      {
        heading: "Platform fee",
        body: [
          "Provider withdrawals from the pool carry a 1% platform fee. Fees accrue in the contract's FeePool ledger and are claimed by the administrator through the admin console.",
          "Borrower funds are never used for fees — only provider withdrawals are charged.",
        ],
      },
    ],
  },
  {
    id: "investment",
    title: "Investment Risk Disclosure",
    icon: TrendingDown,
    updated: "6 Aug 2026",
    sections: [
      {
        heading: "Savings pool",
        body: [
          "Depositing into the savings pool buys pool tokens at 1 USDC each (project contract). Token value tracks the pool's USDC balance — there is no guaranteed return.",
          "Interest comes from loan repayments deposited into the pool as revenue and is distributed pro-rata to token holders. You can claim your share at any time (claim dividends).",
        ],
      },
      {
        heading: "Risks",
        body: [
          "This is a testnet demo, not an investment product. Pools can be drained or underfunded, and value can decrease.",
          "Nothing here is financial advice. Do not send real assets to any address shown in this app.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    icon: ShieldCheck,
    updated: "6 Aug 2026",
    sections: [
      {
        heading: "What we store",
        body: [
          "EnergyFi runs entirely in your browser — there is no server collecting personal data.",
          "Your profile (name, language, currency) is stored in your browser's local storage, keyed by wallet address.",
        ],
      },
      {
        heading: "What is public",
        body: [
          "Your wallet address and transactions are public on the Stellar network by design; the app reads them through Horizon to show balances and activity.",
          "We never receive or store your secret keys. Signing happens inside your wallet (e.g. Freighter).",
        ],
      },
    ],
  },
  {
    id: "licences",
    title: "Third-party licences",
    icon: ScrollText,
    updated: "6 Aug 2026",
    sections: [
      {
        heading: "Open-source software",
        body: [
          "This app builds on open-source projects: Stellar SDK & Soroban contracts (Apache-2.0), @stellar/stellar-wallets-kit, React, Vite, TanStack Router, Tailwind CSS (MIT), lucide icons (ISC), and the Soroban Rust framework.",
          "The official Circle USDC and EURC Stellar Asset Contracts used on testnet are third-party smart contracts provided by Circle.",
        ],
      },
      {
        heading: "Disclaimer",
        body: [
          "Licences and dependencies may change between versions; see package.json and Cargo.toml for the exact set used by this build.",
        ],
      },
    ],
  },
];

function L() {
  const { doc } = useSearch({ from: "/app/profile/legal" });
  const selected = docs.find((d) => d.id === doc) ?? null;

  if (selected) {
    const Icon = selected.icon;
    return (
      <>
        <header className="flex items-center gap-3 px-5 pt-4 pb-3">
          <Link
            to="/app/profile/legal"
            search={{ doc: undefined }}
            className="grid h-9 w-9 place-items-center rounded-full bg-surface hairline text-foreground hover:bg-surface-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold font-display truncate">{selected.title}</h1>
          </div>
        </header>
        <ScreenBody>
          <Card>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{selected.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  Updated {selected.updated} · testnet demo
                </div>
              </div>
            </div>
          </Card>
          {selected.sections.map((s) => (
            <Card key={s.heading}>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {s.heading}
              </div>
              <div className="mt-2 space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-xs leading-relaxed text-foreground/80">
                    {p}
                  </p>
                ))}
              </div>
            </Card>
          ))}
          <p className="text-[11px] text-muted-foreground text-center">
            EnergyFi is a demo on Stellar testnet — nothing here is real money or financial advice.
          </p>
        </ScreenBody>
      </>
    );
  }

  return (
    <>
      <ScreenHeader back="/app/profile" title="Legal" bell={false} />
      <ScreenBody>
        <Card className="space-y-1">
          {docs.map((d) => {
            const Icon = d.icon;
            return (
              <Link
                key={d.id}
                to="/app/profile/legal"
                search={{ doc: d.id }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-surface hairline text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{d.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.sections[0].heading} · updated {d.updated}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            );
          })}
        </Card>
        <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 hairline border-amber-500/30 p-4">
          <ArrowLeft className="h-4 w-4 text-amber-300 shrink-0" />
          <p className="text-[11px] text-amber-200/80">
            All contracts run on the Stellar testnet — testnet tokens have no real value. Use the
            official Circle faucet, never send real assets.
          </p>
        </div>
      </ScreenBody>
    </>
  );
}
