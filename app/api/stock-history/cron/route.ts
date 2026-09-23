
import { NextRequest, NextResponse } from "next/server";
import {
  fetchStockSummary,
  saveStockRows,
} from "@/lib/stock-history";
import { db } from "@/lib/firebase-admin";

export const maxDuration = 60;

function normalizeDate(value: string) {
  return value.replace(/-/g, "").slice(0, 8);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Fetch snapshot seluruh emiten dari Zapi
    const rows = await fetchStockSummary();

    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "Data Zapi kosong" },
        { status: 502 }
      );
    }

    const latestDate = normalizeDate(rows[0].Date);

    if (!/^\d{8}$/.test(latestDate)) {
      return NextResponse.json(
        { success: false, error: "Tanggal Zapi tidak valid" },
        { status: 502 }
      );
    }

    // Pastikan semua row berasal dari tanggal snapshot yang sama
    const mixedDates = rows.some(
      (row) => normalizeDate(row.Date) !== latestDate
    );

    if (mixedDates) {
      return NextResponse.json(
        {
          success: false,
          error: "Data Zapi berisi tanggal yang berbeda",
        },
        { status: 502 }
      );
    }

    const checkpointRef = db
      .collection("system")
      .doc("stockOhlcvSync");

    const checkpoint = await checkpointRef.get();
    const lastCompletedDate = checkpoint.data()?.lastCompletedDate;

    // Sudah pernah berhasil menyimpan tanggal ini,
    // atau Zapi mengembalikan snapshot yang lebih lama.
    if (
      lastCompletedDate &&
      latestDate <= lastCompletedDate
    ) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Tanggal sudah pernah disinkronkan",
        latestDate,
        lastCompletedDate,
      });
    }

    // Simpan OHLCV seluruh emiten
    const saved = await saveStockRows(rows);

    // Checkpoint hanya diperbarui setelah save selesai
    await checkpointRef.set(
      {
        lastCompletedDate: latestDate,
        lastFetchedCount: rows.length,
        lastSavedCount: saved,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      skipped: false,
      date: latestDate,
      fetched: rows.length,
      saved,
    });
  } catch (error) {
    console.error("Daily OHLCV cron error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Cron sync gagal",
      },
      { status: 500 }
    );
  }
}