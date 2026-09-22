import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await db
      .collection("securities")
      .select("Code", "Name")
      .get();

    const securities = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        code: String(data.Code ?? doc.id).toUpperCase(),
        name: String(data.Name ?? ""),
      };
    });

    // Urutkan berdasarkan kode emiten
    securities.sort((a, b) =>
      a.code.localeCompare(b.code)
    );

    return NextResponse.json({
      success: true,
      total: securities.length,
      data: securities,
    });
  } catch (error) {
    console.error("GET SECURITIES ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil data securities",
      },
      { status: 500 }
    );
  }
}