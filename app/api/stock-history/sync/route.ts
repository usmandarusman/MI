
import { NextRequest, NextResponse } from "next/server";
import {
  fetchStockSummary,
  saveStockRows,
} from "@/lib/stock-history";

export const maxDuration = 60;

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

    const rows = await fetchStockSummary(date);

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        date,
        fetched: 0,
        saved: 0,
        message: "Tidak ada data dari Zapi untuk tanggal ini",
      });
    }

    const saved = await saveStockRows(rows);

    return NextResponse.json({
      success: true,
      date,
      fetched: rows.length,
      saved,
    });
  } catch (error) {
    console.error("Initial stock sync error:", error);

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