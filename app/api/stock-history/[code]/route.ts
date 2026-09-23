
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code: rawCode } = await params;
    const code = rawCode.trim().toUpperCase();

    const startDate = req.nextUrl.searchParams.get("start");
    const endDate = req.nextUrl.searchParams.get("end");

    if (!/^[A-Z0-9]+$/.test(code)) {
      return NextResponse.json(
        { error: "Kode emiten tidak valid" },
        { status: 400 }
      );
    }

    const start = startDate?.replace(/-/g, "");
    const end = endDate?.replace(/-/g, "");

    if (
      (start && !/^\d{8}$/.test(start)) ||
      (end && !/^\d{8}$/.test(end))
    ) {
      return NextResponse.json(
        { error: "Tanggal harus format YYYYMMDD" },
        { status: 400 }
      );
    }

    let query: FirebaseFirestore.Query = db
      .collection("stocks")
      .doc(code)
      .collection("history");

    if (start) query = query.where("date", ">=", start);
    if (end) query = query.where("date", "<=", end);

    query = query.orderBy("date", "asc");

    const snapshot = await query.get();

    const history = snapshot.docs.map((doc) => doc.data());

    return NextResponse.json({
      success: true,
      code,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error("Get stock history error:", error);

    return NextResponse.json(
      { error: "Gagal mengambil histori saham" },
      { status: 500 }
    );
  }
}