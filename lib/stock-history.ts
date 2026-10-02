import { db } from "@/lib/firebase-admin";

const ZAPI_URL =
  "https://api.zpi.web.id/v1/finance:idx/raw";

export type StockRow = {
  StockCode: string;
  StockName?: string;
  Date: string;
  OpenPrice?: number | string;
  High?: number | string;
  Low?: number | string;
  Close?: number | string;
  Volume?: number | string;
  Value?: number | string;
  Frequency?: number | string;
  ForeignBuy?: number | string;
  ForeignSell?: number | string;
};

function normalizeDate(value: string) {
  return value.replace(/-/g, "").slice(0, 8);
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const result = Number(value);

  return Number.isFinite(result) ? result : 0;
}

/**
 * Fetch seluruh emiten untuk satu tanggal.
 * Tanpa date = ambil snapshot terbaru dari Zapi.
 */
export async function fetchStockSummary(date?: string) {
  const apiKey = process.env.ZAPI_API_KEY;

  if (!apiKey) {
    throw new Error("ZAPI_API_KEY belum diatur");
  }

  const normalizedDate = date ? normalizeDate(date) : "";

  if (normalizedDate && !/^\d{8}$/.test(normalizedDate)) {
    throw new Error("Format tanggal harus YYYYMMDD");
  }

  const rawQuery = new URLSearchParams({
    length: "5000",
    start: "0",
    ...(normalizedDate ? { date: normalizedDate } : {}),
  }).toString();

  const params = new URLSearchParams({
    path: "TradingSummary/GetStockSummary",
    query: rawQuery,
  });

  const response = await fetch(`${ZAPI_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Zapi error ${response.status}: ${errorText}`
    );
  }

  const result = await response.json();

  const rows = result?.data?.data;

  if (!Array.isArray(rows)) {
    throw new Error(
      "Response Zapi tidak berisi array data"
    );
  }

  return rows as StockRow[];
}

/**
 * Simpan metadata emiten + histori OHLCV.
 *
 * Struktur:
 * stocks/{CODE}
 * stocks/{CODE}/history/{YYYYMMDD}
 */
export async function saveStockRows(
  rows: StockRow[]
) {
  let batch = db.batch();
  let operations = 0;
  let saved = 0;

  async function commitBatch() {
    if (operations === 0) {
      return;
    }

    await batch.commit();

    batch = db.batch();
    operations = 0;
  }

  for (const row of rows) {
    if (!row.StockCode || !row.Date) {
      continue;
    }

    const code = row.StockCode
      .trim()
      .toUpperCase();

    const date = normalizeDate(row.Date);

    if (!/^[A-Z0-9]+$/.test(code)) {
      continue;
    }

    if (!/^\d{8}$/.test(date)) {
      continue;
    }

    const stockRef = db
      .collection("stocks")
      .doc(code);

    const historyRef = stockRef
      .collection("history")
      .doc(date);

    /**
     * Metadata emiten
     */
    batch.set(
      stockRef,
      {
        code,
        name: row.StockName ?? code,
        updatedAt: new Date(),
      },
      {
        merge: true,
      }
    );

    operations++;

    /**
     * Histori OHLCV
     */
    batch.set(
      historyRef,
      {
        code,
        date,

        open: toNumber(row.OpenPrice),
        high: toNumber(row.High),
        low: toNumber(row.Low),
        close: toNumber(row.Close),

        volume: toNumber(row.Volume),
        value: toNumber(row.Value),
        frequency: toNumber(row.Frequency),

        foreignBuy: toNumber(row.ForeignBuy),
        foreignSell: toNumber(row.ForeignSell),

        source: "zapi",

        updatedAt: new Date(),
      },
      {
        merge: true,
      }
    );

    operations++;
    saved++;

    /**
     * Batas aman di bawah 500 operasi
     */
    if (operations >= 400) {
      await commitBatch();
    }
  }

  await commitBatch();

  return saved;
}

/* =========================================================
   READ HISTORICAL STOCK DATA
   ========================================================= */

export type StockHistory = {
  date: string;

  open: number;
  high: number;
  low: number;
  close: number;

  volume: number;

  value?: number;
  frequency?: number;

  foreignBuy?: number;
  foreignSell?: number;

  source?: string;
};

/**
 * Mendapatkan tanggal hari ini berdasarkan timezone Jakarta.
 *
 * Hasil:
 * YYYYMMDD
 *
 * Contoh:
 * 20260930
 */
function getTodayJakarta(): string {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const year =
    parts.find(
      (item) => item.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (item) => item.type === "month"
    )?.value ?? "";

  const day =
    parts.find(
      (item) => item.type === "day"
    )?.value ?? "";

  return `${year}${month}${day}`;
}

/**
 * Ambil histori saham dari Firestore.
 *
 * Contoh:
 *
 * getStockHistory("AADI")
 *
 * default:
 * 20260820 -> hari ini
 */
export async function getStockHistory(
  code: string,
  startDate = "20260820",
  endDate?: string
): Promise<StockHistory[]> {
  const normalizedCode = code
    .trim()
    .toUpperCase();

  const normalizedStart =
    normalizeDate(startDate);

  const normalizedEnd =
    normalizeDate(
      endDate ?? getTodayJakarta()
    );

  if (!/^[A-Z0-9]+$/.test(normalizedCode)) {
    throw new Error(
      "Kode saham tidak valid"
    );
  }

  if (!/^\d{8}$/.test(normalizedStart)) {
    throw new Error(
      "startDate harus YYYYMMDD"
    );
  }

  if (!/^\d{8}$/.test(normalizedEnd)) {
    throw new Error(
      "endDate harus YYYYMMDD"
    );
  }

  if (normalizedStart > normalizedEnd) {
    throw new Error(
      "startDate tidak boleh lebih besar dari endDate"
    );
  }

  const historyRef = db
    .collection("stocks")
    .doc(normalizedCode)
    .collection("history");

  /**
   * Kita sengaja tidak menggunakan orderBy di Firestore.
   *
   * Tujuannya supaya query tidak membutuhkan
   * composite index tambahan.
   *
   * Setelah data didapat, kita sort di server.
   */
  const snapshot = await historyRef
    .where(
      "__name__",
      ">=",
      normalizedStart
    )
    .where(
      "__name__",
      "<=",
      normalizedEnd
    )
    .get();

  const result: StockHistory[] = [];

  for (const doc of snapshot.docs) {
    const raw = doc.data();

    const date = normalizeDate(
      String(
        raw.date ?? doc.id
      )
    );

    if (!/^\d{8}$/.test(date)) {
      continue;
    }

    const open = toNumber(raw.open);
    const high = toNumber(raw.high);
    const low = toNumber(raw.low);
    const close = toNumber(raw.close);
    const volume = toNumber(raw.volume);

    /**
     * Data OHLC yang tidak valid jangan dimasukkan
     * ke chart.
     */
    if (
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0
    ) {
      continue;
    }

    result.push({
      date,

      open,
      high,
      low,
      close,

      volume,

      value:
        raw.value !== undefined
          ? toNumber(raw.value)
          : undefined,

      frequency:
        raw.frequency !== undefined
          ? toNumber(raw.frequency)
          : undefined,

      foreignBuy:
        raw.foreignBuy !== undefined
          ? toNumber(raw.foreignBuy)
          : undefined,

      foreignSell:
        raw.foreignSell !== undefined
          ? toNumber(raw.foreignSell)
          : undefined,

      source:
        typeof raw.source === "string"
          ? raw.source
          : undefined,
    });
  }

  /**
   * Urutkan dari tanggal paling lama
   * ke tanggal paling baru.
   */
  result.sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return result;
}