import { NextRequest, NextResponse } from "next/server";
import {
  fetchStockSummary,
  saveStockRows,
} from "@/lib/stock-history";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getJakartaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}${values.month}${values.day}`;
}

async function syncStocks(date: string) {
  const rows = await fetchStockSummary(date);

  if (rows.length === 0) {
    return {
      success: true,
      date,
      fetched: 0,
      saved: 0,
      message: "Tidak ada data dari Zapi untuk tanggal ini",
    };
  }

  const saved = await saveStockRows(rows);

  return {
    success: true,
    date,
    fetched: rows.length,
    saved,
    syncedAt: new Date().toISOString(),
  };
}

// Vercel Cron: GET + CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const date = getJakartaDate();
    const result = await syncStocks(date);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron stock sync error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal sync histori",
      },
      { status: 500 }
    );
  }
}

// Manual POST: x-sync-secret + body.date
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret");

  if (
    !process.env.STOCK_SYNC_SECRET ||
    secret !== process.env.STOCK_SYNC_SECRET
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const date = String(body?.date ?? "");

    if (!/^\d{8}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          error: "Tanggal wajib format YYYYMMDD",
        },
        { status: 400 }
      );
    }

    const result = await syncStocks(date);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Manual stock sync error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal sync histori",
      },
      { status: 500 }
    );
  }
}