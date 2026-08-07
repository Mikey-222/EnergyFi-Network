import { createFileRoute } from "@tanstack/react-router";
import { ScreenHeader, ScreenBody, Card, Button } from "@/components/energyfi/ui";
import { Building2, CreditCard, Plus, Trash2 } from "lucide-react";
export const Route = createFileRoute("/app/profile/payment-methods")({ component: PM });
function PM() {
  return (
    <>
      <ScreenHeader back="/app/profile" title="Payment methods" />
      <ScreenBody>
        {[
          { icon: Building2, name: "GTBank", sub: "•••• 4421" },
          { icon: CreditCard, name: "Visa debit", sub: "•••• 9082 · Exp 04/28" },
        ].map((m) => (
          <Card key={m.name} className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <m.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.sub}</div>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-destructive/15 text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
        <Button variant="ghost">
          <Plus className="h-4 w-4" /> Add payment method
        </Button>
      </ScreenBody>
    </>
  );
}
