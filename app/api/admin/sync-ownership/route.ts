
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// COLLECTION YANG BENAR
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
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function isValidInvestor(value: unknown): value is Investor {
  if (!value || typeof value !== "object") return false;

  const investor = value as Record<string, unknown>;

  return (
    typeof investor.investorName === "string" &&
    investor.investorName.trim().length > 0
  );
}

function validateStock(
  value: unknown
): value is OwnershipStock {
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

  // Validasi total persentase dengan toleransi pembulatan.
  if (Math.abs(stock.float + stock.freeFloat - 100) > 1) {
    return false;
  }

  if (
    !Array.isArray(stock.investors) ||
    !stock.investors.every(isValidInvestor)
  ) {
    return false;
  }

  return true;
}

async function fetchOwnershipData() {
  const apiUrl = process.env.IDX_OWNERSHIP_API_URL;
  const token = process.env.IDX_OWNERSHIP_TOKEN;
  const year = process.env.IDX_OWNERSHIP_YEAR;
  const month = process.env.IDX_OWNERSHIP_MONTH;

  if (!apiUrl || !token || !year || !month) {
    throw new Error(
      "Environment IDX Ownership belum lengkap"
    );
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
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `IDX Ownership API error: ${response.status}`
    );
  }

  const json: unknown = await response.json();

  // Support array langsung atau { data: [...] }.
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

function getPeriod() {
  const year = process.env.IDX_OWNERSHIP_YEAR!;
  const month = String(
    process.env.IDX_OWNERSHIP_MONTH!
  ).padStart(2, "0");

  return `${year}-${month}`;
}

function normalizeStock(
  stock: OwnershipStock
): OwnershipStock {
  return {
    ...stock,
    ticker: stock.ticker.trim().toUpperCase(),
  };
}

// GET: preview response API, tidak menulis ke Firestore.
export async function GET() {
  try {
    const rawData = await fetchOwnershipData();

    const validData = rawData
      .filter(validateStock)
      .map(normalizeStock);

    return NextResponse.json({
      success: true,
      mode: "preview",
      collection: COLLECTION,
      period: getPeriod(),
      totalFetched: rawData.length,
      validCount: validData.length,
      invalidCount: rawData.length - validData.length,
      sample: validData.slice(0, 5).map((stock) => ({
        ticker: stock.ticker,
        name: stock.name,
        freeFloat: stock.freeFloat,
        float: stock.float,
        investorCount: stock.investors.length,
      })),
    });
  } catch (error) {
    console.error("Ownership preview failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Preview gagal",
      },
      { status: 500 }
    );
  }
}

// POST: dry run atau sync ke securities/{TICKER}.
export async function POST(req: NextRequest) {
  try {
    // Tambahkan autentikasi admin sebelum production.
    const body = await req.json().catch(() => ({}));

    // Default dryRun = true.
    const dryRun = body?.dryRun !== false;

    const rawData = await fetchOwnershipData();

    const validData = rawData
      .filter(validateStock)
      .map(normalizeStock);

    const uniqueStocks = new Map<string, OwnershipStock>();

    for (const stock of validData) {
      uniqueStocks.set(stock.ticker, stock);
    }

    const stocks = [...uniqueStocks.values()];

    if (dryRun) {
      return NextResponse.json({
        success: true,
        mode: "dryRun",
        collection: COLLECTION,
        totalFetched: rawData.length,
        validCount: stocks.length,
        invalidCount: rawData.length - validData.length,
        message: "Dry run selesai. Firestore belum diubah.",
        sample: stocks.slice(0, 10).map((stock) => ({
          ticker: stock.ticker,
          freeFloat: stock.freeFloat,
          float: stock.float,
        })),
      });
    }

    let written = 0;
    let skippedMissingDocs = 0;

    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const chunk = stocks.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      // Ambil dokumen yang sudah ada.
      const refs = chunk.map((stock) =>
        db.collection(COLLECTION).doc(stock.ticker)
      );

      const snapshots = await db.getAll(...refs);

      for (let index = 0; index < chunk.length; index++) {
        const stock = chunk[index];
        const snapshot = snapshots[index];

        // Hanya update emiten yang sudah ada.
        // Mencegah pembuatan dokumen duplikat/tidak lengkap.
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
              period: getPeriod(),
              updatedAt: FieldValue.serverTimestamp(),
            },

            ownershipUpdatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        written++;
      }

      // Jangan commit batch kosong.
      if (written > 0) {
        await batch.commit();
      }
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Ownership sync failed:", error);

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