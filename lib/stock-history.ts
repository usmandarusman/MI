
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

  // Response Zapi:
  // result.data.data = array emiten
  const rows = result?.data?.data;

  if (!Array.isArray(rows)) {
    throw new Error("Response Zapi tidak berisi array data");
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
export async function saveStockRows(rows: StockRow[]) {
  let batch = db.batch();
  let operations = 0;
  let saved = 0;

  async function commitBatch() {
    if (operations === 0) return;

    await batch.commit();

    batch = db.batch();
    operations = 0;
  }

  for (const row of rows) {
    if (!row.StockCode || !row.Date) continue;

    const code = row.StockCode.trim().toUpperCase();
    const date = normalizeDate(row.Date);

    if (!/^[A-Z0-9]+$/.test(code)) continue;
    if (!/^\d{8}$/.test(date)) continue;

    const stockRef = db.collection("stocks").doc(code);

    const historyRef = stockRef
      .collection("history")
      .doc(date);

    // Metadata emiten
    batch.set(
      stockRef,
      {
        code,
        name: row.StockName ?? code,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    operations++;

    // Histori OHLCV per tanggal
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
      { merge: true }
    );

    operations++;
    saved++;

    // Batas aman di bawah 500 operasi per batch
    if (operations >= 400) {
      await commitBatch();
    }
  }

  await commitBatch();

  return saved;
}