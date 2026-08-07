// Static mock data used by every screen.
export const wallet = {
  usdc: 500,
};

export const txs = [
  {
    id: "t1",
    label: "Installment payment",
    amount: -30,
    date: "Jul 18",
    status: "Completed" as const,
    kind: "payment",
  },
  {
    id: "t2",
    label: "Top up · Chipper Cash",
    amount: +100,
    date: "Jul 12",
    status: "Completed" as const,
    kind: "topup",
  },
  {
    id: "t3",
    label: "Dividend · EnergyFi Lending Pool",
    amount: +4.2,
    date: "Jul 05",
    status: "Completed" as const,
    kind: "invest",
  },
  {
    id: "t4",
    label: "Installment payment",
    amount: -30,
    date: "Jun 18",
    status: "Completed" as const,
    kind: "payment",
  },
  {
    id: "t5",
    label: "Top up · Bank transfer",
    amount: +200,
    date: "Jun 02",
    status: "Completed" as const,
    kind: "topup",
  },
  {
    id: "t6",
    label: "Installment payment",
    amount: -30,
    date: "May 18",
    status: "Failed" as const,
    kind: "payment",
  },
];

export const countries = [
  { code: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "KE", flag: "🇰🇪", name: "Kenya" },
  { code: "GH", flag: "🇬🇭", name: "Ghana" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "DE", flag: "🇩🇪", name: "Germany" },
];
