"use client";

import { useEffect, useState } from "react";
import type { RateSnapshot } from "@/domain";

let pending: Promise<RateSnapshot | null> | undefined;

/**
 * Today's exchange rates from the server (the API key never reaches the
 * browser), fetched once per page load; `null` if they can't be had, so a
 * Member can still enter a rate by hand.
 */
export function fetchTodaysRates(): Promise<RateSnapshot | null> {
  pending ??= fetch("/api/rates")
    .then((response) => (response.ok ? (response.json() as Promise<RateSnapshot | null>) : null))
    .catch(() => null)
    .then((rates) => {
      // Try again next time if this attempt failed.
      if (!rates) pending = undefined;
      return rates;
    });
  return pending;
}

/** Today's exchange rates in the browser: `undefined` while loading, `null` if unavailable. */
export type TodaysRatesState = RateSnapshot | null | undefined;

/** Today's exchange rates for the Expense form, loaded without blocking the page. */
export function useTodaysRates(): TodaysRatesState {
  const [rates, setRates] = useState<RateSnapshot | null>();
  useEffect(() => {
    let live = true;
    void fetchTodaysRates().then((r) => live && setRates(r));
    return () => {
      live = false;
    };
  }, []);
  return rates;
}
