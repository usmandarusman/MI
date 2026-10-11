
import { db } from "@/lib/firebase-admin";

import {
  calculateAccumulationPct,
  calculateAccumulationRate,
  isQualifiedAccumulation,
  ACCUMULATION_RATE_MIN,
} from "@/lib/accumulation";

const AXENTRAZ_BASE_URL = "https://api.axentraz.id";

const AXENTRAZ_AUTH_COLLECTION = "system_config";
const AXENTRAZ_AUTH_DOCUMENT = "axentraz_auth";

export type AxentrazSymbol = {
  symbol_id: number;
  symbol: string;

  buy_lot: string | number;
  sell_lot: string | number;

  buy_val: string | number;
  sell_val: string | number;

  net_lot: string | number;
  net_val: string | number;

  active_day: string | number;
  active_buy_day: string | number;
  active_sell_day: string | number;

  peak_buy: string | number;
  peak_sell: string | number;
  avg_net: string | number;

  last_close: string | number;
  change_pct: string | number;
  ma20: string | number;
  dist_ma20: string | number;
};

type SecuritiesDocument = {
  shares?: string | number | null;
  Shares?: string | number | null;

  ownership?: {
    freeFloatPercent?: string | number | null;
    freefloatPercent?: string | number | null;
  } | null;
};

type AxentrazAuthDocument = {
  accessToken?: string | null;
};

export type AxentrazResult = {
  symbol: string;
  symbol_id: number;

  buy_lot: number;
  sell_lot: number;

  buy_val: number;
  sell_val: number;

  net_lot: number;
  net_val: number;

  active_day: number;
  active_buy_day: number;
  active_sell_day: number;

  peak_buy: number;
  peak_sell: number;
  avg_net: number;

  last_close: number;
  change_pct: number;
  ma20: number;
  dist_ma20: number;

  /**
   * Volume proxy dari data broker:
   * buy_lot + sell_lot.
   *
   * BUKAN market volume.
   */
  volume: number;

  shares: number;
  free_float: number;

  accumulation: number;
  accumulation_rate: number;
};

export type AxentrazAccumulationResponse = {
  broker_id: number;
  from: string;
  to: string;

  accumulation_target: number;
  minimum_rate: number;

  fetched: number;
  qualified: number;

  skipped_ownership: number;
  skipped_invalid: number;

  data: AxentrazResult[];
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    const number = Number(normalized);

    return Number.isFinite(number) ? number : 0;
  }

  return 0;
}

/**
 * Membaca token Axentraz terbaru dari Firestore.
 *
 * Dokumen:
 * system_config/axentraz_auth
 *
 * Field:
 * accessToken: string
 *
 * Token tidak dicetak ke log dan tidak disimpan
 * dalam cache proses agar update Firestore langsung
 * digunakan pada request berikutnya.
 */
async function getAxentrazToken(): Promise<string> {
  const snapshot = await db
    .collection(AXENTRAZ_AUTH_COLLECTION)
    .doc(AXENTRAZ_AUTH_DOCUMENT)
    .get();

  if (!snapshot.exists) {
    throw new Error(
      "Dokumen Firestore system_config/axentraz_auth belum dibuat."
    );
  }

  const data = snapshot.data() as
    | AxentrazAuthDocument
    | undefined;

  const token =
    typeof data?.accessToken === "string"
      ? data.accessToken.trim()
      : "";

  if (!token) {
    throw new Error(
      "Token Axentraz belum diisi di Firestore."
    );
  }

  return token;
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const level1 = payload as {
      data?: unknown;
    };

    if (Array.isArray(level1.data)) {
      return level1.data;
    }

    if (
      level1.data &&
      typeof level1.data === "object"
    ) {
      const level2 = level1.data as {
        data?: unknown;
      };

      if (Array.isArray(level2.data)) {
        return level2.data;
      }
    }
  }

  return [];
}

async function fetchAxentrazSymbols(
  brokerId: number,
  from: string,
  to: string
): Promise<AxentrazSymbol[]> {
  if (!Number.isInteger(brokerId) || brokerId <= 0) {
    throw new Error(
      `brokerId tidak valid: ${brokerId}`
    );
  }

  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to)) {
    throw new Error(
      `Format tanggal harus YYYYMMDD. from=${from}, to=${to}`
    );
  }

  // Ambil token terbaru dari Firestore setiap kali dipanggil.
  const token = await getAxentrazToken();

  const url =
    `${AXENTRAZ_BASE_URL}` +
    `/broker-activity/${brokerId}` +
    `/symbols?from=${encodeURIComponent(from)}` +
    `&to=${encodeURIComponent(to)}`;

  console.log("[AXENTRAZ] Request:", {
    brokerId,
    from,
    to,
    authSource: "FIRESTORE",
    url,
  });

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    console.error("[AXENTRAZ] Network error:", {
      brokerId,
      from,
      to,
      message:
        error instanceof Error
          ? error.message
          : "Unknown network error",
    });

    throw new Error(
      "Gagal menghubungi API Axentraz. Periksa koneksi atau timeout."
    );
  }

  const rawText = await response.text();

  console.log("[AXENTRAZ] HTTP:", {
    status: response.status,
    ok: response.ok,
    brokerId,
    from,
    to,
    authSource: "FIRESTORE",
  });

  if (!response.ok) {
    // Jangan mencetak token atau header Authorization ke log.
    // Batasi isi respons agar log tidak terlalu besar.
    const safeResponseBody = rawText.slice(0, 1000);

    console.error("[AXENTRAZ] Request gagal:", {
      status: response.status,
      brokerId,
      from,
      to,
      authSource: "FIRESTORE",
      responseBody: safeResponseBody,
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Axentraz HTTP ${response.status}: token tidak valid, kedaluwarsa, atau tidak memiliki izin. Perbarui token melalui halaman Admin.`
      );
    }

    throw new Error(
      `Axentraz HTTP ${response.status}: ${safeResponseBody}`
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      "Response Axentraz bukan JSON yang valid."
    );
  }

  const rows = extractArray(parsed) as AxentrazSymbol[];

  console.log("[AXENTRAZ] Symbols:", {
    brokerId,
    count: rows.length,
  });

  return rows;
}

async function getOwnershipMap(symbols: string[]) {
  const uniqueSymbols = [...new Set(symbols)];

  const ownershipMap = new Map<
    string,
    {
      shares: number;
      freeFloat: number;
    }
  >();

  if (uniqueSymbols.length === 0) {
    return ownershipMap;
  }

  const refs = uniqueSymbols.map((symbol) =>
    db.collection("securities").doc(symbol)
  );

  const snapshots = await db.getAll(...refs);

  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) {
      return;
    }

    const symbol = uniqueSymbols[index];
    const doc = snapshot.data() as SecuritiesDocument;

    const shares = toNumber(
      doc.shares ?? doc.Shares
    );

    const freeFloat = toNumber(
      doc.ownership?.freeFloatPercent ??
        doc.ownership?.freefloatPercent
    );

    if (shares <= 0 || freeFloat <= 0) {
      return;
    }

    ownershipMap.set(symbol, {
      shares,
      freeFloat,
    });
  });

  return ownershipMap;
}

export async function getAxentrazAccumulation({
  brokerId,
  from,
  to,
}: {
  brokerId: number;
  from: string;
  to: string;
}): Promise<AxentrazAccumulationResponse> {
  /*
   * from/to tetap berasal dari route.ts.
   *
   * Periode accumulation_period di Firebase
   * tetap ditentukan oleh route yang memanggil fungsi ini.
   */
  const rows = await fetchAxentrazSymbols(
    brokerId,
    from,
    to
  );

  const symbols = rows
    .map((row) =>
      String(row.symbol ?? "")
        .trim()
        .toUpperCase()
    )
    .filter(Boolean);

  const ownershipMap = await getOwnershipMap(symbols);

  const results: AxentrazResult[] = [];

  let skippedOwnership = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
    const symbol = String(row.symbol ?? "")
      .trim()
      .toUpperCase();

    if (!symbol) {
      skippedInvalid++;
      continue;
    }

    const buyLot = toNumber(row.buy_lot);
    const sellLot = toNumber(row.sell_lot);
    const netLots = toNumber(row.net_lot);

    const ownership = ownershipMap.get(symbol);

    if (!ownership) {
      skippedOwnership++;
      continue;
    }

    const volume = buyLot + sellLot;

    const accumulation = calculateAccumulationPct({
      netLots,
      shares: ownership.shares,
      freeFloat: ownership.freeFloat,
    });

    const accumulationRate =
      calculateAccumulationRate(accumulation);

    if (!isQualifiedAccumulation(accumulation)) {
      continue;
    }

    results.push({
      symbol,

      symbol_id: toNumber(row.symbol_id),

      buy_lot: buyLot,
      sell_lot: sellLot,

      buy_val: toNumber(row.buy_val),
      sell_val: toNumber(row.sell_val),

      net_lot: netLots,
      net_val: toNumber(row.net_val),

      active_day: toNumber(row.active_day),
      active_buy_day: toNumber(row.active_buy_day),
      active_sell_day: toNumber(row.active_sell_day),

      peak_buy: toNumber(row.peak_buy),
      peak_sell: toNumber(row.peak_sell),
      avg_net: toNumber(row.avg_net),

      last_close: toNumber(row.last_close),
      change_pct: toNumber(row.change_pct),
      ma20: toNumber(row.ma20),
      dist_ma20: toNumber(row.dist_ma20),

      volume,

      shares: ownership.shares,
      free_float: ownership.freeFloat,

      accumulation,

      accumulation_rate: Number(
        accumulationRate.toFixed(2)
      ),
    });
  }

  results.sort((a, b) => {
    if (b.accumulation_rate !== a.accumulation_rate) {
      return b.accumulation_rate - a.accumulation_rate;
    }

    return b.accumulation - a.accumulation;
  });

  return {
    broker_id: brokerId,

    from,
    to,

    accumulation_target: 5,

    minimum_rate: ACCUMULATION_RATE_MIN,

    fetched: rows.length,
    qualified: results.length,

    skipped_ownership: skippedOwnership,
    skipped_invalid: skippedInvalid,

    data: results,
  };
}
