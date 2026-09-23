import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await db.collection("brokers").get();

    const brokers = snapshot.docs.map((doc) => ({
      ...doc.data(),
      broker_code: doc.id,
    }));

    return NextResponse.json({
      success: true,
      data: brokers,
    });
  } catch (error) {
    console.error("GET BROKERS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data broker",
      },
      { status: 500 }
    );
  }
}