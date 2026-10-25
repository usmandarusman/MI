
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/firebase-admin";
import {
  getAxentrazAccumulation,
  type AxentrazResult,
} from "@/lib/axentraz-accumulation";
import { sendTelegramMessage } from "@/lib/telegram";
import { analyzeRetracement } from "@/lib/strategies/retracement";

import {
  calculateFishingBottomEntryTarget,
  filterFishingBottomCandidates,
  MARKET_VOLUME_SCALE,
  MIN_MARKET_VOLUME,
   MIN_ACCUMULATION_RATE,
  type StockHistoryData,
  type TradingSetup,
} from "@/lib/strategies/fishing-bottom";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SIGNAL_COLLECTION = "trade-signals";
const HISTORY_QUERY_CONCURRENCY = 12;
const SR_HISTORY_LIMIT = 120;
const TELEGRAM_MAX_LENGTH = 3500;
const SENDING_TIMEOUT_MS = 10 * 60 * 1000;

type AccumulationPeriod = "1w" | "mtd" | "1m" | "2m" | "3m";
type DestinationType = "telegram" | "whatsapp";

type TradePlaneConfig = {
  enabled: boolean;
  broker_code: string;
  broker_id: number;
  broker_name: string;
  destination_type: DestinationType;
  destination_target: string;
  accumulation_period: AccumulationPeriod;
  setup: TradingSetup;
};

type TradePlaneDocument = TradePlaneConfig & {
  uid: string;
};

type SignalStatus = "sending" | "sent" | "failed";

type TradeSignalRow = AxentrazResult & {
  marketVolume: number;
  historyClose: number;
  entryLow: number | null;
  entryHigh: number | null;
  tp: number | null;
  stopLoss?: number | null;
  retracementConfirmation?: {
    trend: boolean;
    entry: boolean;
    reversal: boolean;
    volume: boolean;
  };
};

type SignalDocument = {
  uid: string;
  symbol: string;
  brokerId: number;
  brokerCode: string;
  brokerName: string;
  accumulation: number;
  accumulationRate: number;
  lastClose: number;
  ma20: number;
  volume: number;
  setup: TradingSetup;
  from: string;
  to: string;
  status: SignalStatus;
  createdAt: FirebaseFirestore.FieldValue | Date;
  updatedAt: FirebaseFirestore.FieldValue | Date;
  sentAt?: FirebaseFirestore.FieldValue | Date;
  sentDestination?: string;
  error?: string;
};

type ProcessResult = {
  sent: number;
  [key: string]: unknown;
};

/* =========================================================
   NUMBER HELPERS
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

function formatNumber(
  value: number,
  maximumFractionDigits = 2,
): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits,
  }).format(value);
}

function formatPriceFloor(value: number): string {
  if (!Number.isFinite(value)) return "-";

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.floor(value));
}

function formatCompactNumber(
  value: number,
  maximumFractionDigits = 2,
): string {
  if (!Number.isFinite(value)) return "0";

  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  const units: [number, string][] = [
    [1_000_000_000_000, "T"],
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "K"],
  ];

  for (const [threshold, suffix] of units) {
    if (absolute >= threshold) {
      return (
        sign +
        formatNumber(absolute / threshold, maximumFractionDigits) +
        suffix
      );
    }
  }

  return formatNumber(value, maximumFractionDigits);
}

function formatSignedPercent(value: number): string {
  const formatted = formatNumber(Math.abs(value));

  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `-${formatted}%`;

  return "0%";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* =========================================================
   STRATEGY LABEL
========================================================= */

function getStrategyLabel(setup: TradingSetup): string {
  switch (setup) {
    case "fishing-bottom":
      return "🎣 Fishing Bottom";

    case "retracement":
      return "📈 Retracement";

    default:
      return "📊 Tidak diketahui";
  }
}

/* =========================================================
   DATE HELPERS
========================================================= */

function getJakartaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
}

function isAccumulationPeriod(
  value: unknown,
): value is AccumulationPeriod {
  return (
    value === "1w" ||
    value === "mtd" ||
    value === "1m" ||
    value === "2m" ||
    value === "3m"
  );
}

function parseDateYYYYMMDD(value: string): Date {
  return new Date(
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
    ),
  );
}

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function subtractDays(value: string, days: number): string {
  const date = parseDateYYYYMMDD(value);
  date.setUTCDate(date.getUTCDate() - days);
  return formatDateYYYYMMDD(date);
}

function subtractMonthsClamped(
  value: string,
  months: number,
): string {
  const date = parseDateYYYYMMDD(value);
  const targetMonthIndex = date.getUTCMonth() - months;
  const targetYear =
    date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();

  const targetDay = Math.min(date.getUTCDate(), lastDay);

  return formatDateYYYYMMDD(
    new Date(Date.UTC(targetYear, targetMonth, targetDay)),
  );
}

function getAccumulationPeriodRange(
  period: AccumulationPeriod,
): { from: string; to: string } {
  const to = getJakartaDate();

  switch (period) {
    case "1w":
      return { from: subtractDays(to, 6), to };

    case "mtd":
      return { from: `${to.slice(0, 6)}01`, to };

    case "1m":
      return { from: subtractMonthsClamped(to, 1), to };

    case "2m":
      return { from: subtractMonthsClamped(to, 2), to };

    case "3m":
      return { from: subtractMonthsClamped(to, 3), to };
  }
}

function formatDate(value: string): string {
  if (!/^\d{8}$/.test(value)) return value;

  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
}

/* =========================================================
   READ TRADE PLANE CONFIGURATIONS
========================================================= */

async function getEnabledTradePlanes(): Promise<TradePlaneDocument[]> {
  const snapshot = await db
    .collection("trade-plane")
    .where("enabled", "==", true)
    .get();

  const configs: TradePlaneDocument[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;

    const brokerId = data.broker_id;

    if (
      typeof brokerId !== "number" ||
      !Number.isInteger(brokerId) ||
      brokerId <= 0
    ) {
      console.error("[TRADE PLANE] Invalid broker_id:", {
        uid: doc.id,
        broker_id: brokerId,
      });
      continue;
    }

    /*
     * Setup dibaca secara ketat.
     * Jangan mengubah setup yang salah menjadi Fishing Bottom.
     */
    const rawSetup = data.setup;

    if (
      rawSetup !== "fishing-bottom" &&
      rawSetup !== "retracement"
    ) {
      console.error("[TRADE PLANE] Invalid or missing setup:", {
        uid: doc.id,
        setup: rawSetup ?? null,
      });
      continue;
    }

    const setup: TradingSetup = rawSetup;

    const accumulationPeriod = isAccumulationPeriod(
      data.accumulation_period,
    )
      ? data.accumulation_period
      : "mtd";

    const config: TradePlaneDocument = {
      uid: doc.id,
      enabled: true,
      broker_code:
        typeof data.broker_code === "string"
          ? data.broker_code
          : "",
      broker_id: brokerId,
      broker_name:
        typeof data.broker_name === "string"
          ? data.broker_name
          : "",
      destination_type:
        data.destination_type === "whatsapp"
          ? "whatsapp"
          : "telegram",
      destination_target:
        typeof data.destination_target === "string"
          ? data.destination_target
          : "",
      accumulation_period: accumulationPeriod,
      setup,
    };

    console.log("[TRADE PLANE] Configuration loaded:", {
      uid: config.uid,
      broker_code: config.broker_code,
      broker_id: config.broker_id,
      setup: config.setup,
      accumulation_period: config.accumulation_period,
    });

    configs.push(config);
  }

  return configs;
}

/* =========================================================
   STOCK HISTORY
========================================================= */

function normalizeStockHistory(
  data: StockHistoryData,
  fallbackDate: string,
  fallbackCode: string,
): StockHistoryData {
  return {
    code: typeof data.code === "string" ? data.code : fallbackCode,
    date: typeof data.date === "string" ? data.date : fallbackDate,
    open: toNumber(data.open),
    high: toNumber(data.high),
    low: toNumber(data.low),
    close: toNumber(data.close),
    volume: toNumber(data.volume),
    value: toNumber(data.value),
  };
}

async function getStockHistory(
  symbol: string,
): Promise<StockHistoryData[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol) return [];

  const snapshot = await db
    .collection("stocks")
    .doc(normalizedSymbol)
    .collection("history")
    .orderBy("date", "desc")
    .limit(SR_HISTORY_LIMIT)
    .get();

  const rows = snapshot.docs.map((doc) =>
    normalizeStockHistory(
      doc.data() as StockHistoryData,
      doc.id,
      normalizedSymbol,
    ),
  );

  // Support/Resistance membutuhkan urutan oldest -> newest.
  rows.reverse();

  return rows;
}

async function getStockHistories(
  symbols: string[],
): Promise<Map<string, StockHistoryData[]>> {
  const uniqueSymbols = [
    ...new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  const result = new Map<string, StockHistoryData[]>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;

      if (index >= uniqueSymbols.length) return;

      const symbol = uniqueSymbols[index];

      try {
        const history = await getStockHistory(symbol);

        if (history.length > 0) {
          result.set(symbol, history);
        }
      } catch (error) {
        console.error("[TRADE PLANE] History query failed:", {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const workerCount = Math.min(
    HISTORY_QUERY_CONCURRENCY,
    uniqueSymbols.length,
  );

  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  return result;
}

/* =========================================================
   TELEGRAM MESSAGE
========================================================= */

function buildSignalHeader(
  config: TradePlaneConfig,
  from: string,
  to: string,
): string {
  return (
    `🚨 <b>TRADE SIGNAL</b>\n\n` +
    `🏢 <b>Broker Accumulator</b>\n` +
    `${escapeHtml(config.broker_code)} — ${escapeHtml(config.broker_name)}\n\n` +
    `${getStrategyLabel(config.setup)}\n\n` +
    `📅 <b>Periode</b>\n` +
    `${formatDate(from)} — ${formatDate(to)}\n\n` +
    `━━━━━━━━━━━━━━━━━━`
  );
}

function buildSignalBlock(row: TradeSignalRow): string {
  const symbol = escapeHtml(row.symbol);
  const stockbitUrl =
    `https://stockbit.com/#/symbol/${encodeURIComponent(row.symbol)}`;

  const entryArea =
    row.entryLow !== null && row.entryHigh !== null
      ? `${formatPriceFloor(row.entryLow)} — ${formatPriceFloor(row.entryHigh)}`
      : "-";

  const tp = row.tp !== null ? formatPriceFloor(row.tp) : "-";

  return (
    `📌 <a href="${stockbitUrl}">${symbol}</a>\n\n` +
    `🔥 Accumulation: ${formatSignedPercent(row.accumulation)}\n` +
    `⚡ Rate: ${formatNumber(row.accumulation_rate)}%\n` +
    `📊 Last Price: ${formatNumber(row.historyClose)}\n` +
    `📦 Volume: ${formatCompactNumber(row.marketVolume)}\n` +
    `🎯 Entry Area: ${entryArea}\n` +
    `🏁 TP: ${tp}\n` +
    (row.stopLoss !== undefined && row.stopLoss !== null
      ? `🛑 SL: ${formatPriceFloor(row.stopLoss)}\n`
      : "") +
    (row.retracementConfirmation
      ? `\n🧭 Konfirmasi Retracement\n` +
        `• Tren HH/HL: ${row.retracementConfirmation.trend ? "✅" : "❌"}\n` +
        `• Area entry: ${row.retracementConfirmation.entry ? "✅" : "❌"}\n` +
        `• Bullish reversal: ${row.retracementConfirmation.reversal ? "✅" : "❌"}\n` +
        `• Volume: ${row.retracementConfirmation.volume ? "✅" : "❌"}\n`
      : "") +
    `\n━━━━━━━━━━━━━━━━━━`
  );
}

type SignalChunk = {
  rows: TradeSignalRow[];
  message: string;
};

function buildSignalChunks(
  rows: TradeSignalRow[],
  config: TradePlaneConfig,
  from: string,
  to: string,
): SignalChunk[] {
  const header = buildSignalHeader(config, from, to);
  const chunks: SignalChunk[] = [];

  let currentRows: TradeSignalRow[] = [];
  let currentMessage = header;

  for (const row of rows) {
    const block = `\n\n${buildSignalBlock(row)}`;

    if (currentMessage.length + block.length <= TELEGRAM_MAX_LENGTH) {
      currentRows.push(row);
      currentMessage += block;
      continue;
    }

    if (currentRows.length > 0) {
      chunks.push({ rows: currentRows, message: currentMessage });
    }

    currentRows = [row];
    currentMessage = `${header}\n\n${buildSignalBlock(row)}`;
  }

  if (currentRows.length > 0) {
    chunks.push({ rows: currentRows, message: currentMessage });
  }

  return chunks;
}

/* =========================================================
   SIGNAL CLAIM / STATUS
========================================================= */

function getSignalId(
  config: TradePlaneDocument,
  row: TradeSignalRow,
  from: string,
  to: string,
): string {
  return `${config.uid}_${config.setup}_${config.broker_id}_${row.symbol}_${from}_${to}`;
}

async function claimSignal(
  config: TradePlaneDocument,
  row: TradeSignalRow,
  from: string,
  to: string,
): Promise<boolean> {
  const ref = db
    .collection(SIGNAL_COLLECTION)
    .doc(getSignalId(config, row, from, to));

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (snapshot.exists) {
      const data = snapshot.data() as Partial<SignalDocument>;

      if (data.status === "sent") return false;

      if (data.status === "sending" && data.updatedAt) {
        const value = data.updatedAt as unknown;
        let updatedAtMs: number | null = null;

        if (value instanceof Date) {
          updatedAtMs = value.getTime();
        } else if (
          typeof value === "object" &&
          value !== null &&
          "toDate" in value &&
          typeof (value as { toDate?: unknown }).toDate === "function"
        ) {
          updatedAtMs = (
            value as { toDate: () => Date }
          ).toDate().getTime();
        }

        if (
          updatedAtMs !== null &&
          Date.now() - updatedAtMs < SENDING_TIMEOUT_MS
        ) {
          return false;
        }
      }
    }

    const previous = snapshot.data();

    const signalData: SignalDocument = {
      uid: config.uid,
      symbol: row.symbol,
      brokerId: config.broker_id,
      brokerCode: config.broker_code,
      brokerName: config.broker_name,
      accumulation: row.accumulation,
      accumulationRate: row.accumulation_rate,
      lastClose: row.historyClose,
      ma20: row.ma20,
      volume: row.marketVolume,
      setup: config.setup,
      from,
      to,
      status: "sending",
      createdAt:
        previous?.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(ref, signalData, { merge: true });

    return true;
  });
}

async function updateSignalStatus(
  config: TradePlaneDocument,
  row: TradeSignalRow,
  from: string,
  to: string,
  status: SignalStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await db
    .collection(SIGNAL_COLLECTION)
    .doc(getSignalId(config, row, from, to))
    .set(
      {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        ...extra,
      },
      { merge: true },
    );
}

/* =========================================================
   DESTINATION
========================================================= */

async function sendToDestination(
  config: TradePlaneDocument,
  message: string,
): Promise<unknown> {
  if (config.destination_type === "telegram") {
    return sendTelegramMessage(
      message,
      config.destination_target,
      "HTML",
    );
  }

  throw new Error("Destination WhatsApp belum memiliki sender/API.");
}

/* =========================================================
   NO-CANDIDATE NOTIFICATION
========================================================= */

/**
 * Kirim notifikasi saat scan selesai tetapi tidak menghasilkan sinyal.
 * Notifikasi dideduplikasi berdasarkan konfigurasi + rentang periode,
 * supaya cron yang berjalan berulang tidak membanjiri Telegram.
 */
async function notifyNoCandidates(
  config: TradePlaneDocument,
  from: string,
  to: string,
  details: {
    accumulationRows: number;
    candidates: number;
    analyzed: number;
    rejected: number;
    missingMarketData: number;
  },
): Promise<{ sent: boolean; skippedDuplicate: boolean }> {
  const notificationId = [
    config.uid,
    config.setup,
    config.broker_id,
    from,
    to,
    "no-candidates",
  ].join("_").replace(/[^a-zA-Z0-9_-]/g, "_");

  const ref = db.collection("trade-plane-notifications").doc(notificationId);
  const canSend = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as
      | { status?: string; updatedAt?: unknown }
      | undefined;

    if (data?.status === "sent") return false;

    if (data?.status === "sending" && data.updatedAt) {
      const value = data.updatedAt as {
        toDate?: () => Date;
      };
      const updatedAtMs =
        typeof value.toDate === "function"
          ? value.toDate().getTime()
          : value instanceof Date
            ? value.getTime()
            : 0;

      if (updatedAtMs && Date.now() - updatedAtMs < SENDING_TIMEOUT_MS) {
        return false;
      }
    }

    transaction.set(
      ref,
      {
        uid: config.uid,
        setup: config.setup,
        brokerId: config.broker_id,
        brokerCode: config.broker_code,
        from,
        to,
        status: "sending",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return true;
  });

  if (!canSend) {
    return { sent: false, skippedDuplicate: true };
  }

  const message =
    `ℹ️ <b>SCAN SELESAI — BELUM ADA SINYAL</b>\n\n` +
    `${getStrategyLabel(config.setup)}\n` +
    `🏢 <b>Broker:</b> ${escapeHtml(config.broker_code)} — ${escapeHtml(config.broker_name)}\n` +
    `📅 <b>Periode:</b> ${formatDate(from)} — ${formatDate(to)}\n\n` +
    `Scan berhasil dijalankan, tetapi belum ada saham yang memenuhi seluruh kriteria strategi. Ini bukan berarti proses error.\n\n` +
    `📋 <b>Ringkasan scan</b>\n` +
    `• Data akumulasi: ${details.accumulationRows} saham\n` +
    `• Kandidat strategi: ${details.candidates} saham\n` +
    `• Dianalisis: ${details.analyzed} saham\n` +
    `• Belum memenuhi kriteria: ${details.rejected} saham\n` +
    `• Data candle tidak tersedia: ${details.missingMarketData} saham\n\n` +
    `Tidak ada sinyal entry yang dikirim. Sistem akan memeriksa kembali pada jadwal scan berikutnya.`;

  try {
    await sendToDestination(config, message);
    await ref.set(
      {
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        sentDestination: config.destination_target,
        updatedAt: FieldValue.serverTimestamp(),
        error: FieldValue.delete(),
      },
      { merge: true },
    );
    console.log("[TRADE PLANE] No-candidate notification sent:", {
      uid: config.uid,
      setup: config.setup,
      broker: config.broker_code,
      from,
      to,
    });
    return { sent: true, skippedDuplicate: false };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await ref.set(
      {
        status: "failed",
        error: errorMessage,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.error("[TRADE PLANE] No-candidate notification failed:", {
      uid: config.uid,
      setup: config.setup,
      error: errorMessage,
    });
    throw error;
  }
}

/* =========================================================
   PROCESS FISHING BOTTOM
========================================================= */

async function processFishingBottom(
  config: TradePlaneDocument,
  from: string,
  to: string,
  historyCache: Map<string, StockHistoryData[]>,
): Promise<ProcessResult> {
  console.log("[TRADE PLANE] Processing strategy:", {
    uid: config.uid,
    broker: config.broker_code,
    broker_id: config.broker_id,
    setup: config.setup,
    from,
    to,
  });

  const result = await getAxentrazAccumulation({
    brokerId: config.broker_id,
    from,
    to,
  });

  const candidates = filterFishingBottomCandidates(result.data);

  const missingSymbols = candidates
    .map((row) => row.symbol.trim().toUpperCase())
    .filter((symbol) => symbol && !historyCache.has(symbol));

  if (missingSymbols.length > 0) {
    const histories = await getStockHistories(missingSymbols);

    for (const [symbol, history] of histories) {
      historyCache.set(symbol, history);
    }
  }

  const signals: TradeSignalRow[] = [];

  let missingMarketData = 0;
  let lowVolume = 0;
  let invalidSR = 0;

  for (const row of candidates) {
    const symbol = row.symbol.trim().toUpperCase();
    const history = historyCache.get(symbol);

    if (!history?.length) {
      missingMarketData++;
      continue;
    }

    const latest = history[history.length - 1];
    const rawVolume = toNumber(latest.volume);
    const volume = rawVolume * MARKET_VOLUME_SCALE;
    const historyClose = toNumber(latest.close);

    console.log("[TRADE PLANE] Stock history check:", {
      uid: config.uid,
      setup: config.setup,
      symbol,
      date: latest.date,
      rawVolume,
      scaledVolume: volume,
      threshold: MIN_MARKET_VOLUME,
      historyClose,
    });

    if (volume <= MIN_MARKET_VOLUME) {
      lowVolume++;
      continue;
    }

    if (historyClose <= 0) continue;

    const entryTarget = calculateFishingBottomEntryTarget(history);

    if (
      entryTarget.entryLow === null ||
      entryTarget.entryHigh === null
    ) {
      invalidSR++;
    }

    signals.push({
      ...row,
      marketVolume: volume,
      historyClose,
      entryLow: entryTarget.entryLow,
      entryHigh: entryTarget.entryHigh,
      tp: entryTarget.tp,
    });
  }

  const baseResult = {
    uid: config.uid,
    setup: config.setup,
    broker_id: config.broker_id,
    broker_code: config.broker_code,
    broker_name: config.broker_name,
    accumulation_period: config.accumulation_period,
    destination_type: config.destination_type,
    from,
    to,
    qualified: result.data.length,
    candidates: candidates.length,
    signals: signals.length,
    missing_market_data: missingMarketData,
    low_volume: lowVolume,
    invalid_sr: invalidSR,
  };

  if (signals.length === 0) {
    const notification = await notifyNoCandidates(config, from, to, {
      accumulationRows: result.data.length,
      candidates: candidates.length,
      analyzed: candidates.length - missingMarketData,
      rejected: candidates.length - missingMarketData,
      missingMarketData,
    });

    return {
      ...baseResult,
      sent: 0,
      symbols: [],
      no_candidate_notification_sent: notification.sent,
      no_candidate_notification_skipped_duplicate: notification.skippedDuplicate,
    };
  }

  const newSignals: TradeSignalRow[] = [];

  for (const row of signals) {
    if (await claimSignal(config, row, from, to)) {
      newSignals.push(row);
    }
  }

  if (newSignals.length === 0) {
    return {
      ...baseResult,
      sent: 0,
      symbols: [],
      message: "Semua signal sudah pernah dikirim.",
    };
  }

  const chunks = buildSignalChunks(
    newSignals,
    config,
    from,
    to,
  );

  let totalSent = 0;
  const sentSymbols: string[] = [];

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];

    console.log("[TRADE PLANE] Sending Telegram chunk:", {
      uid: config.uid,
      setup: config.setup,
      broker: config.broker_code,
      chunk: `${index + 1}/${chunks.length}`,
      symbols: chunk.rows.map((row) => row.symbol),
    });

    try {
      await sendToDestination(config, chunk.message);

      for (const row of chunk.rows) {
        await updateSignalStatus(
          config,
          row,
          from,
          to,
          "sent",
          {
            sentAt: FieldValue.serverTimestamp(),
            sentDestination: config.destination_target,
            error: FieldValue.delete(),
          },
        );

        totalSent++;
        sentSymbols.push(row.symbol);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error("[TRADE PLANE] Chunk failed:", {
        uid: config.uid,
        setup: config.setup,
        chunk: `${index + 1}/${chunks.length}`,
        error: errorMessage,
      });

      for (const row of chunk.rows) {
        await updateSignalStatus(
          config,
          row,
          from,
          to,
          "failed",
          { error: errorMessage },
        );
      }

      break;
    }
  }

  return {
    ...baseResult,
    new_signals: newSignals.length,
    chunks: chunks.length,
    sent: totalSent,
    symbols: sentSymbols,
  };
}

/* =========================================================
   PROCESS RETRACEMENT
========================================================= */

/**
 * Retracement memakai universe saham dari hasil akumulasi broker yang sama,
 * tetapi tidak menjalankan filter atau entry calculation Fishing Bottom.
 * Setiap saham dinilai menggunakan analyzeRetracement(history).
 */
async function processRetracement(
  config: TradePlaneDocument,
  from: string,
  to: string,
  historyCache: Map<string, StockHistoryData[]>,
): Promise<ProcessResult> {
  console.log("[TRADE PLANE] Processing strategy:", {
    uid: config.uid,
    broker: config.broker_code,
    broker_id: config.broker_id,
    setup: config.setup,
    from,
    to,
  });

  const result = await getAxentrazAccumulation({
    brokerId: config.broker_id,
    from,
    to,
  });

  // Filter akumulasi broker minimal 20% dari Axentraz.
const candidates = result.data.filter(
  (row) => row.accumulation_rate >= MIN_ACCUMULATION_RATE,
);
  const missingSymbols = candidates
    .map((row) => row.symbol.trim().toUpperCase())
    .filter((symbol) => symbol && !historyCache.has(symbol));

  if (missingSymbols.length > 0) {
    const histories = await getStockHistories(missingSymbols);
    for (const [symbol, history] of histories) {
      historyCache.set(symbol, history);
    }
  }

  const signals: TradeSignalRow[] = [];
  let missingMarketData = 0;
  let notEligible = 0;

  for (const row of candidates) {
    const symbol = row.symbol.trim().toUpperCase();
    const history = historyCache.get(symbol);

    if (!history?.length) {
      missingMarketData++;
      continue;
    }

    const analysis = analyzeRetracement(history);
    const latest = history[history.length - 1];
    const rawVolume = toNumber(latest.volume);
    const marketVolume = rawVolume * MARKET_VOLUME_SCALE;
    const historyClose = analysis.latestClose ?? toNumber(latest.close);

    console.log("[TRADE PLANE] Retracement analysis:", {
      uid: config.uid,
      setup: config.setup,
      symbol,
      eligible: analysis.eligible,
      trendConfirmed: analysis.trendConfirmed,
      entryConfirmed: analysis.entryConfirmed,
      reversalConfirmed: analysis.reversalConfirmed,
      volumeConfirmed: analysis.volumeConfirmed,
      reason: analysis.reason,
    });

    if (!analysis.eligible) {
      notEligible++;
      continue;
    }

    if (
      historyClose <= 0 ||
      analysis.entryLow === null ||
      analysis.entryHigh === null ||
      analysis.stopLoss === null ||
      analysis.takeProfit === null
    ) {
      notEligible++;
      continue;
    }

    signals.push({
      ...row,
      marketVolume,
      historyClose,
      entryLow: analysis.entryLow,
      entryHigh: analysis.entryHigh,
      tp: analysis.takeProfit,
      stopLoss: analysis.stopLoss,
      retracementConfirmation: {
        trend: analysis.trendConfirmed,
        entry: analysis.entryConfirmed,
        reversal: analysis.reversalConfirmed,
        volume: analysis.volumeConfirmed,
      },
    });
  }

  const baseResult = {
    uid: config.uid,
    setup: config.setup,
    broker_id: config.broker_id,
    broker_code: config.broker_code,
    broker_name: config.broker_name,
    accumulation_period: config.accumulation_period,
    destination_type: config.destination_type,
    from,
    to,
    qualified: result.data.length,
    candidates: candidates.length,
    signals: signals.length,
    missing_market_data: missingMarketData,
    not_eligible: notEligible,
  };

  if (signals.length === 0) {
    const notification = await notifyNoCandidates(config, from, to, {
      accumulationRows: result.data.length,
      candidates: candidates.length,
      analyzed: candidates.length - missingMarketData,
      rejected: notEligible,
      missingMarketData,
    });

    return {
      ...baseResult,
      sent: 0,
      symbols: [],
      no_candidate_notification_sent: notification.sent,
      no_candidate_notification_skipped_duplicate: notification.skippedDuplicate,
    };
  }

  const newSignals: TradeSignalRow[] = [];
  for (const row of signals) {
    if (await claimSignal(config, row, from, to)) {
      newSignals.push(row);
    }
  }

  if (newSignals.length === 0) {
    return {
      ...baseResult,
      sent: 0,
      symbols: [],
      message: "Semua signal sudah pernah dikirim.",
    };
  }

  const chunks = buildSignalChunks(newSignals, config, from, to);
  let totalSent = 0;
  const sentSymbols: string[] = [];

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];

    console.log("[TRADE PLANE] Sending Retracement chunk:", {
      uid: config.uid,
      setup: config.setup,
      broker: config.broker_code,
      chunk: `${index + 1}/${chunks.length}`,
      symbols: chunk.rows.map((item) => item.symbol),
    });

    try {
      await sendToDestination(config, chunk.message);

      for (const row of chunk.rows) {
        await updateSignalStatus(config, row, from, to, "sent", {
          sentAt: FieldValue.serverTimestamp(),
          sentDestination: config.destination_target,
          error: FieldValue.delete(),
        });
        totalSent++;
        sentSymbols.push(row.symbol);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error("[TRADE PLANE] Retracement chunk failed:", {
        uid: config.uid,
        setup: config.setup,
        chunk: `${index + 1}/${chunks.length}`,
        error: errorMessage,
      });

      for (const row of chunk.rows) {
        await updateSignalStatus(config, row, from, to, "failed", {
          error: errorMessage,
        });
      }
      break;
    }
  }

  return {
    ...baseResult,
    new_signals: newSignals.length,
    chunks: chunks.length,
    sent: totalSent,
    symbols: sentSymbols,
  };
}

/* =========================================================
   AUTHENTICATION
========================================================= */

function getRequestSecret(request: NextRequest): string {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  const syncSecret = request.headers.get("x-sync-secret");

  if (syncSecret?.trim()) return syncSecret.trim();

  return (request.headers.get("x-cron-secret") ?? "").trim();
}

function isAuthorized(request: NextRequest): boolean {
  const requestSecret = getRequestSecret(request);

  if (!requestSecret) return false;

  const syncSecret = process.env.SYNC_SECRET?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();

  return (
    (Boolean(syncSecret) && requestSecret === syncSecret) ||
    (Boolean(cronSecret) && requestSecret === cronSecret)
  );
}

/* =========================================================
   GET /api/admin/sync-signal
========================================================= */

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const tradePlanes = await getEnabledTradePlanes();

    console.log("[SYNC SIGNAL] Loaded configurations:", {
      total: tradePlanes.length,
      configurations: tradePlanes.map((config) => ({
        uid: config.uid,
        broker_code: config.broker_code,
        broker_id: config.broker_id,
        setup: config.setup,
        accumulation_period: config.accumulation_period,
      })),
    });

    const historyCache = new Map<string, StockHistoryData[]>();
    const results: Array<Record<string, unknown>> = [];

    let sent = 0;

    for (const config of tradePlanes) {
      try {
        const { from, to } = getAccumulationPeriodRange(
          config.accumulation_period,
        );

        console.log("[SYNC SIGNAL] Processing configuration:", {
          uid: config.uid,
          broker_code: config.broker_code,
          broker_id: config.broker_id,
          setup: config.setup,
          destination_type: config.destination_type,
          destination_target: config.destination_target,
          period: config.accumulation_period,
          from,
          to,
        });

        const result =
          config.setup === "retracement"
            ? await processRetracement(config, from, to, historyCache)
            : await processFishingBottom(config, from, to, historyCache);

        results.push({
          ...result,
          success: true,
        });

        sent += result.sent;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error("[SYNC SIGNAL] Configuration failed:", {
          uid: config.uid,
          broker_code: config.broker_code,
          broker_id: config.broker_id,
          setup: config.setup,
          error: errorMessage,
        });

        results.push({
          uid: config.uid,
          setup: config.setup,
          broker_id: config.broker_id,
          broker_code: config.broker_code,
          broker_name: config.broker_name,
          accumulation_period: config.accumulation_period,
          destination_type: config.destination_type,
          success: false,
          sent: 0,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Trade Plane signal sync selesai.",
      today: getJakartaDate(),
      history_symbols: historyCache.size,
      enabled_users: tradePlanes.length,
      processed: results.length,
      sent,
      results,
    });
  } catch (error) {
    console.error("[SYNC SIGNAL] Sync error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
