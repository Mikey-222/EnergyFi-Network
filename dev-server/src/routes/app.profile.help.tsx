import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ScreenHeader, ScreenBody, Card, Input, Button } from "@/components/energyfi/ui";
import { Search, ChevronDown, LifeBuoy, Bug, CheckCircle2, Clipboard } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";

export const Route = createFileRoute("/app/profile/help")({ component: H });

type Faq = { q: string; a: string };

const faqs: Faq[] = [
  {
    q: "What is EnergyFi?",
    a: "A demo fintech app on the Stellar testnet: a savings pool (deposit USDC, earn interest from loan repayments), neighbourhood loans (borrow, repay monthly), and referrals (invite neighbours, earn 0.0001). Everything uses testnet tokens with no real value.",
  },
  {
    q: "How do I get testnet USDC or EURC?",
    a: "Use the official Circle faucet (faucet.circle.com) → USDC or EURC → Stellar Testnet → your wallet address. For XLM (transaction fees), friendbot at friendbot.stellar.org funds any address — or connect in Freighter, which offers one-tap testnet funding.",
  },
  {
    q: "How does savings work?",
    a: "Go to Wallet → Savings (or Market → Lend). Deposit 1+ USDC and you receive pool tokens at 1 USDC each. Loan repayments are deposited into the pool as revenue and distributed pro-rata to token holders — claim your share as dividends any time from the savings page.",
  },
  {
    q: "How do I take a loan?",
    a: "Market → Borrow → pick a product (50–500 USDC). Sign the financing agreement, then the administrator disburses the principal to your wallet from the loan escrow. Repay in 12 monthly installments; total repayment is roughly the principal plus 10% flat.",
  },
  {
    q: "What happens if I miss an installment?",
    a: "Nothing automated — this demo has no late fees or penalties. The installment stays payable and the loan keeps showing as active.",
  },
  {
    q: "Why is my referral reward still pending?",
    a: "Referral rewards are usage-gated. An invite pays 0.0001 USDC (or EURC) to both sides only after the referee confirms app usage with their own wallet — automatically after their first savings or loan action, or via the 'Unlock my reward' button on Refer & earn.",
  },
  {
    q: "How many people can I refer?",
    a: "Max 5 invites per wallet. Self-referrals are rejected, and each wallet can only be referred once — the first referrer wins.",
  },
  {
    q: "How do I see my transactions?",
    a: "Wallet → 'View all' opens your full payment history, read live from the Stellar network. Tap any transaction for details and a StellarExpert explorer link. Contract-internal calls (like fee transfers) are filtered out of the list.",
  },
  {
    q: "What is the admin console?",
    a: "The owner wallet (the deploy account) sees Profile → Admin console: live pool balances, stats, pool funding actions, and claiming the 1% platform fee accrued on provider withdrawals. The entry is hidden for every other address.",
  },
  {
    q: "Is this real money?",
    a: "No. The app runs entirely on the Stellar testnet with testnet USDC/EURC from Circle's faucet — it has no monetary value. Never send real assets to any address shown in this app.",
  },
];

function H() {
  const { address } = useWallet();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [query]);

  const report = () => {
    navigator.clipboard?.writeText(
      `EnergyFi debug info\nNetwork: Stellar testnet\nWallet: ${address ?? "not connected"}\nReported: ${new Date().toISOString()}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <ScreenHeader back="/app/profile" title="Help & support" />
      <ScreenBody>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search help articles"
            className="pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Card className="p-0 divide-y divide-white/5">
          {visible.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No articles match "{query}". Try a different word.
            </div>
          )}
          {visible.map((f) => {
            const isOpen = open === f.q;
            return (
              <div key={f.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : f.q)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <span className="text-sm font-medium">{f.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <p className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">{f.a}</p>
                )}
              </div>
            );
          })}
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <LifeBuoy className="h-4 w-4 text-primary" /> Still stuck?
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-foreground/80">
            <li>• Connect with Freighter — it works best on testnet.</li>
            <li>• Make sure your wallet has a little XLM for transaction fees.</li>
            <li>• Fund USDC/EURC from the Circle faucet, then refresh the app.</li>
            <li>• Balances and history are read live from the network — reconnect if stale.</li>
          </ul>
        </Card>

        <Button variant="ghost" onClick={report}>
          {copied ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" /> Debug info copied
            </>
          ) : (
            <>
              <Bug className="h-4 w-4" /> Report a problem
            </>
          )}
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">
          This is a testnet demo — support is best-effort. The report button copies your wallet
          address and network details for a bug report.
        </p>
        {copied && (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/30 p-3 text-xs text-success">
            <Clipboard className="h-4 w-4 shrink-0" /> Paste the copied debug info into your report.
          </div>
        )}
      </ScreenBody>
    </>
  );
}
