
import type { AxentrazResult } from "@/lib/axentraz-accumulation";

import {
  analyzeSupportResistance,
  type SRHistory,
} from "@/app/components/stock-chart/support-resistance";

/* =========================================================
   FISHING BOTTOM CONFIG
========================================================= */

export const MIN_ACCUMULATION_RATE = 20;

export const MARKET_VOLUME_SCALE = 0.01;

export const MIN_MARKET_VOLUME = 50_000;

/* =========================================================
   TYPES
========================================================= */

export type TradingSetup =
  | "fishing-bottom"
  | "retracement";

export type StockHistoryData = {
  code?: string;
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  value?: number;
};

export type EntryTarget = {
  entryLow: number | null;
  entryHigh: number | null;
  tp: number | null;
};

/* =========================================================
   FISHING BOTTOM FILTER
========================================================= */

/**
 * Filter khusus Fishing Bottom.
 *
 * Kandidat lolos jika:
 * 1. Accumulation rate >= 20%
 * 2. MA20 > 0
 * 3. Last close di bawah MA20
 *
 * Filter ini tidak dipakai oleh strategi lain.
 */
export function filterFishingBottomCandidates(
  rows: AxentrazResult[],
): AxentrazResult[] {
  return rows.filter(
    (row) =>
      row.accumulation_rate >= MIN_ACCUMULATION_RATE &&
      row.ma20 > 0 &&
      row.last_close < row.ma20,
  );
}

/* =========================================================
   NUMBER
========================================================= */

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(/,/g, ""));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

/* =========================================================
   FISHING BOTTOM ENTRY AREA + TP
========================================================= */

/**
 * Entry Area:
 * analysis.entryZone.low -> analysis.entryZone.high
 *
 * TP:
 * Support + 50% * (Resistance - Support)
 *
 * Entry Area dan TP hanya digunakan untuk pesan Telegram.
 * Keduanya tidak disimpan ke dokumen signal Firestore.
 */
export function calculateFishingBottomEntryTarget(
  history: StockHistoryData[],
): EntryTarget {
  const emptyResult: EntryTarget = {
    entryLow: null,
    entryHigh: null,
    tp: null,
  };

  if (history.length < 20) {
    return emptyResult;
  }

  const srHistory: SRHistory[] = history
    .map((item) => ({
      date: String(item.date ?? ""),
      open: toNumber(item.open),
      high: toNumber(item.high),
      low: toNumber(item.low),
      close: toNumber(item.close),
      volume: toNumber(item.volume),
    }))
    .filter(
      (item) =>
        item.date &&
        item.open > 0 &&
        item.high > 0 &&
        item.low > 0 &&
        item.close > 0,
    );

  if (srHistory.length < 20) {
    return emptyResult;
  }

  const analysis = analyzeSupportResistance(srHistory);
  const entryZone = analysis?.entryZone;

  if (!entryZone) {
    return emptyResult;
  }

  const entryLow = Number.isFinite(entryZone.low)
    ? entryZone.low
    : null;

  const entryHigh = Number.isFinite(entryZone.high)
    ? entryZone.high
    : null;

  if (!entryZone.resistance || !entryZone.support) {
    return {
      entryLow,
      entryHigh,
      tp: null,
    };
  }

  const support = entryZone.support.center;
  const resistance = entryZone.resistance.center;

  if (
    !Number.isFinite(support) ||
    !Number.isFinite(resistance) ||
    support <= 0 ||
    resistance <= support
  ) {
    return {
      entryLow,
      entryHigh,
      tp: null,
    };
  }

  const tp = support + (resistance - support) * 0.5;

  return {
    entryLow,
    entryHigh,
    tp: Number.isFinite(tp) ? tp : null,
  };
}
