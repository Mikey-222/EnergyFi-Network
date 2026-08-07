import { createFileRoute } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card } from "@/components/energyfi/ui";
import { useProfile, setProfile, type NotificationPrefs } from "@/lib/energyfi/profile";
import { useWallet } from "@/components/energyfi/wallet-provider";

export const Route = createFileRoute("/app/profile/notifications")({ component: N });

type Group = {
  key: keyof NotificationPrefs;
  title: string;
  channels: { key: string; label: string }[];
};

const GROUPS: Group[] = [
  {
    key: "payments",
    title: "Payments",
    channels: [
      { key: "push", label: "Push" },
      { key: "sms", label: "SMS" },
      { key: "email", label: "Email" },
    ],
  },
  {
    key: "loans",
    title: "Loan alerts",
    channels: [
      { key: "push", label: "Push" },
      { key: "sms", label: "SMS" },
      { key: "email", label: "Email" },
    ],
  },
  {
    key: "savings",
    title: "Savings updates",
    channels: [
      { key: "push", label: "Push" },
      { key: "email", label: "Email" },
    ],
  },
  { key: "promotions", title: "Promotions", channels: [{ key: "push", label: "Push" }] },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`h-6 w-11 rounded-full relative transition-colors ${on ? "bg-primary" : "bg-white/10"}`}
    >
      <div
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "right-0.5" : "left-0.5"}`}
      />
    </button>
  );
}

function N() {
  const { address } = useWallet();
  const profile = useProfile(address);

  const toggle = (group: keyof NotificationPrefs, channel: string) => {
    if (!address) return;
    const prefs = profile.notifications[group] as Record<string, boolean>;
    setProfile(address, {
      ...profile,
      notifications: {
        ...profile.notifications,
        [group]: { ...prefs, [channel]: !prefs[channel] },
      },
    });
  };

  return (
    <>
      <ScreenHeader back="/app/profile" title="Notifications" />
      <ScreenBody>
        {GROUPS.map((g) => (
          <Card key={g.key}>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {g.title}
            </div>
            <div className="divide-y divide-white/5">
              {g.channels.map((c) => (
                <div key={c.key} className="flex items-center justify-between py-3">
                  <span className="text-sm">{c.label}</span>
                  <Toggle
                    on={(profile.notifications[g.key] as Record<string, boolean>)[c.key]}
                    onToggle={() => toggle(g.key, c.key)}
                  />
                </div>
              ))}
            </div>
          </Card>
        ))}
        <p className="px-1 text-[11px] text-muted-foreground">
          Preferences are saved on this device and applied to future EnergyFi notifications.
        </p>
      </ScreenBody>
    </>
  );
}
