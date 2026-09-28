import { NextRequest, NextResponse } from "next/server";

import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/firebase-admin";

import {
  getAxentrazAccumulation,
  type AxentrazResult,
} from "@/lib/axentraz-accumulation";

import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

/* =========================================================
   CONFIG
========================================================= */

const SIGNAL_COLLECTION = "trade-signals";

const MIN_ACCUMULATION_RATE = 20;

/*
 * Volume yang digunakan untuk filtering adalah
 * volume yang SUDAH dinormalisasi.
 *
 * Contoh:
 *
 * raw 392.800
 * × 0.01
 * = 3.928
 *
 * sehingga dianggap 3,928k.
 *
 * Target:
 * volume HARUS LEBIH BESAR dari 50k.
 */
const MIN_MARKET_VOLUME = 50_000;

/*
 * Faktor normalisasi volume Market Intelligence.
 *
 * Sesuai asumsi:
 *
 * 392.800 -> 3.928
 *
 * maka:
 *
 * 392800 × 0.01 = 3928
 */
const MARKET_VOLUME_SCALE = 0.01;

const TELEGRAM_MAX_LENGTH = 3500;

const SENDING_TIMEOUT_MS = 10 * 60 * 1000;

/* =========================================================
   TYPES
========================================================= */

type DestinationType = "telegram" | "whatsapp";

type TradePlaneConfig = {
  enabled: boolean;

  broker_code: string;

  broker_id: number;

  broker_name: string;

  destination_type: DestinationType;

  destination_target: string;
};

type TradePlaneDocument = TradePlaneConfig & {
  uid: string;
};

type SignalStatus = "sending" | "sent" | "failed";

/* =========================================================
   MARKET INTELLIGENCE ROW
========================================================= */

type MarketIntelligenceRow = {
  symbol?: string;

  name?: string;

  sector?: string;

  price?: number;

  open?: number;

  high?: number;

  low?: number;

  changeVal?: number;

  changePct?: number;

  volume?: number;

  valueTrillion?: number;

  marketState?: string;

  fetchedAt?: string;

  prevVolume?: number;

  ma5?: number;

  ma20?: number;

  ma50?: number;

  high20?: number;

  low20?: number;

  pricePct20?: number;

  distMa20?: number;

  volumeRatio?: number;

  volSurge?: number;

  gapUp?: boolean;

  breakout20h?: boolean;

  score?: number;

  signal?: string;
};

/* =========================================================
   NORMALIZED MARKET DATA
========================================================= */

type MarketData = {
  /*
   * Volume SUDAH dinormalisasi.
   */
  volume: number;

  /*
   * Raw volume untuk debugging.
   */
  rawVolume: number;

  volumeRatio: number;

  valueTrillion: number;

  volSurge: number;

  price: number;

  changePct: number;
};

/* =========================================================
   TRADE SIGNAL ROW
=========================================================

   AxentrazResult
   =
   data broker accumulation

   TradeSignalRow
   =
   data broker accumulation
   +
   data Market Intelligence

   PENTING:
   Jangan tambahkan volumeRatio/valueTrillion/volSurge
   ke AxentrazResult karena field tersebut bukan berasal
   dari broker-activity.
========================================================= */

type TradeSignalRow = AxentrazResult & {
  marketVolume: number;

  volumeRatio: number;

  valueTrillion: number;

  volSurge: number;

  marketPrice: number;

  marketChangePct: number;
};

/* =========================================================
   FIRESTORE SIGNAL DOCUMENT
========================================================= */

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

  /*
   * MARKET VOLUME
   *
   * Ini adalah volume yang SUDAH dinormalisasi.
   */
  volume: number;

  volumeRatio: number;

  valueTrillion: number;

  volSurge: number;

  from: string;

  to: string;

  status: SignalStatus;

  createdAt: FirebaseFirestore.FieldValue | Date;

  updatedAt: FirebaseFirestore.FieldValue | Date;

  sentAt?: FirebaseFirestore.FieldValue | Date;

  sentDestination?: string;

  error?: string;
};

/* =========================================================
   NUMBER
========================================================= */

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const number = Number(value.trim().replace(/,/g, ""));

    return Number.isFinite(number) ? number : 0;
  }

  return 0;
}

/* =========================================================
   MARKET VOLUME NORMALIZATION
========================================================= */

function normalizeMarketVolume(rawVolume: number): number {
  if (!Number.isFinite(rawVolume)) {
    return 0;
  }

  return rawVolume * MARKET_VOLUME_SCALE;
}

/* =========================================================
   MARKET INTELLIGENCE PARSER
========================================================= */

function parseMarketRows(
  value: unknown
): MarketIntelligenceRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is MarketIntelligenceRow =>
      Boolean(item && typeof item === "object")
  );
}

/* =========================================================
   GET MARKET INTELLIGENCE SNAPSHOT
========================================================= */

async function getMarketIntelligenceSnapshot(): Promise<
  MarketIntelligenceRow[]
> {
  const token = process.env.AXENTRAZ_MARKET_TOKEN;

  if (!token) {
    throw new Error(
      "AXENTRAZ_MARKET_TOKEN belum dikonfigurasi."
    );
  }

  /*
   * Market Intelligence menggunakan
   * token sebagai query parameter.
   *
   * BUKAN Authorization Bearer.
   */

  const url =
    "https://axentraz.id/api/market-intelligence/stream" +
    `?token=${encodeURIComponent(token)}`;

  console.log("[MARKET INTELLIGENCE] Connecting...");

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15_000);

  try {
    const response = await fetch(url, {
      method: "GET",

      headers: {
        Accept: "text/event-stream",
      },

      cache: "no-store",

      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Market Intelligence HTTP ${response.status}: ${errorText}`
      );
    }

    if (!response.body) {
      throw new Error(
        "Market Intelligence tidak memiliki response body."
      );
    }

    const reader = response.body.getReader();

    const decoder = new TextDecoder();

    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        /*
         * SSE event dipisahkan
         * dengan baris kosong.
         */
        const events = buffer.split(/\r?\n\r?\n/);

        /*
         * Event terakhir mungkin
         * belum lengkap.
         */
        buffer = events.pop() ?? "";

        for (const eventBlock of events) {
          const lines = eventBlock.split(/\r?\n/);

          let eventName = "";

          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();

              continue;
            }

            if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }

          /*
           * Kita hanya membutuhkan
           * event snapshot.
           */
          if (
            eventName !== "snapshot" ||
            dataLines.length === 0
          ) {
            continue;
          }

          const json = dataLines.join("\n");

          try {
            const parsed = JSON.parse(json);

            const rows = parseMarketRows(parsed);

            if (rows.length === 0) {
              continue;
            }

            console.log(
              "[MARKET INTELLIGENCE] Snapshot:",
              {
                rows: rows.length,
              }
            );

            return rows;
          } catch (error) {
            console.error(
              "[MARKET INTELLIGENCE] Snapshot JSON error:",
              error
            );
          }
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }

    throw new Error(
      "Market Intelligence tidak mengirim snapshot."
    );
  } finally {
    clearTimeout(timeout);

    controller.abort();
  }
}

/* =========================================================
   BUILD MARKET MAP
========================================================= */

function buildMarketMap(
  rows: MarketIntelligenceRow[]
): Map<string, MarketData> {
  const map = new Map<string, MarketData>();

  for (const row of rows) {
    const symbol = String(row.symbol ?? "")
      .trim()
      .toUpperCase();

    if (!symbol) {
      continue;
    }

    /*
     * RAW VOLUME
     */
    const rawVolume = toNumber(row.volume);

    /*
     * NORMALIZED VOLUME
     *
     * Contoh:
     *
     * 392800
     * × 0.01
     * =
     * 3928
     */
    const normalizedVolume =
      normalizeMarketVolume(rawVolume);

    map.set(symbol, {
      volume: normalizedVolume,

      rawVolume,

      volumeRatio: toNumber(row.volumeRatio),

      valueTrillion: toNumber(row.valueTrillion),

      volSurge: toNumber(row.volSurge),

      price: toNumber(row.price),

      changePct: toNumber(row.changePct),
    });
  }

  return map;
}

/* =========================================================
   DATE
========================================================= */

function getJakartaDate(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  });

  return formatter.format(new Date()).replace(/-/g, "");
}

function formatDate(value: string): string {
  if (!value || !/^\d{8}$/.test(value)) {
    return value;
  }

  return (
    `${value.slice(6, 8)}/` +
    `${value.slice(4, 6)}/` +
    `${value.slice(0, 4)}`
  );
}

/* =========================================================
   NUMBER FORMAT
========================================================= */

function formatNumber(
  value: number,
  maximumFractionDigits = 2
): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits,
  }).format(value);
}

/* =========================================================
   COMPACT NUMBER FORMAT
=========================================================

   Contoh:

   3920
   -> 3,92k

   392800
   -> 392,8k

   5000000
   -> 5M

   3200000000
   -> 3,2B
========================================================= */

function formatCompactNumber(
  value: number,
  maximumFractionDigits = 2
): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const absolute = Math.abs(value);

  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000_000_000) {
    return (
      sign +
      formatNumber(
        absolute / 1_000_000_000_000,
        maximumFractionDigits
      ) +
      "T"
    );
  }

  if (absolute >= 1_000_000_000) {
    return (
      sign +
      formatNumber(
        absolute / 1_000_000_000,
        maximumFractionDigits
      ) +
      "B"
    );
  }

  if (absolute >= 1_000_000) {
    return (
      sign +
      formatNumber(
        absolute / 1_000_000,
        maximumFractionDigits
      ) +
      "M"
    );
  }

  if (absolute >= 1_000) {
    return (
      sign +
      formatNumber(
        absolute / 1_000,
        maximumFractionDigits
      ) +
      "k"
    );
  }

  return formatNumber(value, maximumFractionDigits);
}

/* =========================================================
   MARKET VALUE FORMAT
========================================================= */

function formatMarketValue(
  valueTrillion: number
): string {
  if (!Number.isFinite(valueTrillion)) {
    return "0";
  }

  const rupiahValue =
    valueTrillion * 1_000_000_000_000;

  return formatCompactNumber(rupiahValue, 2);
}

function formatSignedPercent(value: number): string {
  const absolute = Math.abs(value);

  const formatted = formatNumber(absolute);

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    `${escapeHtml(config.broker_code)} — ` +
    `${escapeHtml(config.broker_name)}\n\n` +
    `📅 Periode\n` +
    `${formatDate(from)} — ` +
    `${formatDate(to)}\n\n` +
    `━━━━━━━━━━━━━━━━━━`
  );
}

/* =========================================================
   SIGNAL BLOCK
========================================================= */

function buildSignalBlock(
  row: TradeSignalRow
): string {
  const symbol = escapeHtml(row.symbol);

  const stockbitUrl =
    `https://stockbit.com/#/symbol/` +
    encodeURIComponent(row.symbol);

  return (
    `📌 <a href="${stockbitUrl}">${symbol}</a>\n\n` +

    `🔥 Accumulation: ` +
    `${formatSignedPercent(row.accumulation)}\n` +

    `⚡ Rate: ` +
    `${formatNumber(row.accumulation_rate)}%\n` +

    `📊 Last Price: ` +
    `${formatNumber(row.last_close)}\n` +

    `📦 Volume: ` +
    `${formatCompactNumber(row.marketVolume)}\n` +

    `📈 Volume Ratio: ` +
    `${formatNumber(row.volumeRatio, 2)}x\n\n` +

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
  const header = buildSignalHeader(
    config,
    from,
    to
  );

  const chunks: SignalChunk[] = [];

  let currentRows: TradeSignalRow[] = [];

  let currentMessage = header;

  for (const row of rows) {
    const block =
      `\n\n` +
      buildSignalBlock(row);

    if (
      currentMessage.length +
        block.length <=
      TELEGRAM_MAX_LENGTH
    ) {
      currentRows.push(row);

      currentMessage += block;

      continue;
    }

    if (currentRows.length > 0) {
      chunks.push({
        rows: currentRows,

        message: currentMessage,
      });
    }

    currentRows = [row];

    currentMessage =
      header +
      `\n\n` +
      buildSignalBlock(row);
  }

  if (currentRows.length > 0) {
    chunks.push({
      rows: currentRows,

      message: currentMessage,
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
  const snapshot = await db
    .collection("trade-plane")
    .where("enabled", "==", true)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data =
        doc.data() as Partial<TradePlaneConfig>;

      /*
       * broker_id diambil langsung
       * dari Firestore.
       *
       * TIDAK ADA mapping hard-code.
       */

      if (
        typeof data.broker_id !== "number" ||
        !Number.isInteger(data.broker_id) ||
        data.broker_id <= 0
      ) {
        console.error(
          "[TRADE PLANE] Invalid broker_id:",
          {
            uid: doc.id,

            broker_id: data.broker_id,
          }
        );

        return null;
      }

      return {
        uid: doc.id,

        enabled: true,

        broker_code:
          typeof data.broker_code === "string"
            ? data.broker_code
            : "",

        broker_id: data.broker_id,

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
  const signalId =
    `${config.uid}_` +
    `${config.broker_id}_` +
    `${row.symbol}_` +
    `${to}`;

  const ref = db
    .collection(SIGNAL_COLLECTION)
    .doc(signalId);

  return db.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(ref);

      if (snapshot.exists) {
        const data =
          snapshot.data() as Partial<SignalDocument>;

        /*
         * Jangan kirim ulang
         * kalau sudah sent.
         */
        if (data.status === "sent") {
          return false;
        }

        /*
         * Cegah duplicate send
         * ketika status masih sending.
         */
        if (
          data.status === "sending" &&
          data.updatedAt
        ) {
          const updatedAtValue =
            data.updatedAt;

          let updatedAtMs:
            number | null = null;

          if (
            updatedAtValue instanceof Date
          ) {
            updatedAtMs =
              updatedAtValue.getTime();
          } else if (
            typeof updatedAtValue ===
              "object" &&
            updatedAtValue !== null &&
            "toDate" in updatedAtValue &&
            typeof (
              updatedAtValue as {
                toDate?: unknown;
              }
            ).toDate === "function"
          ) {
            updatedAtMs =
              (
                updatedAtValue as {
                  toDate: () => Date;
                }
              ).toDate().getTime();
          }

          if (
            updatedAtMs !== null &&
            Date.now() - updatedAtMs <
              SENDING_TIMEOUT_MS
          ) {
            return false;
          }
        }
      }

      const signalData: SignalDocument = {
        uid: config.uid,

        symbol: row.symbol,

        brokerId: config.broker_id,

        brokerCode: config.broker_code,

        brokerName: config.broker_name,

        accumulation: row.accumulation,

        accumulationRate:
          row.accumulation_rate,

        lastClose: row.last_close,

        ma20: row.ma20,

        /*
         * MARKET VOLUME
         *
         * BUKAN row.volume.
         *
         * row.volume pada AxentrazResult
         * adalah data broker.
         */
        volume: row.marketVolume,

        volumeRatio: row.volumeRatio,

        valueTrillion:
          row.valueTrillion,

        volSurge: row.volSurge,

        from,

        to,

        status: "sending",

        createdAt:
          snapshot.exists
            ? (
                snapshot
                  .data()
                  ?.createdAt ??
                FieldValue.serverTimestamp()
              )
            : FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      };

      transaction.set(
        ref,
        signalData,
        {
          merge: true,
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
  to: string,
  status: SignalStatus,
  extra: Record<string, unknown> = {}
) {
  const signalId =
    `${config.uid}_` +
    `${config.broker_id}_` +
    `${row.symbol}_` +
    `${to}`;

  await db
    .collection(SIGNAL_COLLECTION)
    .doc(signalId)
    .set(
      {
        status,

        updatedAt:
          FieldValue.serverTimestamp(),

        ...extra,
      },
      {
        merge: true,
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
  marketMap: Map<string, MarketData>
) {
  console.log(
    "[TRADE PLANE] Processing:",
    {
      uid: config.uid,

      broker: config.broker_code,

      brokerId: config.broker_id,

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

  console.log(
    "[TRADE PLANE] Candidates:",
    {
      uid: config.uid,

      broker: config.broker_code,

      qualified:
        result.data.length,

      candidates:
        candidates.length,
    }
  );

  /* =====================================================
     3. MATCH DENGAN MARKET INTELLIGENCE
  ===================================================== */

  const signals: TradeSignalRow[] = [];

  let missingMarketData = 0;

  let lowVolume = 0;

  for (const row of candidates) {
    const symbol =
      row.symbol
        .trim()
        .toUpperCase();

    const market =
      marketMap.get(symbol);

    /*
     * Tidak ditemukan di snapshot.
     */
    if (!market) {
      missingMarketData++;

      console.log(
        "[TRADE PLANE] Market data missing:",
        symbol
      );

      continue;
    }

    /*
     * ===================================================
     * VOLUME DEBUG
     * ===================================================
     */

    console.log(
      "[TRADE PLANE] MARKET VOLUME CHECK:",
      {
        symbol,

        rawVolume:
          market.rawVolume,

        normalizedVolume:
          market.volume,

        compact:
          formatCompactNumber(
            market.volume
          ),

        threshold:
          MIN_MARKET_VOLUME,

        passed:
          market.volume >
          MIN_MARKET_VOLUME,
      }
    );

    /*
     * ===================================================
     * FILTER VOLUME
     * ===================================================
     *
     * HARUS LEBIH BESAR DARI 50K.
     *
     * 49,999 -> reject
     * 50,000 -> reject
     * 50,001 -> lolos
     */

    if (
      market.volume <=
      MIN_MARKET_VOLUME
    ) {
      lowVolume++;

      console.log(
        "[TRADE PLANE] REJECT LOW VOLUME:",
        {
          symbol,

          normalizedVolume:
            market.volume,

          compact:
            formatCompactNumber(
              market.volume
            ),

          threshold:
            MIN_MARKET_VOLUME,
        }
      );

      continue;
    }

    /*
     * Gabungkan data broker
     * dengan data market.
     *
     * AxentrazResult TIDAK diubah.
     */
    const signal: TradeSignalRow = {
      ...row,

      marketVolume:
        market.volume,

      volumeRatio:
        market.volumeRatio,

      valueTrillion:
        market.valueTrillion,

      volSurge:
        market.volSurge,

      marketPrice:
        market.price,

      marketChangePct:
        market.changePct,
    };

    signals.push(signal);
  }

  console.log(
    "[TRADE PLANE] Signals:",
    {
      uid: config.uid,

      broker: config.broker_code,

      qualified:
        result.data.length,

      candidates:
        candidates.length,

      signals:
        signals.length,

      missingMarketData,

      lowVolume,
    }
  );

  /* =====================================================
     NO SIGNAL
  ===================================================== */

  if (signals.length === 0) {
    return {
      uid: config.uid,

      broker_id:
        config.broker_id,

      broker_code:
        config.broker_code,

      broker_name:
        config.broker_name,

      destination_type:
        config.destination_type,

      from,

      to,

      qualified:
        result.data.length,

      candidates:
        candidates.length,

      signals: 0,

      sent: 0,

      missing_market_data:
        missingMarketData,

      low_volume:
        lowVolume,

      symbols: [],
    };
  }

  /* =====================================================
     4. CLAIM SIGNAL
  ===================================================== */

  const newSignals: TradeSignalRow[] = [];

  for (const row of signals) {
    const claimed =
      await claimSignal(
        config,
        row,
        from,
        to
      );

    if (claimed) {
      newSignals.push(row);
    }
  }

  /* =====================================================
     ALL ALREADY SENT
  ===================================================== */

  if (newSignals.length === 0) {
    return {
      uid: config.uid,

      broker_id:
        config.broker_id,

      broker_code:
        config.broker_code,

      broker_name:
        config.broker_name,

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

      sent: 0,

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
      uid: config.uid,

      broker:
        config.broker_code,

      totalSignals:
        newSignals.length,

      chunks:
        chunks.length,
    }
  );

  let totalSent = 0;

  const sentSymbols: string[] = [];

  /* =====================================================
     6. SEND CHUNKS
  ===================================================== */

  for (
    let index = 0;
    index < chunks.length;
    index++
  ) {
    const chunk = chunks[index];

    console.log(
      "[TRADE PLANE] Sending chunk:",
      {
        uid: config.uid,

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
      for (const row of chunk.rows) {
        await updateSignalStatus(
          config,
          row,
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
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        "[TRADE PLANE] Chunk failed:",
        {
          uid: config.uid,

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
      for (const row of chunk.rows) {
        await updateSignalStatus(
          config,
          row,
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
    uid: config.uid,

    broker_id:
      config.broker_id,

    broker_code:
      config.broker_code,

    broker_name:
      config.broker_name,

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

    symbols:
      sentSymbols,
  };
}

/* =========================================================
   CRON SECRET
========================================================= */

function getCronSecret(
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

  return (
    request.headers.get(
      "x-cron-secret"
    ) ?? ""
  ).trim();
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    /* =====================================================
       AUTH CRON
    ===================================================== */

    const cronSecret =
      process.env.CRON_SECRET;

    const requestSecret =
      getCronSecret(
        request
      );

    if (
      !cronSecret ||
      requestSecret !==
        cronSecret
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    /* =====================================================
       DATE
    ===================================================== */

    const today =
      getJakartaDate();

    const from =
      `${today.slice(0, 6)}01`;

    const to =
      today;

    /* =====================================================
       GET MARKET INTELLIGENCE

       HANYA SEKALI.

       Snapshot dipakai oleh semua broker.
    ===================================================== */

    const marketRows =
      await getMarketIntelligenceSnapshot();

    const marketMap =
      buildMarketMap(
        marketRows
      );

    console.log(
      "[SYNC SIGNAL] Market Intelligence:",
      {
        rows:
          marketRows.length,

        map:
          marketMap.size,

        volumeScale:
          MARKET_VOLUME_SCALE,

        minVolume:
          MIN_MARKET_VOLUME,
      }
    );

    /* =====================================================
       ENABLED TRADE PLANES
    ===================================================== */

    const tradePlanes =
      await getEnabledTradePlanes();

    console.log(
      "[SYNC SIGNAL] Trade Plane docs:",
      tradePlanes.length
    );

    const results: Array<
      Record<string, unknown>
    > = [];

    let sent = 0;

    /* =====================================================
       PROCESS ALL ENABLED TRADE PLANES
    ===================================================== */

    for (
      const config of tradePlanes
    ) {
      try {
        const result =
          await processTradePlane(
            config,
            from,
            to,
            marketMap
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
          error instanceof Error
            ? error.message
            : String(error);

        console.error(
          "[SYNC SIGNAL] Failed:",
          {
            uid:
              config.uid,

            broker:
              config.broker_code,

            brokerId:
              config.broker_id,

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

          destination_type:
            config.destination_type,

          from,

          to,

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

      from,

      to,

      market_rows:
        marketRows.length,

      market_symbols:
        marketMap.size,

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
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}