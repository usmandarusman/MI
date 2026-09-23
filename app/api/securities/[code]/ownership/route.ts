import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const ticker = code.trim().toUpperCase();

    if (!/^[A-Z]{4}$/.test(ticker)) {
      return NextResponse.json(
        { error: "Kode emiten tidak valid" },
        { status: 400 }
      );
    }

    // Ambil dokumen emiten dari collection securities
    const snapshot = await db
      .collection("securities")
      .doc(ticker)
      .get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          error: `Dokumen securities/${ticker} tidak ditemukan`,
        },
        { status: 404 }
      );
    }

    const doc = snapshot.data();

    // Antisipasi perbedaan huruf besar/kecil nama field
    const shares = doc?.shares ?? doc?.Shares ?? null;

    const ownership = doc?.ownership ?? {};

    const freeFloatPercent =
      ownership?.freeFloatPercent ??
      ownership?.freefloatPercent ??
      null;

    // Debug di terminal server/Vercel
    console.log(`[Ownership API] ${ticker}`, {
      shares,
      freeFloatPercent,
      availableFields: Object.keys(doc ?? {}),
    });

    return NextResponse.json({
      code: ticker,
      shares,
      freeFloatPercent,
    });
  } catch (error) {
    console.error("Ownership API error:", error);

    return NextResponse.json(
      { error: "Gagal mengambil data CSO dan Free Float" },
      { status: 500 }
    );
  }
}