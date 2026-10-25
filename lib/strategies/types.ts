import type { AxentrazResult } from "@/lib/axentraz-accumulation";

export type TradingSetup =
  | "fishing-bottom"
  | "retracement";

export type AccumulationPeriod =
  | "1w"
  | "mtd"
  | "1m"
  | "2m"
  | "3m";

export type DestinationType =
  | "telegram"
  | "whatsapp";

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

export type FishingBottomSignal = AxentrazResult & {
  marketVolume: number;
  historyClose: number;
  entryLow: number | null;
  entryHigh: number | null;
  tp: number | null;
};