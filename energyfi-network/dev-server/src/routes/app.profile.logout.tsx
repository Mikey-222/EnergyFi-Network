import { createFileRoute, Link } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { LogOut, AlertTriangle } from "lucide-react";
import { useWallet } from "@/components/energyfi/wallet-provider";
export const Route = createFileRoute("/app/profile/logout")({ component: Out });
function Out() {
  const { disconnect } = useWallet();
  const handleLogout = () => {
    disconnect();
  };
  return (
    <>
      <ScreenHeader back="/app/profile" title="Log out" />
      <ScreenBody>
        <Card className="text-center">
          <LogOut className="h-12 w-12 text-primary mx-auto" />
          <div className="mt-2 text-lg font-semibold font-display">Log out of EnergyFi?</div>
          <div className="text-xs text-muted-foreground">
            Your connected Stellar wallet will be disconnected. You'll need your PIN or biometrics
            to sign back in.
          </div>
        </Card>
        <Button as={Link} to="/onboarding/splash" onClick={handleLogout}>
          Log out
        </Button>
        <div className="pt-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Danger zone
          </div>
          <Card>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-xs">
                Deleting your account permanently removes your profile. Your active financing
                contract must be paid off or transferred first.
              </div>
            </div>
            <Button variant="destructive" className="mt-4">
              Delete my account
            </Button>
          </Card>
        </div>
      </ScreenBody>
    </>
  );
}
