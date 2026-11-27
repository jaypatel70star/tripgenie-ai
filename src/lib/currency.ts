import type { CurrencyCode } from "@/types/travel";

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AED: "د.إ ",
};

export function formatPrice(
  amountUsd: number,
  currency: CurrencyCode = "INR",
  exchangeRates: Record<string, number> = { INR: 84.5 }
): string {
  const rate = exchangeRates[currency] ?? (currency === "INR" ? 84.5 : 1);
  const sym = CURRENCY_SYMBOLS[currency] ?? "₹";
  const converted = Math.round(amountUsd * rate);
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return `${sym}${converted.toLocaleString(locale)}`;
}

export function formatPriceLevel(level: "$" | "$$" | "$$$", currency: CurrencyCode = "INR"): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? "₹";
  const unit = sym.trim();
  return unit.repeat(level.length);
}
