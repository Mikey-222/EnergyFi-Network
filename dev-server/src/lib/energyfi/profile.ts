// User profiles persisted to localStorage, keyed by wallet address. Every
// screen reads them reactively; each wallet gets its own profile.
import { useSyncExternalStore } from "react";

export type NotificationPrefs = {
  payments: { push: boolean; sms: boolean; email: boolean };
  loans: { push: boolean; sms: boolean; email: boolean };
  savings: { push: boolean; email: boolean };
  promotions: { push: boolean };
};

export type UserProfile = {
  name: string;
  email: string;
  phone: string;
  verified: boolean;
  language: string;
  currency: string;
  notifications: NotificationPrefs;
};

const STORAGE_KEY = "energyfi.profiles";
const LEGACY_KEY = "energyfi.profile";

const DEFAULTS: UserProfile = {
  name: "New user",
  email: "",
  phone: "",
  verified: false,
  language: "en",
  currency: "USDC",
  notifications: {
    payments: { push: true, sms: true, email: false },
    loans: { push: true, sms: false, email: true },
    savings: { push: true, email: true },
    promotions: { push: false },
  },
};

// Stable snapshot for wallets that are not connected (or unknown).
const ANON_PROFILE: UserProfile = DEFAULTS;

let cache: Record<string, UserProfile> = {};
let listeners: (() => void)[] = [];

function readAll(): Record<string, UserProfile> {
  if (typeof window === "undefined") return {};
  try {
    window.localStorage.removeItem(LEGACY_KEY);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserProfile>) : {};
  } catch {
    return {};
  }
}

function saveAll() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage unavailable (private mode / SSR) — in-memory only
  }
}

export function getProfile(address?: string | null): UserProfile {
  if (!address) return ANON_PROFILE;
  if (cache[address]) return cache[address];
  const all = readAll();
  const found = all[address];
  if (found) {
    cache[address] = found;
    return found;
  }
  const fresh = structuredClone(DEFAULTS);
  cache[address] = fresh;
  all[address] = fresh;
  cache = all;
  saveAll();
  return fresh;
}

export function setProfile(address: string, profile: UserProfile) {
  if (!address) return;
  cache[address] = profile;
  saveAll();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function useProfile(address?: string | null): UserProfile {
  return useSyncExternalStore(
    subscribe,
    () => getProfile(address),
    () => getProfile(address),
  );
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "friend";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "AO";
}
