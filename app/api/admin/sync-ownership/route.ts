
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const COLLECTION = "securities";
const BATCH_SIZE = 400;
const MAX_MONTHS_TO_CHECK = 12;

const OWNERSHIP_BASE_URL =
  "https://idx-stocks-ownership.vercel.app";

const TOKEN_API_URL = `${OWNERSHIP_BASE_URL}/api/token`;

type Investor = {
  investorName: string;
  investorType?: string;
  localForeign?: string;
  domicile?: string;
  totalHoldingShare?: number;
  percentage?: number;
  hasPrevData?: boolean;
  change?: number;
};

type OwnershipStock = {
  ticker: string;
  name: string;
  sector?: string;
  investorCount?: number;
  float: number;
  freeFloat: number;
  investors: Investor[];
};

type OwnershipPeriod = {
  year: string;
  month: string;
  period: string;
};

function isNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function isValidInvestor(
  value: unknown
): value is Investor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const investor = value as Record<string, unknown>;

  return (
    typeof investor.investorName === "string" &&
    investor.investorName.trim().length > 0
  );
}

function validateStock(
  value: unknown
): value is OwnershipStock {
  if (!value || typeof value !== "object") {
    return false;
  }

  const stock = value as Record<string, unknown>;

  if (typeof stock.ticker !== "string") {
    return false;
  }

  const ticker = stock.ticker.trim().toUpperCase();

  if (!/^[A-Z0-9]{1,10}$/.test(ticker)) {
    return false;
  }

  if (
    typeof stock.name !== "string" ||
    !stock.name.trim()
  ) {
    return false;
  }

  if (
    !isNumber(stock.float) ||
    !isNumber(stock.freeFloat) ||
    stock.float < 0 ||
    stock.float > 100 ||
    stock.freeFloat < 0 ||
    stock.freeFloat > 100
  ) {
    return false;
  }

  if (
    Math.abs(stock.float + stock.freeFloat - 100) > 1
  ) {
    return false;
  }

  return (
    Array.isArray(stock.investors) &&
    stock.investors.every(isValidInvestor)
  );
}

function normalizeStock(
  stock: OwnershipStock
): OwnershipStock {
  return {
    ...stock,
    ticker: stock.ticker.trim().toUpperCase(),
  };
}

function getCurrentJakartaYearMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  if (!year || !month) {
    throw new Error(
      "Gagal menentukan periode waktu Jakarta"
    );
  }

  return {
    year: Number(year),
    month: Number(month),
  };
}

function getPreviousPeriod(
  year: number,
  month: number,
  offset: number
): OwnershipPeriod {
  const date = new Date(
    Date.UTC(year, month - 1 - offset, 1)
  );

  const targetYear = String(date.getUTCFullYear());

  const targetMonth = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  return {
    year: targetYear,
    month: targetMonth,
    period: `${targetYear}-${targetMonth}`,
  };
}

/**
 * Mengambil token terbaru dari endpoint token.
 *
 * Token tidak lagi dibaca dari IDX_OWNERSHIP_TOKEN.
 * Token hanya digunakan dalam memori selama eksekusi ini.
 */
async function fetchOwnershipToken(): Promise<string> {
  const response = await fetch(TOKEN_API_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `IDX Ownership token API error: ${response.status}`
    );
  }

  const json: unknown = await response.json();

  if (
    !json ||
    typeof json !== "object" ||
    !("token" in json) ||
    typeof json.token !== "string" ||
    !json.token.trim()
  ) {
    throw new Error(
      "Response IDX Ownership tidak berisi token yang valid"
    );
  }

  return json.token.trim();
}

function extractArray(
  json: unknown
): unknown[] | null {
  if (Array.isArray(json)) {
    return json;
  }

  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    Array.isArray(
      (json as { data: unknown }).data
    )
  ) {
    return (json as { data: unknown[] }).data;
  }

  return null;
}

async function fetchOwnershipData(): Promise<{
  rawData: unknown[];
  stocks: OwnershipStock[];
  selectedPeriod: OwnershipPeriod;
}> {
  const apiUrl = process.env.IDX_OWNERSHIP_API_URL;

  if (!apiUrl) {
    throw new Error(
      "Environment IDX_OWNERSHIP_API_URL belum diatur"
    );
  }

  // Ambil token otomatis setiap eksekusi cron.
  const token = await fetchOwnershipToken();

  const current = getCurrentJakartaYearMonth();

  // Periksa bulan terbaru dahulu, lalu mundur.
  for (
    let offset = 0;
    offset < MAX_MONTHS_TO_CHECK;
    offset++
  ) {
    const selectedPeriod = getPreviousPeriod(
      current.year,
      current.month,
      offset
    );

    const url = new URL(apiUrl);

    url.searchParams.set("token", token);
    url.searchParams.set(
      "year",
      selectedPeriod.year
    );
    url.searchParams.set(
      "month",
      String(Number(selectedPeriod.month))
    );

    console.log(
      `Checking IDX ownership period: ${selectedPeriod.period}`
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      throw new Error(
        `IDX Ownership API authentication failed: ${response.status}. Token otomatis ditolak oleh API.`
      );
    }

    // Periode mungkin belum tersedia.
    if (
      response.status === 400 ||
      response.status === 404 ||
      response.status === 422
    ) {
      console.log(
        `IDX ownership period ${selectedPeriod.period} unavailable: ${response.status}`
      );

      continue;
    }

    if (!response.ok) {
      throw new Error(
        `IDX Ownership API error: ${response.status} for ${selectedPeriod.period}`
      );
    }

    const json: unknown = await response.json();

    const rawData = extractArray(json);

    if (!rawData) {
      throw new Error(
        `Format response API tidak valid untuk periode ${selectedPeriod.period}`
      );
    }

    const stocks = rawData
      .filter(validateStock)
      .map(normalizeStock);

    if (stocks.length === 0) {
      console.log(
        `No valid ownership data for ${selectedPeriod.period}; checking previous month`
      );

      continue;
    }

    return {
      rawData,
      stocks,
      selectedPeriod,
    };
  }

  throw new Error(
    `Tidak ditemukan data ownership valid dalam ${MAX_MONTHS_TO_CHECK} bulan terakhir. Firestore tidak diubah.`
  );
}

async function syncOwnership() {
  const {
    rawData,
    stocks,
    selectedPeriod,
  } = await fetchOwnershipData();

  // Hilangkan ticker duplikat.
  const uniqueStocks = new Map<
    string,
    OwnershipStock
  >();

  for (const stock of stocks) {
    uniqueStocks.set(stock.ticker, stock);
  }

  const uniqueList = [...uniqueStocks.values()];

  let written = 0;
  let skippedMissingDocs = 0;

  for (
    let i = 0;
    i < uniqueList.length;
    i += BATCH_SIZE
  ) {
    const chunk = uniqueList.slice(
      i,
      i + BATCH_SIZE
    );

    const refs = chunk.map((stock) =>
      db.collection(COLLECTION).doc(stock.ticker)
    );

    const snapshots = await db.getAll(...refs);

    const batch = db.batch();
    let chunkWritten = 0;

    for (
      let index = 0;
      index < chunk.length;
      index++
    ) {
      const stock = chunk[index];
      const snapshot = snapshots[index];

      // Hanya update dokumen yang sudah ada.
      if (!snapshot.exists) {
        skippedMissingDocs++;
        continue;
      }

      batch.set(
        refs[index],
        {
          ownership: {
            freeFloatPercent: stock.freeFloat,
            floatPercent: stock.float,
            investorCount:
              stock.investorCount ??
              stock.investors.length,
            investors: stock.investors,
            source: "idx-stocks-ownership",
            period: selectedPeriod.period,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          ownershipUpdatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      chunkWritten++;
    }

    if (chunkWritten > 0) {
      await batch.commit();
      written += chunkWritten;
    }
  }

  return {
    success: true,
    mode: "sync",
    collection: COLLECTION,
    period: selectedPeriod.period,
    totalFetched: rawData.length,
    validCount: uniqueList.length,
    written,
    skippedMissingDocs,
    invalidCount: rawData.length - stocks.length,
    message: "Ownership berhasil disinkronkan.",
    syncedAt: new Date().toISOString(),
  };
}

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const manualSecret = req.headers.get("x-sync-secret");

  return (
    (!!process.env.CRON_SECRET &&
      auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (!!process.env.STOCK_SYNC_SECRET &&
      manualSecret ===
        process.env.STOCK_SYNC_SECRET)
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const result = await syncOwnership();

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Ownership cron sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Sync gagal",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const result = await syncOwnership();

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Ownership manual sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Sync gagal",
      },
      { status: 500 }
    );
  }
}
