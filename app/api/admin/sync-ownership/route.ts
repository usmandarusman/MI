import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const COLLECTION = "securities";
const BATCH_SIZE = 400;

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

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidInvestor(value: unknown): value is Investor {
  if (!value || typeof value !== "object") return false;

  const investor = value as Record<string, unknown>;

  return (
    typeof investor.investorName === "string" &&
    investor.investorName.trim().length > 0
  );
}

function validateStock(value: unknown): value is OwnershipStock {
  if (!value || typeof value !== "object") return false;

  const stock = value as Record<string, unknown>;

  if (typeof stock.ticker !== "string") return false;

  const ticker = stock.ticker.trim().toUpperCase();

  if (!/^[A-Z0-9]{1,10}$/.test(ticker)) return false;

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

  if (Math.abs(stock.float + stock.freeFloat - 100) > 1) {
    return false;
  }

  return (
    Array.isArray(stock.investors) &&
    stock.investors.every(isValidInvestor)
  );
}

function getPeriod() {
  const year = process.env.IDX_OWNERSHIP_YEAR;
  const month = process.env.IDX_OWNERSHIP_MONTH;

  if (!year || !month) {
    throw new Error("Periode IDX Ownership belum diatur");
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

async function fetchOwnershipData() {
  const apiUrl = process.env.IDX_OWNERSHIP_API_URL;
  const token = process.env.IDX_OWNERSHIP_TOKEN;
  const year = process.env.IDX_OWNERSHIP_YEAR;
  const month = process.env.IDX_OWNERSHIP_MONTH;

  if (!apiUrl || !token || !year || !month) {
    throw new Error("Environment IDX Ownership belum lengkap");
  }

  const monthNumber = Number(month);

  if (
    !/^\d{4}$/.test(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error("Periode year/month tidak valid");
  }

  const url = new URL(apiUrl);
  url.searchParams.set("token", token);
  url.searchParams.set("year", year);
  url.searchParams.set("month", month);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `IDX Ownership API error: ${response.status}`
    );
  }

  const json: unknown = await response.json();

  const data =
    Array.isArray(json)
      ? json
      : json &&
          typeof json === "object" &&
          "data" in json
        ? (json as { data: unknown }).data
        : null;

  if (!Array.isArray(data)) {
    throw new Error("Format response API tidak valid");
  }

  return data;
}

function normalizeStock(stock: OwnershipStock) {
  return {
    ...stock,
    ticker: stock.ticker.trim().toUpperCase(),
  };
}

async function syncOwnership() {
  const rawData = await fetchOwnershipData();

  const validData = rawData
    .filter(validateStock)
    .map(normalizeStock);

  const uniqueStocks = new Map<string, OwnershipStock>();

  for (const stock of validData) {
    uniqueStocks.set(stock.ticker, stock);
  }

  const stocks = [...uniqueStocks.values()];

  if (!stocks.length) {
    throw new Error(
      "Tidak ada data ownership valid. Firestore tidak diubah."
    );
  }

  let written = 0;
  let skippedMissingDocs = 0;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const chunk = stocks.slice(i, i + BATCH_SIZE);
    const refs = chunk.map((stock) =>
      db.collection(COLLECTION).doc(stock.ticker)
    );

    const snapshots = await db.getAll(...refs);
    const batch = db.batch();
    let chunkWritten = 0;

    for (let index = 0; index < chunk.length; index++) {
      const stock = chunk[index];
      const snapshot = snapshots[index];

      // Hanya update dokumen securities yang sudah ada.
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
              stock.investorCount ?? stock.investors.length,
            investors: stock.investors,
            source: "idx-stocks-ownership",
            period: getPeriod(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          ownershipUpdatedAt: FieldValue.serverTimestamp(),
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
    period: getPeriod(),
    totalFetched: rawData.length,
    validCount: stocks.length,
    written,
    skippedMissingDocs,
    invalidCount: rawData.length - validData.length,
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
      manualSecret === process.env.STOCK_SYNC_SECRET)
  );
}

// Vercel Cron: langsung sync, bukan preview.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(await syncOwnership());
  } catch (error) {
    console.error("Ownership cron sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Sync gagal",
      },
      { status: 500 }
    );
  }
}

// Manual POST juga menjalankan sync.
// Tidak ada dryRun yang bisa membuat cron tidak menulis data.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(await syncOwnership());
  } catch (error) {
    console.error("Ownership manual sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Sync gagal",
      },
      { status: 500 }
    );
  }
}