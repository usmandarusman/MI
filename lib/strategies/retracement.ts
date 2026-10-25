
import type { StockHistoryData } from "./fishing-bottom";

/* =========================================================
   TYPES
========================================================= */

export type RetracementResult = {
  eligible: boolean;
  reason: string[];
  trendConfirmed: boolean;
  entryConfirmed: boolean;
  reversalConfirmed: boolean;
  volumeConfirmed: boolean;
  support: number | null;
  resistance: number | null;
  ma20: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  latestClose: number | null;
  latestVolume: number | null;
  averageVolume: number | null;
};

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
};

type Pivot = {
  index: number;
  price: number;
};

type RetracementOptions = {
  /**
   * Toleransi jarak harga terhadap support atau MA20.
   * 0.025 = 2,5%.
   */
  entryTolerancePercent?: number;

  /**
   * Jumlah candle sebelumnya untuk menghitung
   * rata-rata volume, tidak termasuk candle terakhir.
   */
  volumeLookback?: number;

  /**
   * Minimal rasio volume terakhir terhadap rata-rata.
   * 1.2 = volume minimal 20% di atas rata-rata.
   */
  minimumVolumeRatio?: number;

  /**
   * Buffer stop loss di bawah support.
   * 0.01 = 1%.
   */
  stopLossBufferPercent?: number;

  /**
   * Minimal jumlah candle yang diperlukan.
   */
  minimumCandles?: number;
};

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const DEFAULT_OPTIONS: Required<RetracementOptions> = {
  entryTolerancePercent: 0.025,
  volumeLookback: 20,
  minimumVolumeRatio: 1.2,
  stopLossBufferPercent: 0.01,
  minimumCandles: 30,
};

/* =========================================================
   NORMALIZATION
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

function normalizeCandles(
  history: StockHistoryData[],
): Candle[] {
  return history
    .map((item) => ({
      open: toNumber(item.open),
      high: toNumber(item.high),
      low: toNumber(item.low),
      close: toNumber(item.close),
      volume: toNumber(item.volume),
      date: typeof item.date === "string" ? item.date : "",
    }))
    .filter(
      (candle) =>
        candle.open > 0 &&
        candle.high > 0 &&
        candle.low > 0 &&
        candle.close > 0 &&
        candle.high >= candle.low &&
        candle.high >= candle.open &&
        candle.high >= candle.close &&
        candle.low <= candle.open &&
        candle.low <= candle.close,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* =========================================================
   MOVING AVERAGE
========================================================= */

function calculateSMA(
  candles: Candle[],
  period: number,
): number | null {
  if (candles.length < period) {
    return null;
  }

  const selected = candles.slice(-period);

  const total = selected.reduce(
    (sum, candle) => sum + candle.close,
    0,
  );

  const average = total / period;

  return Number.isFinite(average) && average > 0
    ? average
    : null;
}

/* =========================================================
   PIVOT DETECTION
========================================================= */

/**
 * Mencari pivot high yang lebih tinggi dari dua candle
 * di kiri dan dua candle di kanan.
 *
 * History wajib diurutkan oldest -> newest.
 */
function findPivotHighs(candles: Candle[]): Pivot[] {
  const pivots: Pivot[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const current = candles[i].high;

    const isPivot =
      current > candles[i - 1].high &&
      current > candles[i - 2].high &&
      current >= candles[i + 1].high &&
      current >= candles[i + 2].high;

    if (isPivot) {
      pivots.push({
        index: i,
        price: current,
      });
    }
  }

  return pivots;
}

/**
 * Mencari pivot low yang lebih rendah dari dua candle
 * di kiri dan dua candle di kanan.
 */
function findPivotLows(candles: Candle[]): Pivot[] {
  const pivots: Pivot[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const current = candles[i].low;

    const isPivot =
      current < candles[i - 1].low &&
      current < candles[i - 2].low &&
      current <= candles[i + 1].low &&
      current <= candles[i + 2].low;

    if (isPivot) {
      pivots.push({
        index: i,
        price: current,
      });
    }
  }

  return pivots;
}

/* =========================================================
   HIGHER HIGH + HIGHER LOW
========================================================= */

/**
 * Tren naik terkonfirmasi jika dua pivot high terakhir
 * membentuk Higher High dan dua pivot low terakhir
 * membentuk Higher Low.
 *
 * Pivot terakhir harus sudah terbentuk; dua candle
 * di kanan diperlukan untuk mengonfirmasi pivot.
 */
function hasHigherHighHigherLow(
  pivotHighs: Pivot[],
  pivotLows: Pivot[],
): boolean {
  if (pivotHighs.length < 2 || pivotLows.length < 2) {
    return false;
  }

  const previousHigh = pivotHighs[pivotHighs.length - 2];
  const latestHigh = pivotHighs[pivotHighs.length - 1];

  const previousLow = pivotLows[pivotLows.length - 2];
  const latestLow = pivotLows[pivotLows.length - 1];

  const higherHigh = latestHigh.price > previousHigh.price;
  const higherLow = latestLow.price > previousLow.price;

  return higherHigh && higherLow;
}

/* =========================================================
   SUPPORT + RESISTANCE
========================================================= */

/**
 * Support diambil dari pivot low terakhir yang sudah
 * terkonfirmasi, sebelum dua candle paling akhir.
 *
 * Resistance adalah pivot high terdekat di atas harga
 * terakhir. Jika belum tersedia, TP tidak ditentukan.
 */
function findSupport(
  pivotLows: Pivot[],
  latestIndex: number,
): number | null {
  const valid = pivotLows.filter(
    (pivot) => pivot.index < latestIndex - 1,
  );

  if (valid.length === 0) {
    return null;
  }

  return valid[valid.length - 1].price;
}

function findNextResistance(
  pivotHighs: Pivot[],
  latestClose: number,
): number | null {
  const candidates = pivotHighs
    .map((pivot) => pivot.price)
    .filter((price) => price > latestClose)
    .sort((a, b) => a - b);

  return candidates[0] ?? null;
}

/* =========================================================
   BULLISH REVERSAL CANDLES
========================================================= */

/**
 * Mengenali:
 * 1. Bullish engulfing.
 * 2. Hammer / bullish rejection candle.
 *
 * Ini adalah deteksi pola berbasis OHLC, bukan
 * jaminan harga akan naik.
 */
function isBullishEngulfing(
  previous: Candle,
  latest: Candle,
): boolean {
  const previousBearish = previous.close < previous.open;
  const latestBullish = latest.close > latest.open;

  if (!previousBearish || !latestBullish) {
    return false;
  }

  return (
    latest.open <= previous.close &&
    latest.close >= previous.open
  );
}

function isHammer(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;

  if (range <= 0) {
    return false;
  }

  const safeBody = Math.max(body, range * 0.01);

  const upperShadow =
    candle.high - Math.max(candle.open, candle.close);

  const lowerShadow =
    Math.min(candle.open, candle.close) - candle.low;

  const bodyPosition =
    (Math.min(candle.open, candle.close) - candle.low) /
    range;

  return (
    lowerShadow >= safeBody * 2 &&
    upperShadow <= safeBody &&
    bodyPosition >= 0.5
  );
}

function hasBullishReversal(candles: Candle[]): boolean {
  if (candles.length < 2) {
    return false;
  }

  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  return (
    isBullishEngulfing(previous, latest) ||
    isHammer(latest)
  );
}

/* =========================================================
   VOLUME CONFIRMATION
========================================================= */

function calculateAverageVolume(
  candles: Candle[],
  lookback: number,
): number | null {
  // Jangan memasukkan volume candle terakhir ke rata-rata.
  const previousCandles = candles.slice(
    -(lookback + 1),
    -1,
  );

  if (previousCandles.length < lookback) {
    return null;
  }

  const volumes = previousCandles.map(
    (candle) => candle.volume,
  );

  if (volumes.some((volume) => volume <= 0)) {
    return null;
  }

  const average =
    volumes.reduce((sum, volume) => sum + volume, 0) /
    volumes.length;

  return Number.isFinite(average) && average > 0
    ? average
    : null;
}

/* =========================================================
   ENTRY ZONE
========================================================= */

/**
 * Entry valid apabila harga penutupan terakhir berada
 * dalam toleransi yang ditentukan terhadap support atau MA20.
 *
 * Area entry menggunakan level yang paling dekat dengan
 * harga penutupan terakhir.
 */
function findEntryZone(
  latestClose: number,
  support: number | null,
  ma20: number | null,
  tolerance: number,
): { entryLow: number; entryHigh: number } | null {
  const levels = [support, ma20].filter(
    (value): value is number =>
      value !== null && value > 0,
  );

  if (levels.length === 0 || latestClose <= 0) {
    return null;
  }

  const nearestLevel = levels
    .map((level) => ({
      level,
      distance: Math.abs(latestClose - level) / latestClose,
    }))
    .filter((item) => item.distance <= tolerance)
    .sort((a, b) => a.distance - b.distance)[0];

  if (!nearestLevel) {
    return null;
  }

  const level = nearestLevel.level;

  return {
    entryLow: level * (1 - tolerance),
    entryHigh: level * (1 + tolerance),
  };
}

/* =========================================================
   RESULT HELPERS
========================================================= */

function emptyResult(
  reason: string,
): RetracementResult {
  return {
    eligible: false,
    reason: [reason],
    trendConfirmed: false,
    entryConfirmed: false,
    reversalConfirmed: false,
    volumeConfirmed: false,
    support: null,
    resistance: null,
    ma20: null,
    entryLow: null,
    entryHigh: null,
    stopLoss: null,
    takeProfit: null,
    latestClose: null,
    latestVolume: null,
    averageVolume: null,
  };
}

/* =========================================================
   RETRACEMENT STRATEGY
========================================================= */

/**
 * Menganalisis saham menggunakan strategi Retracement.
 *
 * Input:
 * - History OHLCV dari stocks/{SYMBOL}/history.
 * - History boleh berasal dari urutan apa pun; data
 *   akan dinormalisasi dan diurutkan berdasarkan date.
 *
 * Catatan:
 * - Fungsi ini hanya menganalisis, tidak mengirim Telegram.
 * - Minimal 30 candle valid diperlukan secara default.
 * - Support, resistance, dan pola candle merupakan
 *   estimasi teknikal, bukan jaminan hasil trading.
 */
export function analyzeRetracement(
  history: StockHistoryData[],
  options: RetracementOptions = {},
): RetracementResult {
  const settings = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const candles = normalizeCandles(history);

  if (candles.length < settings.minimumCandles) {
    return emptyResult(
      `Data candle tidak cukup. Minimal ${settings.minimumCandles} candle valid diperlukan.`,
    );
  }

  const latest = candles[candles.length - 1];

  const ma20 = calculateSMA(candles, 20);

  const pivotHighs = findPivotHighs(candles);
  const pivotLows = findPivotLows(candles);

  const trendConfirmed = hasHigherHighHigherLow(
    pivotHighs,
    pivotLows,
  );

  const support = findSupport(
    pivotLows,
    candles.length - 1,
  );

  const resistance = findNextResistance(
    pivotHighs,
    latest.close,
  );

  const entryZone = findEntryZone(
    latest.close,
    support,
    ma20,
    settings.entryTolerancePercent,
  );

  const entryConfirmed = entryZone !== null;

  const reversalConfirmed = hasBullishReversal(candles);

  const averageVolume = calculateAverageVolume(
    candles,
    settings.volumeLookback,
  );

  const volumeConfirmed =
    averageVolume !== null &&
    latest.volume > averageVolume * settings.minimumVolumeRatio;

  const stopLoss =
    support !== null
      ? support * (1 - settings.stopLossBufferPercent)
      : null;

  const takeProfit = resistance;

  const reasons: string[] = [];

  if (!trendConfirmed) {
    reasons.push(
      "Tren belum terkonfirmasi membentuk Higher High dan Higher Low.",
    );
  }

  if (support === null) {
    reasons.push(
      "Support belum dapat ditentukan dari pivot low.",
    );
  }

  if (!entryConfirmed) {
    reasons.push(
      "Harga belum berada di area support atau MA20 sesuai toleransi.",
    );
  }

  if (!reversalConfirmed) {
    reasons.push(
      "Belum ada candle bullish reversal yang terdeteksi.",
    );
  }

  if (!volumeConfirmed) {
    reasons.push(
      "Volume belum memenuhi ambang konfirmasi terhadap rata-rata volume.",
    );
  }

  if (resistance === null) {
    reasons.push(
      "Resistance berikutnya belum ditemukan; take profit belum tersedia.",
    );
  }

  if (
    stopLoss !== null &&
    stopLoss >= latest.close
  ) {
    reasons.push(
      "Stop loss tidak valid karena berada di atas atau sama dengan harga terakhir.",
    );
  }

  const eligible =
    trendConfirmed &&
    entryConfirmed &&
    reversalConfirmed &&
    volumeConfirmed &&
    support !== null &&
    resistance !== null &&
    stopLoss !== null &&
    stopLoss < latest.close &&
    resistance > latest.close;

  if (eligible) {
    reasons.push(
      "Seluruh kriteria Retracement terpenuhi.",
    );
  }

  return {
    eligible,
    reason: reasons,
    trendConfirmed,
    entryConfirmed,
    reversalConfirmed,
    volumeConfirmed,
    support,
    resistance,
    ma20,
    entryLow: entryZone?.entryLow ?? null,
    entryHigh: entryZone?.entryHigh ?? null,
    stopLoss,
    takeProfit,
    latestClose: latest.close,
    latestVolume: latest.volume,
    averageVolume,
  };
}
