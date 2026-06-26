// Currency conversion. All sums must pass through here before being added together,
// because deals are denominated in their own currency (USD/GBP/EUR/AED) while each
// investor reports in their own. Convert via USD: amount -> USD -> reporting.
import type { Currency } from "./data/types";
import { fxToUsd } from "./data/store";

export function toUsd(amount: number, from: Currency): number {
  return amount * fxToUsd(from);
}

export function convert(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  return toUsd(amount, from) / fxToUsd(to);
}

/** Round to 2dp for display only, never used inside running calculations. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
