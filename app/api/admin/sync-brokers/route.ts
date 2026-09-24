/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const AXENTRAZ_URL =
  "https://api.axentraz.id/v1/broker-activity/brokers";

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");

  return (
    (!!process.env.CRON_SECRET &&
      auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (!!process.env.SYNC_SECRET &&
      auth === `Bearer ${process.env.SYNC_SECRET}`)
  );
}

async function syncBrokers() {
  const apiKey = process.env.AXENTRAZ_API_KEY;

  if (!apiKey) {
    throw new Error("AXENTRAZ_API_KEY belum diatur");
  }

  const response = await fetch(AXENTRAZ_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(
      "AXENTRAZ ERROR:",
      response.status,
      responseText.slice(0, 500)
    );

    throw new Error(
      `Gagal mengambil data Axentraz: ${response.status}`
    );
  }

  let payload: any;

  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error("Response Axentraz bukan JSON valid");
  }

  if (!Array.isArray(payload?.data)) {
    throw new Error("payload.data bukan array");
  }

  const rawBrokers: any[] = payload.data;

  if (!rawBrokers.length) {
    throw new Error("Axentraz mengembalikan data kosong");
  }

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

  if (!validBrokers.length) {
    throw new Error(
      "Tidak ada broker dengan broker_code valid"
    );
  }

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
      source: "axentraz",
      updatedAt: FieldValue.serverTimestamp(),
    };
  });

  const uniqueBrokers = Array.from(
    new Map(
      normalizedBrokers.map((broker) => [
        broker.broker_code,
        broker,
      ])
    ).values()
  );

  const collection = db.collection("brokers");
  let saved = 0;

  for (let i = 0; i < uniqueBrokers.length; i += 500) {
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

  return {
    success: true,
    message: "Sinkronisasi broker selesai",
    collection: "brokers",
    totalFromApi: rawBrokers.length,
    totalValid: validBrokers.length,
    totalUnique: uniqueBrokers.length,
    saved,
    skipped: skippedBrokers.length,
    skippedSamples: skippedBrokers.slice(0, 5),
    syncedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(await syncBrokers());
  } catch (error: any) {
    console.error("SYNC BROKERS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message ?? "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}