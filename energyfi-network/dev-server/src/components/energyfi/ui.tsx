import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { ChevronLeft, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

/* Phone frame that wraps every mobile screen so the web preview feels handheld. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen night-bg grid-lines">
      <div className="mx-auto flex min-h-screen max-w-[680px] flex-col bg-background sm:my-6 sm:min-h-[900px] sm:rounded-[2.75rem] sm:border sm:border-white/10 sm:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.7)] sm:overflow-hidden relative">
        <StatusBar />
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex h-8 items-center justify-between px-6 pt-2 text-[11px] font-medium text-foreground/80 tabular">
      <span>9:41</span>
      <span className="h-1.5 w-16 rounded-full bg-foreground/20" />
      <span className="flex gap-1">
        <span>●●●●</span>
        <span>5G</span>
        <span>100%</span>
      </span>
    </div>
  );
}

export function ScreenHeader({
  title,
  back,
  right,
  bell = true,
  subtitle,
}: {
  title?: string;
  back?: LinkProps["to"] | true;
  right?: ReactNode;
  bell?: boolean;
  subtitle?: string;
}) {
  return (
    <header className="flex items-center gap-3 px-5 pt-4 pb-3">
      {back ? (
        <Link
          to={back === true ? ".." : back}
          className="grid h-9 w-9 place-items-center rounded-full bg-surface hairline text-foreground hover:bg-surface-2"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : null}
      <div className="flex-1 min-w-0">
        {title ? <h1 className="text-lg font-semibold font-display truncate">{title}</h1> : null}
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {right}
      {bell && (
        <Link
          to="/app/notifications"
          className="relative grid h-9 w-9 place-items-center rounded-full bg-surface hairline hover:bg-surface-2"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </Link>
      )}
    </header>
  );
}

export function ScreenBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("flex-1 overflow-y-auto px-5 pb-28 pt-2 space-y-4", className)}>
      {children}
    </main>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl bg-card hairline p-5", className)}>{children}</div>;
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({
  status,
}: {
  status: "Completed" | "Pending" | "Failed" | "Active" | "Approved" | "Declined";
}) {
  const map: Record<string, string> = {
    Completed: "bg-success/15 text-success",
    Active: "bg-success/15 text-success",
    Approved: "bg-success/15 text-success",
    Pending: "bg-warning/15 text-warning",
    Failed: "bg-destructive/15 text-destructive",
    Declined: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        map[status],
      )}
    >
      {status}
    </span>
  );
}

export function Button({
  variant = "primary",
  full = true,
  as: As = "button",
  className,
  children,
  ...props
}: {
  variant?: "primary" | "money" | "ghost" | "outline" | "destructive";
  full?: boolean;
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<"button"> &
  Record<string, unknown>) {
  const variants: Record<string, string> = {
    primary: "energy-gradient glow-energy hover:brightness-110",
    money: "money-gradient glow-money text-background hover:brightness-110",
    ghost: "bg-surface hairline hover:bg-surface-2 text-foreground",
    outline: "border border-border text-foreground hover:bg-surface",
    destructive: "bg-destructive/15 text-destructive hover:bg-destructive/25",
  };
  return (
    <As
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 h-12 text-sm font-semibold transition-all",
        full && "w-full",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </As>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground/80">{hint}</span> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-12 rounded-xl bg-surface hairline px-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-ring",
        props.className,
      )}
    />
  );
}

export function OwnershipRing({
  pct,
  size = 120,
  label,
}: {
  pct: number;
  size?: number;
  label?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="stroke-white/10"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-[url(#grad)]"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.16 78)" />
            <stop offset="100%" stopColor="oklch(0.88 0.14 82)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-semibold font-display tabular">{pct}%</div>
        {label ? (
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        ) : null}
      </div>
    </div>
  );
}

export function BalanceCard({
  label,
  amount,
  unit,
  tone = "energy",
  actions,
}: {
  label: string;
  amount: string;
  unit?: string;
  tone?: "energy" | "money" | "neutral";
  actions?: ReactNode;
}) {
  const bg =
    tone === "energy"
      ? "energy-gradient glow-energy"
      : tone === "money"
        ? "money-gradient glow-money text-background"
        : "bg-surface hairline";
  return (
    <div className={cn("rounded-2xl p-5", bg)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs opacity-80">{label}</p>
          <p className="mt-1 text-3xl font-semibold font-display tabular">
            {amount} {unit ? <span className="text-base opacity-80">{unit}</span> : null}
          </p>
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  color = "primary",
}: {
  data: number[];
  color?: "primary" | "money";
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 320;
  const h = 80;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = color === "primary" ? "oklch(0.82 0.16 78)" : "oklch(0.82 0.12 220)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={stroke} opacity={0.12} />
    </svg>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  to,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  to?: LinkProps["to"];
}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-xl bg-surface hairline p-3.5 hover:bg-surface-2 transition">
      {icon ? (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-background/40 text-primary">
          {icon}
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground truncate">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export function StepDots({ total, active }: { total: number; active: number }) {
  return (
    <div className="flex justify-center gap-1.5 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === active ? "w-6 bg-primary" : "w-1.5 bg-white/20",
          )}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface hairline p-8 text-center space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      {action}
    </div>
  );
}
