// EnergyFi on-chain configuration (Stellar Testnet).
// Generated bindings live in src/contracts/<name>/ and embed each contract id.

export const NETWORK = {
  name: "testnet" as const,
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org:443",
  horizonUrl: "https://horizon-testnet.stellar.org",
};

// Official Circle USDC on Stellar Testnet.
export const USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  // Stellar Asset Contract wrapping the issuer asset (used by EnergyFi contracts).
  sac: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
};

// Official Circle EURC on Stellar Testnet (live on-chain: referral pool payouts).
export const EURC = {
  code: "EURC",
  issuer: "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO",
  sac: "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
};

export const CONTRACTS = {
  energyCredit: "CB56C2Z5LN5ACMY4T4GIVETTNJLNUMMSWSI4UEEZNP5KCBFOJ3PBM7YC",
  installments: "CBG4I4CCMKG5PANFYMPP4RYQLOIUQKH3MJBSAR5ZE4NK7TUL6YXR6ELN",
  project: "CDIMAD6UA6MEF7NMBPSEELU5PNUFNSOL72YJXN2DUPMFRPBIDYBSNTAA",
  referral: "CBURYW3CWH7L3R3RUADXCRNOQIOSKJEGDTBT5PPLS3ZMHKXCXDYFABAE",
};

// Referral program: invite = pending; both sides paid 0.0001 once the referee
// confirms app usage (usage-gated, v2 contract).
export const REFERRAL = {
  rewardUsd: "0.0001", // 1_000 stroops — matches the on-chain reward
  maxPerWallet: 5, // hard cap enforced by the contract
  currencies: ["USDC", "EURC"] as const,
};

// Loan product ids registered on-chain in the installments contract.
// NOTE: Soroban Symbol only allows [A-Za-z0-9_], so ids use underscores.
export const PRODUCT_IDS = ["loan_50", "loan_100", "loan_200", "loan_500"] as const;

export const PRODUCT_CATALOG: Record<
  string,
  { name: string; tag: string; img: string; category: string; priceUsd: number; monthlyUsd: number }
> = {
  loan_50: {
    name: "Neighbourhood loan · 50",
    tag: "Micro",
    img: "loan",
    category: "Loans",
    priceUsd: 50,
    monthlyUsd: 4.6,
  },
  loan_100: {
    name: "Neighbourhood loan · 100",
    tag: "Popular",
    img: "loan",
    category: "Loans",
    priceUsd: 100,
    monthlyUsd: 9.2,
  },
  loan_200: {
    name: "Neighbourhood loan · 200",
    tag: "Growth",
    img: "loan",
    category: "Loans",
    priceUsd: 200,
    monthlyUsd: 18.4,
  },
  loan_500: {
    name: "Neighbourhood loan · 500",
    tag: "Business",
    img: "loan",
    category: "Loans",
    priceUsd: 500,
    monthlyUsd: 46,
  },
};

export const PROJECT = {
  id: "neighbourhood-pool",
  name: "EnergyFi Lending Pool",
  country: "Community",
  capacity: "P2P credit",
  yieldPct: 10.4,
};

// Deploy/admin account — gates the admin console (/app/admin).
export const ADMIN_ADDRESS = "GBR5H3DVUZRMG2ESUBZP6SOASOBHKZCWR5VM6YB4FZG7MR3GBQOGOBV5";

export const CIRCE_FAUCET_URL = "https://faucet.circle.com";
