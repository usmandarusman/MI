import { NextRequest, NextResponse } from "next/server";

import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/firebase-admin";

import {
  getAxentrazAccumulation,
  type AxentrazResult,
} from "@/lib/axentraz-accumulation";

import { sendTelegramMessage } from "@/lib/telegram";

import {
  analyzeSupportResistance,
  SRHistory,
} from "@/app/components/stock-chart/support-resistance";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

/* =========================================================
   CONFIG
========================================================= */

const SIGNAL_COLLECTION = "trade-signals";

const MIN_ACCUMULATION_RATE = 20;

/*
 * Volume berasal dari:
 *
 * stocks/{SYMBOL}/history/{latest-date}
 *
 * Kemudian volume di-scale × 0.01,
 * sama seperti format volume sebelumnya.
 */
const MARKET_VOLUME_SCALE = 0.01;

const MIN_MARKET_VOLUME = 50_000;

/*
 * Maksimum query Firestore yang berjalan bersamaan
 * ketika mengambil stock history.
 */
const HISTORY_QUERY_CONCURRENCY = 12;

/*
 * Jumlah candle yang digunakan untuk
 * analisis Support / Resistance.
 *
 * 120 hari trading kurang lebih memberi
 * konteks sekitar 5-6 bulan bursa.
 */
const SR_HISTORY_LIMIT = 120;

const TELEGRAM_MAX_LENGTH = 3500;

const SENDING_TIMEOUT_MS =
  10 * 60 * 1000;

/* =========================================================
   TYPES
========================================================= */

type AccumulationPeriod =
  | "1w"
  | "mtd"
  | "1m"
  | "2m"
  | "3m";

type DestinationType =
  | "telegram"
  | "whatsapp";

type TradePlaneConfig = {
  enabled: boolean;

  broker_code: string;

  broker_id: number;

  broker_name: string;

  destination_type:
    DestinationType;

  destination_target: string;

  /*
   * Periode pengambilan data
   * broker accumulation dari Axentraz.
   */
  accumulation_period:
    AccumulationPeriod;
};

type TradePlaneDocument =
  TradePlaneConfig & {
    uid: string;
  };

type SignalStatus =
  | "sending"
  | "sent"
  | "failed";

/* =========================================================
   STOCK HISTORY DATA
========================================================= */

type StockHistoryData = {
  code?: string;

  date?: string;

  open?: number;

  high?: number;

  low?: number;

  close?: number;

  volume?: number;

  value?: number;
};

/* =========================================================
   TRADE SIGNAL ROW
========================================================= */

type TradeSignalRow =
  AxentrazResult & {
    /*
     * Volume setelah scaling.
     *
     * Raw Firestore volume:
     * stocks/{SYMBOL}/history/{DATE}
     *
     * marketVolume:
     * raw volume × 0.01
     */
    marketVolume: number;

    /*
     * Last Price dari Firestore.
     */
    historyClose: number;

    /*
     * Entry Area.
     *
     * FIELD TRANSIENT:
     * hanya digunakan ketika membuat Telegram.
     *
     * TIDAK disimpan ke Firestore.
     */
    entryLow: number | null;

    entryHigh: number | null;

    /*
     * TP juga TRANSIENT.
     *
     * TIDAK disimpan ke Firestore.
     */
    tp: number | null;
  };

/* =========================================================
   FIRESTORE SIGNAL DOCUMENT
=========================================================

   PENTING:

   entryLow
   entryHigh
   tp

   TIDAK dimasukkan ke SignalDocument.

   Jadi struktur Firestore lama tetap aman.
========================================================= */

type SignalDocument = {
  uid: string;

  symbol: string;

  brokerId: number;

  brokerCode: string;

  brokerName: string;

  accumulation: number;

  accumulationRate: number;

  /*
   * Last Price dari Firestore history.close
   */
  lastClose: number;

  ma20: number;

  /*
   * Volume yang sudah di-scale × 0.01.
   */
  volume: number;

  from: string;

  to: string;

  status: SignalStatus;

  createdAt:
    | FirebaseFirestore.FieldValue
    | Date;

  updatedAt:
    | FirebaseFirestore.FieldValue
    | Date;

  sentAt?:
    | FirebaseFirestore.FieldValue
    | Date;

  sentDestination?: string;

  error?: string;
};

/* =========================================================
   NUMBER
========================================================= */

function toNumber(
  value: unknown
): number {
  if (
    typeof value ===
    "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : 0;
  }

  if (
    typeof value ===
    "string"
  ) {
    const number =
      Number(
        value
          .trim()
          .replace(
            /,/g,
            ""
          )
      );

    return Number.isFinite(
      number
    )
      ? number
      : 0;
  }

  return 0;
}

/* =========================================================
   STOCK HISTORY NORMALIZER
========================================================= */

function normalizeStockHistory(
  data: StockHistoryData,
  fallbackDate: string,
  fallbackCode: string
): StockHistoryData {
  return {
    code:
      typeof data.code ===
      "string"
        ? data.code
        : fallbackCode,

    date:
      typeof data.date ===
      "string"
        ? data.date
        : fallbackDate,

    open: toNumber(
      data.open
    ),

    high: toNumber(
      data.high
    ),

    low: toNumber(
      data.low
    ),

    close: toNumber(
      data.close
    ),

    volume: toNumber(
      data.volume
    ),

    value: toNumber(
      data.value
    ),
  };
}

/* =========================================================
   STOCK HISTORY
=========================================================

   Ambil history 120 candle terakhir.

   Firestore:
   stocks/{SYMBOL}/history/{DATE}

   Query DESC untuk efisien,
   lalu dibalik menjadi ASC agar cocok
   dengan engine Support/Resistance.
========================================================= */

async function getStockHistory(
  symbol: string
): Promise<
  StockHistoryData[]
> {
  const normalizedSymbol =
    symbol
      .trim()
      .toUpperCase();

  if (
    !normalizedSymbol
  ) {
    return [];
  }

  const snapshot =
    await db
      .collection(
        "stocks"
      )
      .doc(
        normalizedSymbol
      )
      .collection(
        "history"
      )
      .orderBy(
        "date",
        "desc"
      )
      .limit(
        SR_HISTORY_LIMIT
      )
      .get();

  if (
    snapshot.empty
  ) {
    return [];
  }

  const rows =
    snapshot.docs.map(
      (doc) => {
        const data =
          doc.data() as StockHistoryData;

        return normalizeStockHistory(
          data,
          doc.id,
          normalizedSymbol
        );
      }
    );

  /*
   * Engine membutuhkan data
   * oldest -> newest.
   */
  rows.reverse();

  return rows;
}

/* =========================================================
   STOCK HISTORY BATCH
=========================================================

   - deduplicate symbol
   - cache hasil dalam 1 request
   - batasi concurrency
   - satu query mengambil sampai 120 candle
========================================================= */

async function getStockHistories(
  symbols: string[]
): Promise<
  Map<
    string,
    StockHistoryData[]
  >
> {
  const uniqueSymbols = [
    ...new Set(
      symbols
        .map(
          (symbol) =>
            symbol
              .trim()
              .toUpperCase()
        )
        .filter(Boolean)
    ),
  ];

  const result =
    new Map<
      string,
      StockHistoryData[]
    >();

  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index =
        cursor++;

      if (
        index >=
        uniqueSymbols.length
      ) {
        return;
      }

      const symbol =
        uniqueSymbols[
          index
        ];

      try {
        const history =
          await getStockHistory(
            symbol
          );

        if (
          history.length >
          0
        ) {
          result.set(
            symbol,
            history
          );
        }
      } catch (error) {
        console.error(
          "[TRADE PLANE] History query failed:",
          {
            symbol,

            error:
              error instanceof
              Error
                ? error.message
                : String(
                    error
                  ),
          }
        );
      }
    }
  }

  const workerCount =
    Math.min(
      HISTORY_QUERY_CONCURRENCY,
      uniqueSymbols.length
    );

  if (
    workerCount === 0
  ) {
    return result;
  }

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker()
    )
  );

  return result;
}

/* =========================================================
   ENTRY AREA + TP
========================================================= */

type EntryTarget = {
  entryLow: number | null;

  entryHigh: number | null;

  tp: number | null;
};

/*
 * Menghitung:
 *
 * Entry Area
 * = entryZone.low -> entryZone.high
 *
 * Support
 * = entryZone.support.center
 *
 * Resistance
 * = entryZone.resistance.center
 *
 * TP
 * = Support + 50% ×
 *   (Resistance - Support)
 *
 * atau:
 *
 * TP = (Support + Resistance) / 2
 *
 * PENTING:
 * fungsi ini hanya untuk Telegram.
 *
 * Hasil TIDAK disimpan ke Firestore.
 */
function calculateEntryTarget(
  history: StockHistoryData[]
): EntryTarget {
  if (
    history.length <
    20
  ) {
    return {
      entryLow: null,
      entryHigh: null,
      tp: null,
    };
  }

  const srHistory: SRHistory[] =
    history
      .map(
        (item) => ({
          date:
            String(
              item.date ??
                ""
            ),

          open: toNumber(
            item.open
          ),

          high: toNumber(
            item.high
          ),

          low: toNumber(
            item.low
          ),

          close: toNumber(
            item.close
          ),

          volume: toNumber(
            item.volume
          ),
        })
      )
      .filter(
        (item) =>
          item.date &&
          item.open > 0 &&
          item.high > 0 &&
          item.low > 0 &&
          item.close > 0
      );

  if (
    srHistory.length <
    20
  ) {
    return {
      entryLow: null,
      entryHigh: null,
      tp: null,
    };
  }

  const analysis =
    analyzeSupportResistance(
      srHistory
    );

  if (
    !analysis ||
    !analysis.entryZone
  ) {
    return {
      entryLow: null,
      entryHigh: null,
      tp: null,
    };
  }

  const entryZone =
    analysis.entryZone;

  const entryLow =
    Number.isFinite(
      entryZone.low
    )
      ? entryZone.low
      : null;

  const entryHigh =
    Number.isFinite(
      entryZone.high
    )
      ? entryZone.high
      : null;

  /*
   * Resistance harus tersedia
   * agar TP 50% dapat dihitung.
   */
  if (
    !entryZone.resistance
  ) {
    return {
      entryLow,
      entryHigh,
      tp: null,
    };
  }

  const support =
    entryZone.support
      .center;

  const resistance =
    entryZone.resistance
      .center;

  if (
    !Number.isFinite(
      support
    ) ||
    !Number.isFinite(
      resistance
    ) ||
    support <= 0 ||
    resistance <=
      support
  ) {
    return {
      entryLow,
      entryHigh,
      tp: null,
    };
  }

  /*
   * TP EXACT 50% antara
   * Support dan Resistance.
   */
  const tp =
    support +
    (resistance -
      support) *
      0.5;

  return {
    entryLow,
    entryHigh,
    tp:
      Number.isFinite(
        tp
      )
        ? tp
        : null,
  };
}

/* =========================================================
   DATE
========================================================= */

function getJakartaDate(): string {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Jakarta",

        year: "numeric",

        month: "2-digit",

        day: "2-digit",
      }
    );

  return formatter
    .format(new Date())
    .replace(
      /-/g,
      ""
    );
}

/*
 * Validasi accumulation period
 * yang tersimpan di Firebase.
 */
function isAccumulationPeriod(
  value: unknown
): value is AccumulationPeriod {
  return (
    value === "1w" ||
    value === "mtd" ||
    value === "1m" ||
    value === "2m" ||
    value === "3m"
  );
}

/*
 * Convert YYYYMMDD menjadi Date UTC.
 *
 * UTC digunakan hanya sebagai media
 * operasi kalender supaya hasil tidak
 * terpengaruh timezone server.
 */
function parseDateYYYYMMDD(
  value: string
): Date {
  const year =
    Number(
      value.slice(
        0,
        4
      )
    );

  const month =
    Number(
      value.slice(
        4,
        6
      )
    ) - 1;

  const day =
    Number(
      value.slice(
        6,
        8
      )
    );

  return new Date(
    Date.UTC(
      year,
      month,
      day
    )
  );
}

/*
 * Convert Date UTC menjadi YYYYMMDD.
 */
function formatDateYYYYMMDD(
  date: Date
): string {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}${month}${day}`
  );
}

/*
 * Kurangi hari kalender.
 */
function subtractDays(
  dateString: string,
  days: number
): string {
  const date =
    parseDateYYYYMMDD(
      dateString
    );

  date.setUTCDate(
    date.getUTCDate() -
      days
  );

  return formatDateYYYYMMDD(
    date
  );
}

/*
 * Kurangi bulan dengan clamp
 * ke hari terakhir bulan tujuan.
 *
 * Contoh:
 *
 * 20260331 - 1 bulan
 * -> 20260228
 *
 * 20240331 - 1 bulan
 * -> 20240229
 */
function subtractMonthsClamped(
  dateString: string,
  months: number
): string {
  const date =
    parseDateYYYYMMDD(
      dateString
    );

  const originalDay =
    date.getUTCDate();

  const currentMonth =
    date.getUTCMonth();

  const currentYear =
    date.getUTCFullYear();

  const targetMonthIndex =
    currentMonth -
    months;

  const targetYear =
    currentYear +
    Math.floor(
      targetMonthIndex /
        12
    );

  const normalizedMonth =
    (
      targetMonthIndex %
        12 +
      12
    ) % 12;

  const lastDayOfTargetMonth =
    new Date(
      Date.UTC(
        targetYear,
        normalizedMonth +
          1,
        0
      )
    ).getUTCDate();

  const targetDay =
    Math.min(
      originalDay,
      lastDayOfTargetMonth
    );

  return formatDateYYYYMMDD(
    new Date(
      Date.UTC(
        targetYear,
        normalizedMonth,
        targetDay
      )
    )
  );
}

/*
 * Tentukan from/to berdasarkan
 * accumulation_period dari Firebase.
 *
 * 1w:
 *   7 hari kalender termasuk hari ini
 *
 * mtd:
 *   tanggal 1 bulan berjalan -> hari ini
 *
 * 1m:
 *   tanggal yang sama bulan lalu -> hari ini
 *
 * 2m:
 *   tanggal yang sama 2 bulan lalu -> hari ini
 *
 * 3m:
 *   tanggal yang sama 3 bulan lalu -> hari ini
 */
function getAccumulationPeriodRange(
  period: AccumulationPeriod
): {
  from: string;
  to: string;
} {
  const to =
    getJakartaDate();

  switch (period) {
    case "1w":
      return {
        from:
          subtractDays(
            to,
            6
          ),

        to,
      };

    case "mtd":
      return {
        from:
          `${to.slice(
            0,
            6
          )}01`,

        to,
      };

    case "1m":
      return {
        from:
          subtractMonthsClamped(
            to,
            1
          ),

        to,
      };

    case "2m":
      return {
        from:
          subtractMonthsClamped(
            to,
            2
          ),

        to,
      };

    case "3m":
      return {
        from:
          subtractMonthsClamped(
            to,
            3
          ),

        to,
      };
  }
}

function formatDate(
  value: string
): string {
  if (
    !value ||
    !/^\d{8}$/.test(
      value
    )
  ) {
    return value;
  }

  return (
    `${value.slice(
      6,
      8
    )}/` +
    `${value.slice(
      4,
      6
    )}/` +
    `${value.slice(
      0,
      4
    )}`
  );
}

/* =========================================================
   NUMBER FORMAT
========================================================= */

function formatNumber(
  value: number,
  maximumFractionDigits = 2
): string {
  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits,
    }
  ).format(value);
}

/* =========================================================
   COMPACT NUMBER FORMAT
========================================================= */

function formatCompactNumber(
  value: number,
  maximumFractionDigits = 2
): string {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return "0";
  }

  const absolute =
    Math.abs(value);

  const sign =
    value < 0
      ? "-"
      : "";

  if (
    absolute >=
    1_000_000_000_000
  ) {
    return (
      sign +
      formatNumber(
        absolute /
          1_000_000_000_000,
        maximumFractionDigits
      ) +
      "T"
    );
  }

  if (
    absolute >=
    1_000_000_000
  ) {
    return (
      sign +
      formatNumber(
        absolute /
          1_000_000_000,
        maximumFractionDigits
      ) +
      "B"
    );
  }

  if (
    absolute >=
    1_000_000
  ) {
    return (
      sign +
      formatNumber(
        absolute /
          1_000_000,
        maximumFractionDigits
      ) +
      "M"
    );
  }

  if (
    absolute >=
    1_000
  ) {
    return (
      sign +
      formatNumber(
        absolute /
          1_000,
        maximumFractionDigits
      ) +
      "K"
    );
  }

  return formatNumber(
    value,
    maximumFractionDigits
  );
}

function formatSignedPercent(
  value: number
): string {
  const absolute =
    Math.abs(value);

  const formatted =
    formatNumber(
      absolute
    );

  if (value > 0) {
    return `+${formatted}%`;
  }

  if (value < 0) {
    return `-${formatted}%`;
  }

  return "0%";
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
  value: string
): string {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    );
}

/* =========================================================
   SIGNAL HEADER
========================================================= */

function buildSignalHeader(
  config: TradePlaneConfig,
  from: string,
  to: string
): string {
  return (
    `🚨 TRADE SIGNAL\n\n` +
    `🏢 Broker Accumulator\n` +
    `${escapeHtml(
      config.broker_code
    )} — ` +
    `${escapeHtml(
      config.broker_name
    )}\n\n` +
    `📅 Periode\n` +
    `${formatDate(
      from
    )} — ` +
    `${formatDate(
      to
    )}\n\n` +
    `━━━━━━━━━━━━━━━━━━`
  );
}

/* =========================================================
   SIGNAL BLOCK
========================================================= */

function buildSignalBlock(
  row: TradeSignalRow
): string {
  const symbol =
    escapeHtml(
      row.symbol
    );

  const stockbitUrl =
    `https://stockbit.com/#/symbol/` +
    encodeURIComponent(
      row.symbol
    );

  const entryArea =
    row.entryLow !==
      null &&
    row.entryHigh !==
      null
      ? `${formatNumber(
          row.entryLow
        )} — ${formatNumber(
          row.entryHigh
        )}`
      : "-";

  const tp =
    row.tp !== null
      ? formatNumber(
          row.tp
        )
      : "-";

  return (
    `📌 <a href="${stockbitUrl}">${symbol}</a>\n\n` +

    `🔥 Accumulation: ` +
    `${formatSignedPercent(
      row.accumulation
    )}\n` +

    `⚡ Rate: ` +
    `${formatNumber(
      row.accumulation_rate
    )}%\n` +

    /*
     * Last Price SEKARANG dari Firestore history.close.
     */
    `📊 Last Price: ` +
    `${formatNumber(
      row.historyClose
    )}\n` +

    /*
     * Volume sudah scaled × 0.01.
     */
    `📦 Volume: ` +
    `${formatCompactNumber(
      row.marketVolume
    )}\n` +

    /*
     * Entry Area hasil Support/Resistance engine.
     */
    `🎯 Entry Area: ` +
    `${entryArea}\n` +

    /*
     * TP = 50% antara center Support
     * dan center Resistance.
     */
    `🏁 TP: ` +
    `${tp}\n\n` +

    `━━━━━━━━━━━━━━━━━━`
  );
}

/* =========================================================
   TELEGRAM CHUNKS
========================================================= */

type SignalChunk = {
  rows: TradeSignalRow[];

  message: string;
};

function buildSignalChunks(
  rows: TradeSignalRow[],
  config: TradePlaneConfig,
  from: string,
  to: string
): SignalChunk[] {
  const header =
    buildSignalHeader(
      config,
      from,
      to
    );

  const chunks: SignalChunk[] =
    [];

  let currentRows:
    TradeSignalRow[] = [];

  let currentMessage =
    header;

  for (
    const row of rows
  ) {
    const block =
      `\n\n` +
      buildSignalBlock(
        row
      );

    if (
      currentMessage.length +
        block.length <=
      TELEGRAM_MAX_LENGTH
    ) {
      currentRows.push(
        row
      );

      currentMessage +=
        block;

      continue;
    }

    if (
      currentRows.length >
      0
    ) {
      chunks.push({
        rows:
          currentRows,

        message:
          currentMessage,
      });
    }

    currentRows = [
      row,
    ];

    currentMessage =
      header +
      `\n\n` +
      buildSignalBlock(
        row
      );
  }

  if (
    currentRows.length >
    0
  ) {
    chunks.push({
      rows:
        currentRows,

      message:
        currentMessage,
    });
  }

  return chunks;
}

/* =========================================================
   ENABLED TRADE PLANES
========================================================= */

async function getEnabledTradePlanes(): Promise<
  TradePlaneDocument[]
> {
  const snapshot =
    await db
      .collection(
        "trade-plane"
      )
      .where(
        "enabled",
        "==",
        true
      )
      .get();

  return snapshot.docs
    .map((doc) => {
      const data =
        doc.data() as Partial<TradePlaneConfig>;

      /*
       * broker_id diambil langsung
       * dari Firestore.
       *
       * Tidak ada mapping hard-code.
       */

      if (
        typeof data.broker_id !==
          "number" ||
        !Number.isInteger(
          data.broker_id
        ) ||
        data.broker_id <= 0
      ) {
        console.error(
          "[TRADE PLANE] Invalid broker_id:",
          {
            uid:
              doc.id,

            broker_id:
              data.broker_id,
          }
        );

        return null;
      }

      /*
       * Ambil accumulation_period
       * dari Firebase.
       *
       * Kalau field belum ada atau
       * nilainya tidak valid, gunakan
       * MTD sebagai fallback.
       */
      const accumulationPeriod =
        isAccumulationPeriod(
          data.accumulation_period
        )
          ? data.accumulation_period
          : "mtd";

      return {
        uid:
          doc.id,

        enabled:
          true,

        broker_code:
          typeof data.broker_code ===
          "string"
            ? data.broker_code
            : "",

        broker_id:
          data.broker_id,

        broker_name:
          typeof data.broker_name ===
          "string"
            ? data.broker_name
            : "",

        destination_type:
          data.destination_type ===
          "whatsapp"
            ? "whatsapp"
            : "telegram",

        destination_target:
          typeof data.destination_target ===
          "string"
            ? data.destination_target
            : "",

        accumulation_period:
          accumulationPeriod,
      };
    })
    .filter(
      (
        item
      ): item is TradePlaneDocument =>
        item !== null
    );
}

/* =========================================================
   CLAIM SIGNAL
========================================================= */

async function claimSignal(
  config: TradePlaneDocument,
  row: TradeSignalRow,
  from: string,
  to: string
): Promise<boolean> {
  /*
   * from + to sengaja dimasukkan ke ID.
   *
   * Jadi:
   *
   * CC + BBCA + 1W
   *
   * tidak bentrok dengan:
   *
   * CC + BBCA + 1M
   *
   * pada tanggal to yang sama.
   */
  const signalId =
    `${config.uid}_` +
    `${config.broker_id}_` +
    `${row.symbol}_` +
    `${from}_` +
    `${to}`;

  const ref =
    db
      .collection(
        SIGNAL_COLLECTION
      )
      .doc(
        signalId
      );

  return db.runTransaction(
    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          ref
        );

      if (
        snapshot.exists
      ) {
        const data =
          snapshot.data() as Partial<SignalDocument>;

        /*
         * Jangan kirim ulang
         * kalau sudah sent.
         */
        if (
          data.status ===
          "sent"
        ) {
          return false;
        }

        /*
         * Cegah duplicate send
         * ketika status masih sending.
         */
        if (
          data.status ===
            "sending" &&
          data.updatedAt
        ) {
          const updatedAtValue =
            data.updatedAt;

          let updatedAtMs:
            | number
            | null = null;

          if (
            updatedAtValue instanceof
            Date
          ) {
            updatedAtMs =
              updatedAtValue.getTime();
          } else if (
            typeof updatedAtValue ===
              "object" &&
            updatedAtValue !==
              null &&
            "toDate" in
              updatedAtValue &&
            typeof (
              updatedAtValue as {
                toDate?: unknown;
              }
            ).toDate ===
              "function"
          ) {
            updatedAtMs =
              (
                updatedAtValue as {
                  toDate: () => Date;
                }
              )
                .toDate()
                .getTime();
          }

          if (
            updatedAtMs !==
              null &&
            Date.now() -
              updatedAtMs <
              SENDING_TIMEOUT_MS
          ) {
            return false;
          }
        }
      }

      /*
       * PENTING:
       *
       * entryLow
       * entryHigh
       * tp
       *
       * TIDAK dimasukkan.
       *
       * Jadi Firestore schema lama
       * tetap sama.
       */
      const signalData:
        SignalDocument = {
        uid:
          config.uid,

        symbol:
          row.symbol,

        brokerId:
          config.broker_id,

        brokerCode:
          config.broker_code,

        brokerName:
          config.broker_name,

        accumulation:
          row.accumulation,

        accumulationRate:
          row.accumulation_rate,

        /*
         * LAST PRICE DARI FIRESTORE
         */
        lastClose:
          row.historyClose,

        ma20:
          row.ma20,

        /*
         * Volume yang disimpan adalah
         * volume setelah scaling × 0.01.
         */
        volume:
          row.marketVolume,

        from,

        to,

        status:
          "sending",

        createdAt:
          snapshot.exists
            ? snapshot
                .data()
                ?.createdAt ??
              FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      };

      transaction.set(
        ref,
        signalData,
        {
          merge:
            true,
        }
      );

      return true;
    }
  );
}

/* =========================================================
   UPDATE SIGNAL STATUS
========================================================= */

async function updateSignalStatus(
  config: TradePlaneDocument,
  row: TradeSignalRow,
  from: string,
  to: string,
  status: SignalStatus,
  extra: Record<
    string,
    unknown
  > = {}
) {
  /*
   * Harus sama persis dengan
   * signalId di claimSignal().
   */
  const signalId =
    `${config.uid}_` +
    `${config.broker_id}_` +
    `${row.symbol}_` +
    `${from}_` +
    `${to}`;

  await db
    .collection(
      SIGNAL_COLLECTION
    )
    .doc(
      signalId
    )
    .set(
      {
        status,

        updatedAt:
          FieldValue.serverTimestamp(),

        ...extra,
      },
      {
        merge:
          true,
      }
    );
}

/* =========================================================
   SEND DESTINATION
========================================================= */

async function sendToDestination(
  config: TradePlaneDocument,
  message: string
) {
  if (
    config.destination_type ===
    "telegram"
  ) {
    return sendTelegramMessage(
      message,

      config.destination_target,

      "HTML"
    );
  }

  throw new Error(
    "Destination WhatsApp belum memiliki sender/API."
  );
}

/* =========================================================
   PROCESS TRADE PLANE
========================================================= */

async function processTradePlane(
  config: TradePlaneDocument,
  from: string,
  to: string,
  historyCache: Map<
    string,
    StockHistoryData[]
  >
) {
  console.log(
    "[TRADE PLANE] Processing:",
    {
      uid:
        config.uid,

      broker:
        config.broker_code,

      brokerId:
        config.broker_id,

      accumulationPeriod:
        config.accumulation_period,

      from,

      to,

      destination:
        config.destination_type,
    }
  );

  /* =====================================================
     1. GET BROKER ACCUMULATION
  ===================================================== */

  const result =
    await getAxentrazAccumulation({
      brokerId:
        config.broker_id,

      from,

      to,
    });

  /* =====================================================
     2. FILTER BROKER SIGNAL
  ===================================================== */

  const candidates =
    result.data.filter(
      (row) =>
        row.accumulation_rate >=
          MIN_ACCUMULATION_RATE &&

        row.ma20 > 0 &&

        row.last_close <
          row.ma20
    );

  /*
   * Ambil hanya symbol yang belum ada di cache.
   */
  const missingSymbols =
    candidates
      .map(
        (row) =>
          row.symbol
            .trim()
            .toUpperCase()
      )
      .filter(
        (symbol) =>
          symbol &&
          !historyCache.has(
            symbol
          )
      );

  if (
    missingSymbols.length >
    0
  ) {
    const histories =
      await getStockHistories(
        missingSymbols
      );

    for (
      const [
        symbol,
        history,
      ] of histories
    ) {
      historyCache.set(
        symbol,
        history
      );
    }
  }

  console.log(
    "[TRADE PLANE] Candidates:",
    {
      uid:
        config.uid,

      broker:
        config.broker_code,

      qualified:
        result.data.length,

      candidates:
        candidates.length,
    }
  );

  /* =====================================================
     3. MATCH DENGAN STOCK HISTORY
  ===================================================== */

  const signals:
    TradeSignalRow[] = [];

  let missingMarketData =
    0;

  let lowVolume = 0;

  let invalidSR = 0;

  for (
    const row of candidates
  ) {
    const symbol =
      row.symbol
        .trim()
        .toUpperCase();

    const history =
      historyCache.get(
        symbol
      );

    /*
     * Tidak ditemukan history.
     */
    if (
      !history ||
      history.length === 0
    ) {
      missingMarketData++;

      console.log(
        "[TRADE PLANE] Stock history missing:",
        symbol
      );

      continue;
    }

    /*
     * Ambil candle TERBARU.
     *
     * getStockHistory()
     * sudah mengembalikan data ASC.
     */
    const latest =
      history[
        history.length - 1
      ];

    /* =================================================
       RAW VOLUME FIRESTORE
    ================================================= */

    const rawVolume =
      toNumber(
        latest.volume
      );

    /* =================================================
       SCALED VOLUME
    ================================================= */

    const volume =
      rawVolume *
      MARKET_VOLUME_SCALE;

    /* =================================================
       LAST PRICE DARI FIRESTORE
    ================================================= */

    const historyClose =
      toNumber(
        latest.close
      );

    console.log(
      "[TRADE PLANE] STOCK HISTORY CHECK:",
      {
        symbol,

        date:
          latest.date,

        rawVolume,

        scale:
          MARKET_VOLUME_SCALE,

        scaledVolume:
          volume,

        compactVolume:
          formatCompactNumber(
            volume
          ),

        historyClose,

        threshold:
          MIN_MARKET_VOLUME,

        passed:
          volume >
          MIN_MARKET_VOLUME,

        historyRows:
          history.length,
      }
    );

    /*
     * HARUS LEBIH BESAR DARI 50K.
     */
    if (
      volume <=
      MIN_MARKET_VOLUME
    ) {
      lowVolume++;

      console.log(
        "[TRADE PLANE] REJECT LOW VOLUME:",
        {
          symbol,

          rawVolume,

          scaledVolume:
            volume,

          compact:
            formatCompactNumber(
              volume
            ),

          threshold:
            MIN_MARKET_VOLUME,
        }
      );

      continue;
    }

    /*
     * Kalau close tidak valid,
     * jangan kirim signal.
     */
    if (
      historyClose <= 0
    ) {
      console.log(
        "[TRADE PLANE] REJECT INVALID CLOSE:",
        {
          symbol,

          historyClose,

          date:
            latest.date,
        }
      );

      continue;
    }

    /* =================================================
       SUPPORT / RESISTANCE
    ================================================= */

    const entryTarget =
      calculateEntryTarget(
        history
      );

    /*
     * Kalau engine tidak menemukan
     * Entry Area, signal tetap boleh
     * diproses karena filter existing
     * tidak berubah.
     *
     * Telegram akan menampilkan "-"
     * untuk Entry Area / TP.
     *
     * Jadi S/R TIDAK menjadi filter
     * baru yang bisa menghilangkan
     * signal existing.
     */
    if (
      entryTarget.entryLow ===
        null ||
      entryTarget.entryHigh ===
        null
    ) {
      invalidSR++;

      console.log(
        "[TRADE PLANE] S/R unavailable:",
        {
          symbol,

          historyRows:
            history.length,

          historyClose,

          entryLow:
            entryTarget.entryLow,

          entryHigh:
            entryTarget.entryHigh,

          tp:
            entryTarget.tp,
        }
      );
    } else {
      console.log(
        "[TRADE PLANE] S/R RESULT:",
        {
          symbol,

          entryLow:
            entryTarget.entryLow,

          entryHigh:
            entryTarget.entryHigh,

          tp:
            entryTarget.tp,
        }
      );
    }

    const signal:
      TradeSignalRow = {
      ...row,

      /*
       * Volume dari Firestore
       * setelah × 0.01.
       */
      marketVolume:
        volume,

      /*
       * Last Price dari
       * Firestore history.close.
       */
      historyClose,

      /*
       * Entry Area:
       * hanya transient.
       */
      entryLow:
        entryTarget.entryLow,

      entryHigh:
        entryTarget.entryHigh,

      /*
       * TP:
       * hanya transient.
       *
       * TIDAK masuk Firestore.
       */
      tp:
        entryTarget.tp,
    };

    signals.push(
      signal
    );
  }

  console.log(
    "[TRADE PLANE] Signals:",
    {
      uid:
        config.uid,

      broker:
        config.broker_code,

      qualified:
        result.data.length,

      candidates:
        candidates.length,

      signals:
        signals.length,

      missingMarketData,

      lowVolume,

      invalidSR,
    }
  );

  /* =====================================================
     NO SIGNAL
  ===================================================== */

  if (
    signals.length === 0
  ) {
    return {
      uid:
        config.uid,

      broker_id:
        config.broker_id,

      broker_code:
        config.broker_code,

      broker_name:
        config.broker_name,

      accumulation_period:
        config.accumulation_period,

      destination_type:
        config.destination_type,

      from,

      to,

      qualified:
        result.data.length,

      candidates:
        candidates.length,

      signals:
        0,

      sent:
        0,

      missing_market_data:
        missingMarketData,

      low_volume:
        lowVolume,

      invalid_sr:
        invalidSR,

      symbols: [],
    };
  }

  /* =====================================================
     4. CLAIM SIGNAL
  ===================================================== */

  const newSignals:
    TradeSignalRow[] = [];

  for (
    const row of signals
  ) {
    const claimed =
      await claimSignal(
        config,
        row,
        from,
        to
      );

    if (claimed) {
      newSignals.push(
        row
      );
    }
  }

  /* =====================================================
     ALL ALREADY SENT
  ===================================================== */

  if (
    newSignals.length ===
    0
  ) {
    return {
      uid:
        config.uid,

      broker_id:
        config.broker_id,

      broker_code:
        config.broker_code,

      broker_name:
        config.broker_name,

      accumulation_period:
        config.accumulation_period,

      destination_type:
        config.destination_type,

      from,

      to,

      qualified:
        result.data.length,

      candidates:
        candidates.length,

      signals:
        signals.length,

      sent:
        0,

      symbols: [],

      message:
        "Semua signal sudah pernah dikirim.",
    };
  }

  /* =====================================================
     5. BUILD TELEGRAM CHUNKS
  ===================================================== */

  const chunks =
    buildSignalChunks(
      newSignals,
      config,
      from,
      to
    );

  console.log(
    "[TRADE PLANE] Message chunks:",
    {
      uid:
        config.uid,

      broker:
        config.broker_code,

      totalSignals:
        newSignals.length,

      chunks:
        chunks.length,
    }
  );

  let totalSent =
    0;

  const sentSymbols:
    string[] = [];

  /* =====================================================
     6. SEND CHUNKS
  ===================================================== */

  for (
    let index = 0;
    index < chunks.length;
    index++
  ) {
    const chunk =
      chunks[index];

    console.log(
      "[TRADE PLANE] Sending chunk:",
      {
        uid:
          config.uid,

        broker:
          config.broker_code,

        chunk:
          `${index + 1}/${chunks.length}`,

        symbols:
          chunk.rows.map(
            (row) =>
              row.symbol
          ),

        length:
          chunk.message.length,
      }
    );

    try {
      await sendToDestination(
        config,
        chunk.message
      );

      /*
       * MARK SENT
       */
      for (
        const row of chunk.rows
      ) {
        await updateSignalStatus(
          config,
          row,
          from,
          to,
          "sent",
          {
            sentAt:
              FieldValue.serverTimestamp(),

            sentDestination:
              config.destination_target,

            error:
              FieldValue.delete(),
          }
        );

        totalSent++;

        sentSymbols.push(
          row.symbol
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof
        Error
          ? error.message
          : String(
              error
            );

      console.error(
        "[TRADE PLANE] Chunk failed:",
        {
          uid:
            config.uid,

          broker:
            config.broker_code,

          chunk:
            `${index + 1}/${chunks.length}`,

          error:
            errorMessage,
        }
      );

      /*
       * MARK FAILED
       */
      for (
        const row of chunk.rows
      ) {
        await updateSignalStatus(
          config,
          row,
          from,
          to,
          "failed",
          {
            error:
              errorMessage,
          }
        );
      }

      /*
       * Stop chunk berikutnya.
       */
      break;
    }
  }

  /* =====================================================
     RESULT
  ===================================================== */

  return {
    uid:
      config.uid,

    broker_id:
      config.broker_id,

    broker_code:
      config.broker_code,

    broker_name:
      config.broker_name,

    accumulation_period:
      config.accumulation_period,

    destination_type:
      config.destination_type,

    from,

    to,

    qualified:
      result.data.length,

    candidates:
      candidates.length,

    signals:
      signals.length,

    new_signals:
      newSignals.length,

    chunks:
      chunks.length,

    sent:
      totalSent,

    missing_market_data:
      missingMarketData,

    low_volume:
      lowVolume,

    invalid_sr:
      invalidSR,

    symbols:
      sentSymbols,
  };
}

/* =========================================================
   AUTH / SYNC SECRET
=========================================================

   Bisa dipanggil dengan salah satu:

   1. Manual PowerShell:
      x-sync-secret

   2. Vercel / cron:
      Authorization: Bearer <CRON_SECRET>

   3. Manual alternatif:
      x-cron-secret

   Environment yang didukung:
   - SYNC_SECRET  -> utama untuk manual sync
   - CRON_SECRET  -> fallback untuk cron/Vercel

   Jangan hard-code secret di source code.
========================================================= */

function getRequestSecret(
  request: NextRequest
): string {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    authorization?.startsWith(
      "Bearer "
    )
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  const syncSecret =
    request.headers.get(
      "x-sync-secret"
    );

  if (
    syncSecret?.trim()
  ) {
    return syncSecret
      .trim();
  }

  const cronSecret =
    request.headers.get(
      "x-cron-secret"
    );

  return (
    cronSecret ?? ""
  ).trim();
}

function isAuthorized(
  request: NextRequest
): boolean {
  const requestSecret =
    getRequestSecret(
      request
    );

  if (!requestSecret) {
    return false;
  }

  const syncSecret =
    process.env.SYNC_SECRET?.trim();

  const cronSecret =
    process.env.CRON_SECRET?.trim();

  /*
   * SYNC_SECRET menjadi secret utama
   * untuk endpoint sync manual.
   *
   * CRON_SECRET tetap diterima supaya
   * Vercel Cron tidak rusak.
   */
  return (
    (
      Boolean(syncSecret) &&
      requestSecret ===
        syncSecret
    ) ||
    (
      Boolean(cronSecret) &&
      requestSecret ===
        cronSecret
    )
  );
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    /* =====================================================
       AUTH
    ===================================================== */

    if (
      !isAuthorized(
        request
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized",
        },
        {
          status:
            401,
        }
      );
    }

    /* =====================================================
       ENABLED TRADE PLANES
    ===================================================== */

    const tradePlanes =
      await getEnabledTradePlanes();

    console.log(
      "[SYNC SIGNAL] Trade Plane docs:",
      tradePlanes.length
    );

    /*
     * Cache history dipakai bersama semua broker
     * dalam 1 request.
     *
     * Kandidat saham yang sama tidak akan query
     * Firestore dua kali.
     *
     * Sekarang setiap cache berisi sampai
     * 120 candle untuk S/R.
     */
    const historyCache =
      new Map<
        string,
        StockHistoryData[]
      >();

    const results:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    let sent =
      0;

    /* =====================================================
       PROCESS ALL ENABLED TRADE PLANES
    ===================================================== */

    for (
      const config of tradePlanes
    ) {
      try {
        /*
         * Tentukan range berdasarkan
         * setting Firebase masing-masing user.
         */
        const {
          from,
          to,
        } =
          getAccumulationPeriodRange(
            config.accumulation_period
          );

        console.log(
          "[SYNC SIGNAL] Accumulation period:",
          {
            uid:
              config.uid,

            broker:
              config.broker_code,

            brokerId:
              config.broker_id,

            period:
              config.accumulation_period,

            from,

            to,
          }
        );

        const result =
          await processTradePlane(
            config,
            from,
            to,
            historyCache
          );

        results.push(
          result
        );

        sent +=
          result.sent;
      } catch (
        error
      ) {
        const errorMessage =
          error instanceof
          Error
            ? error.message
            : String(
                error
              );

        console.error(
          "[SYNC SIGNAL] Failed:",
          {
            uid:
              config.uid,

            broker:
              config.broker_code,

            brokerId:
              config.broker_id,

            accumulationPeriod:
              config.accumulation_period,

            error:
              errorMessage,
          }
        );

        results.push({
          uid:
            config.uid,

          broker_id:
            config.broker_id,

          broker_code:
            config.broker_code,

          broker_name:
            config.broker_name,

          accumulation_period:
            config.accumulation_period,

          destination_type:
            config.destination_type,

          success:
            false,

          error:
            errorMessage,
        });
      }
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success:
        true,

      message:
        "Trade Plane signal sync selesai.",

      today:
        getJakartaDate(),

      history_symbols:
        historyCache.size,

      enabled_users:
        tradePlanes.length,

      processed:
        results.length,

      sent,

      results,
    });
  } catch (
    error
  ) {
    console.error(
      "[SYNC SIGNAL] Sync error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );
  }
}