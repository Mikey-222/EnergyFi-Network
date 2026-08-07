import { createFileRoute } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card } from "@/components/energyfi/ui";
import { Check } from "lucide-react";
import { useProfile, setProfile } from "@/lib/energyfi/profile";
import { LANG_OPTIONS } from "@/lib/energyfi/i18n";
import { useWallet } from "@/components/energyfi/wallet-provider";

export const Route = createFileRoute("/app/profile/language")({ component: L });

const CURRENCIES = [
  { key: "USDC", label: "USDC (stablecoin)" },
  { key: "EURC", label: "EURC (stablecoin)" },
];

function L() {
  const { address } = useWallet();
  const profile = useProfile(address);

  const setLanguage = (language: string) => {
    if (!address) return;
    setProfile(address, { ...profile, language });
  };

  const setCurrency = (currency: string) => {
    if (!address) return;
    setProfile(address, { ...profile, currency });
  };

  return (
    <>
      <ScreenHeader back="/app/profile" title="Language & currency" />
      <ScreenBody>
        <Card>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Language
          </div>
          <div className="divide-y divide-white/5">
            {LANG_OPTIONS.map((o) => {
              const sel = profile.language === o.code;
              return (
                <button
                  key={o.code}
                  onClick={() => setLanguage(o.code)}
                  className="flex w-full items-center justify-between py-3 text-sm hover:text-foreground"
                >
                  <span className={sel ? "font-medium" : ""}>{o.label}</span>
                  {sel && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Display currency
          </div>
          <div className="divide-y divide-white/5">
            {CURRENCIES.map((c) => {
              const sel = profile.currency === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setCurrency(c.key)}
                  className="flex w-full items-center justify-between py-3 text-sm hover:text-foreground"
                >
                  <span className={sel ? "font-medium" : ""}>{c.label}</span>
                  {sel && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </Card>
        <p className="px-1 text-[11px] text-muted-foreground">
          Saved to this wallet — your language and display currency.
        </p>
      </ScreenBody>
    </>
  );
}
