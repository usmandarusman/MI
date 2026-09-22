
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const BATCH_SIZE = 450;
const MAX_RECORDS = 100_000;

const ZAPI_URL =
  "https://api.zpi.web.id/v1/finance:idx/securities";

type Security = {
  Code: string;
  Name?: string;
  ListingDate?: string;
  Shares?: number;
  ListingBoard?: string;
};

type ZapiResponse = {
  data?: {
    data?: unknown;
    recordsTotal?: number;
    recordsFiltered?: number;
  } | unknown[];
  recordsTotal?: number;
  recordsFiltered?: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Validasi secret: manual atau Vercel Cron
    const authHeader = req.headers.get("authorization");

    const syncSecret = process.env.SYNC_SECRET;
    const cronSecret = process.env.CRON_SECRET;

    const authorized =
      (!!syncSecret && authHeader === `Bearer ${syncSecret}`) ||
      (!!cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Validasi API key Zapi
    const apiKey = process.env.ZAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "ZAPI_API_KEY belum diatur",
        },
        { status: 500 }
      );
    }

    // 3. Fetch seluruh halaman dari Zapi
    let start = 0;
    let recordsTotal: number | null = null;

    const all: Security[] = [];

    while (recordsTotal === null || start < recordsTotal) {
      if (start >= MAX_RECORDS) {
        throw new Error("Pagination melewati batas aman");
      }

      const params = new URLSearchParams({
        length: String(PAGE_SIZE),
        start: String(start),
      });

      const response = await fetch(
        `${ZAPI_URL}?${params.toString()}`,
        {
          headers: {
            "x-api-key": apiKey,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        }
      );

      if (!response.ok) {
        throw new Error(
          `ZAPI error ${response.status} pada start=${start}`
        );
      }

      const result = (await response.json()) as ZapiResponse;

      // Bentuk respons: result.data.data
      // atau result.data berupa array
      const payload = result.data;

      const rows: unknown[] = Array.isArray(payload)
        ? payload
        : payload &&
            typeof payload === "object" &&
            Array.isArray(
              (payload as Record<string, unknown>).data
            )
          ? ((payload as Record<string, unknown>)
              .data as unknown[])
          : [];

      if (!Array.isArray(rows)) {
        throw new Error(
          `Format respons ZAPI tidak valid pada start=${start}`
        );
      }

      // Ambil total record dari halaman pertama
      if (recordsTotal === null) {
        const meta =
          payload && !Array.isArray(payload)
            ? (payload as Record<string, unknown>)
            : {};

        const total = Number(
          meta.recordsFiltered ??
            meta.recordsTotal ??
            result.recordsFiltered ??
            result.recordsTotal ??
            rows.length
        );

        if (!Number.isFinite(total) || total <= 0) {
          throw new Error(
            `recordsTotal ZAPI tidak valid: ${total}`
          );
        }

        recordsTotal = total;
      }

      if (rows.length === 0) {
        throw new Error(
          `Data ZAPI kosong sebelum pagination selesai (start=${start})`
        );
      }

      for (const row of rows) {
        if (!row || typeof row !== "object") continue;

        const item = row as Record<string, unknown>;
        const code = String(item.Code ?? "")
          .trim()
          .toUpperCase();

        if (!code) continue;

        all.push({
          Code: code,
          Name:
            typeof item.Name === "string"
              ? item.Name
              : undefined,
          ListingDate:
            typeof item.ListingDate === "string"
              ? item.ListingDate
              : undefined,
          Shares:
            typeof item.Shares === "number"
              ? item.Shares
              : undefined,
          ListingBoard:
            typeof item.ListingBoard === "string"
              ? item.ListingBoard
              : undefined,
        });
      }

      start += rows.length;

      if (start < recordsTotal && rows.length < PAGE_SIZE) {
        throw new Error(
          `Pagination tidak lengkap: ${start}/${recordsTotal}`
        );
      }
    }

    // 4. Deduplikasi berdasarkan kode emiten
    const unique = new Map<string, Security>();

    for (const item of all) {
      unique.set(item.Code, item);
    }

    const securities = [...unique.values()];

    if (securities.length === 0) {
      throw new Error("Tidak ada data emiten untuk disimpan");
    }

    // Jangan tulis database kalau fetch terindikasi tidak lengkap
    if (
      recordsTotal !== null &&
      all.length < recordsTotal
    ) {
      throw new Error(
        `Data tidak lengkap: fetched ${all.length}/${recordsTotal}`
      );
    }

    // 5. Simpan ke Firestore dalam batch
    let saved = 0;

    for (let i = 0; i < securities.length; i += BATCH_SIZE) {
      const chunk = securities.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const item of chunk) {
        const ref = db
          .collection("securities")
          .doc(item.Code);

        // Hilangkan field undefined
        const cleanItem = Object.fromEntries(
          Object.entries(item).filter(
            ([, value]) => value !== undefined
          )
        );

        batch.set(
          ref,
          {
            ...cleanItem,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
      saved += chunk.length;
    }

    // 6. Response sukses
    return NextResponse.json({
      success: true,
      message: "Sync securities berhasil",
      totalFetched: all.length,
      uniqueSecurities: securities.length,
      saved,
      collection: "securities",
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SYNC SECURITIES ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}