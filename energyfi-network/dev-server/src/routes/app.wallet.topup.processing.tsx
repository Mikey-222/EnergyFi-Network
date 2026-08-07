import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ScreenHeader, ScreenBody } from "@/components/energyfi/ui";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/wallet/topup/processing")({ component: Proc });

function Proc() {
  const nav = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => nav({ to: "/app/wallet/topup/success" }), 2200);
    return () => clearTimeout(t);
  }, [nav]);
  return (
    <>
      <ScreenHeader title="Processing" bell={false} />
      <ScreenBody className="flex flex-col items-center justify-center text-center">
        <Loader2 className="h-16 w-16 text-primary animate-spin my-10" />
        <p className="text-sm font-medium">Processing your deposit</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Waiting for confirmation from your bank…
        </p>
      </ScreenBody>
    </>
  );
}
