
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const AXENTRAZ_URL =
  "https://api.axentraz.id/v1/broker-activity/brokers";

export async function GET(req: NextRequest) {
  return syncBrokers(req);
}

export async function POST(req: NextRequest) {
  return syncBrokers(req);
}

async function syncBrokers(req: NextRequest) {
  try {
    // 1. Validasi CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        {
          success: false,
          message: "CRON_SECRET belum diatur",
        },
        { status: 500 }
      );
    }

    if (
      req.headers.get("authorization") !==
      `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // 2. Validasi API key Axentraz
    const apiKey = process.env.AXENTRAZ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "AXENTRAZ_API_KEY belum diatur",
        },
        { status: 500 }
      );
    }

    // 3. Fetch Axentraz
    const response = await fetch(AXENTRAZ_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        "AXENTRAZ ERROR:",
        response.status,
        responseText.slice(0, 500)
      );

      return NextResponse.json(
        {
          success: false,
          message: "Gagal mengambil data Axentraz",
          upstreamStatus: response.status,
          details: responseText.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    // 4. Parse JSON
    let payload: any;

    try {
      payload = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Response Axentraz bukan JSON valid",
        },
        { status: 502 }
      );
    }

    // 5. Pastikan data berbentuk array
    if (!Array.isArray(payload?.data)) {
      return NextResponse.json(
        {
          success: false,
          message: "payload.data bukan array",
          responseKeys: Object.keys(payload ?? {}),
        },
        { status: 422 }
      );
    }

    const rawBrokers: any[] = payload.data;

    if (rawBrokers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Axentraz mengembalikan data kosong",
        },
        { status: 422 }
      );
    }

    // 6. Validasi hanya broker_code
    // Nama dan is_foreign tidak wajib.
    const validBrokers = rawBrokers.filter(
      (broker) =>
        broker &&
        typeof broker === "object" &&
        typeof broker.broker_code === "string" &&
        broker.broker_code.trim().length > 0
    );

    const skippedBrokers = rawBrokers.filter(
      (broker) =>
        !broker ||
        typeof broker !== "object" ||
        typeof broker.broker_code !== "string" ||
        !broker.broker_code.trim()
    );

    // Kalau tidak ada kode broker valid, jangan tulis apa pun.
    if (validBrokers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak ada broker dengan broker_code valid",
          totalFromApi: rawBrokers.length,
          sample: rawBrokers.slice(0, 3),
        },
        { status: 422 }
      );
    }

    // 7. Normalisasi dan pertahankan field asli
    const normalizedBrokers = validBrokers.map((broker) => {
      const code = broker.broker_code.trim().toUpperCase();

      const name =
        typeof broker.broker_name === "string" &&
        broker.broker_name.trim()
          ? broker.broker_name.trim()
          : code;

      return {
        ...broker,
        broker_code: code,
        broker_name: name,

        // Tidak memaksa is_foreign menjadi boolean.
        // Nilai asli dari Axentraz tetap dipertahankan.
        source: "axentraz",
        updatedAt: FieldValue.serverTimestamp(),
      };
    });

    // 8. Hilangkan duplikat berdasarkan broker_code
    const uniqueBrokers = Array.from(
      new Map(
        normalizedBrokers.map((broker) => [
          broker.broker_code,
          broker,
        ])
      ).values()
    );

    // 9. Simpan ke Firestore
    // Collection: brokers
    // Document ID: broker_code
    const collection = db.collection("brokers");

    let saved = 0;

    for (
      let i = 0;
      i < uniqueBrokers.length;
      i += 500
    ) {
      const chunk = uniqueBrokers.slice(i, i + 500);
      const batch = db.batch();

      for (const broker of chunk) {
        const { broker_code, ...data } = broker;

        batch.set(
          collection.doc(broker_code),
          {
            ...data,
            broker_code,
          },
          { merge: true }
        );
      }

      await batch.commit();
      saved += chunk.length;
    }

    // 10. Response hasil sync
    return NextResponse.json({
      success: true,
      message: "Sinkronisasi broker selesai",
      collection: "brokers",
      totalFromApi: rawBrokers.length,
      totalValid: validBrokers.length,
      totalUnique: uniqueBrokers.length,
      saved,
      skipped: skippedBrokers.length,

      // Contoh data yang tidak punya broker_code
      skippedSamples: skippedBrokers.slice(0, 5),

      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("SYNC BROKERS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ?? "Internal server error",
      },
      { status: 500 }
    );
  }
}