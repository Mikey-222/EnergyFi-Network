import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Field, Input, Button } from "@/components/energyfi/ui";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useProfile, setProfile, initialsOf } from "@/lib/energyfi/profile";
import { useWallet } from "@/components/energyfi/wallet-provider";

export const Route = createFileRoute("/app/profile/edit")({ component: Edit });

function Edit() {
  const { address } = useWallet();
  const profile = useProfile(address);
  const navigate = useNavigate();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length >= 2;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const save = () => {
    if (!address) {
      setError("Connect your wallet before saving profile details.");
      setStatus("error");
      return;
    }
    if (!nameOk) {
      setError("Enter your full name (at least 2 characters).");
      setStatus("error");
      return;
    }
    if (!emailOk) {
      setError("Enter a valid email address.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    setProfile(address, {
      ...profile,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    setStatus("saved");
    setTimeout(() => navigate({ to: "/app/profile" }), 900);
  };

  return (
    <>
      <ScreenHeader back="/app/profile" title="Edit profile" />
      <ScreenBody>
        <div className="flex justify-center py-4">
          <div className="relative">
            <div className="grid h-24 w-24 place-items-center rounded-full energy-gradient text-background text-2xl font-semibold">
              {initialsOf(name)}
            </div>
            <button className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-surface hairline text-xs">
              Edit
            </button>
          </div>
        </div>
        <Field label="Full name" hint="Shown on your profile and in the app greeting.">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
          />
        </Field>
        <Field label="Email">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Phone" hint="Changing this requires re-verification.">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 ..." />
        </Field>
        {status === "error" && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
            {error}
          </div>
        )}
        {status === "saved" && (
          <div className="flex items-center gap-2 rounded-xl bg-success/15 border border-success/30 p-3 text-xs text-success">
            <CheckCircle2 className="h-4 w-4" /> Saved — your details are updated everywhere.
          </div>
        )}
        <Button onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save changes"}
        </Button>
      </ScreenBody>
    </>
  );
}
