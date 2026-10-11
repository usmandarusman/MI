import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AXENTRAZ_BASE_URL = "https://api.axentraz.id";
const ACCUMULATION_CONTROL_ID = "98";

type AxentrazAuthDocument = {
  accessToken?: string | null;
};

async function getAxentrazToken(): Promise<string> {
  const snapshot = await db
    .collection("system_config")
    .doc("axentraz_auth")
    .get();

  if (!snapshot.exists) {
    throw new Error(
      "Dokumen system_config/axentraz_auth belum dibuat di Firestore."
    );
  }

  const data = snapshot.data() as AxentrazAuthDocument | undefined;
  const token =
    typeof data?.accessToken === "string"
      ? data.accessToken.trim()
      : "";

  if (!token) {
    throw new Error("Token Axentraz belum diisi di Firestore.");
  }

  return token;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const brokerId = searchParams.get("brokerId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!brokerId) {
      return NextResponse.json(
        {
          success: false,
          message: "brokerId wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!from || !/^\d{8}$/.test(from)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format from harus YYYYMMDD.",
        },
        { status: 400 }
      );
    }

    if (!to || !/^\d{8}$/.test(to)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format to harus YYYYMMDD.",
        },
        { status: 400 }
      );
    }

    // Token diambil dari Firestore, bukan dari environment variable.
    const token = await getAxentrazToken();

    const url =
      `${AXENTRAZ_BASE_URL}/broker-activity/` +
      `${encodeURIComponent(brokerId)}/symbols/` +
      `${ACCUMULATION_CONTROL_ID}/calendar` +
      `?from=${from}&to=${to}`;

    console.log("[AXENTRAZ] Request:", url);
    console.log("[AXENTRAZ] Auth source: FIRESTORE");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    console.log("[AXENTRAZ] HTTP Status:", response.status);

    if (!response.ok) {
      // Jangan kirim body mentah Axentraz ke client karena bisa
      // berisi detail internal atau informasi yang tidak semestinya.
      const rawText = await response.text();

      console.error("[AXENTRAZ] Upstream HTTP error:", {
        status: response.status,
        statusText: response.statusText,
        responseBody: rawText.slice(0, 1000),
      });

      return NextResponse.json(
        {
          success: false,
          message:
            response.status === 401 || response.status === 403
              ? "Token Axentraz tidak valid, kedaluwarsa, atau tidak memiliki izin. Perbarui token melalui Admin Console."
              : "Axentraz mengembalikan HTTP error.",
          status: response.status,
        },
        { status: 502 }
      );
    }

    const rawText = await response.text();

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[AXENTRAZ] Response bukan JSON.");

      return NextResponse.json(
        {
          success: false,
          message: "Response Axentraz bukan JSON.",
        },
        { status: 502 }
      );
    }

    let data: unknown[] = [];

    if (Array.isArray(parsed)) {
      data = parsed;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { data?: unknown }).data)
    ) {
      data = (parsed as { data: unknown[] }).data;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { data?: unknown }).data &&
      typeof (parsed as { data?: unknown }).data === "object" &&
      Array.isArray(
        (parsed as { data: { data?: unknown[] } }).data.data
      )
    ) {
      data = (parsed as { data: { data: unknown[] } }).data.data;
    }

    console.log("[AXENTRAZ] Parsed rows:", data.length);

    return NextResponse.json({
      success: true,
      broker_id: Number(brokerId),
      control_id: ACCUMULATION_CONTROL_ID,
      from,
      to,
      fetched: data.length,
      data,
    });
  } catch (error) {
    console.error("[AXENTRAZ] Server error:", error);

    const message =
      error instanceof Error ? error.message : String(error);

    const isTokenConfigError =
      message.includes("system_config/axentraz_auth") ||
      message.includes("Token Axentraz belum diisi");

    return NextResponse.json(
      {
        success: false,
        message: isTokenConfigError
          ? message
          : "Gagal menghubungi Axentraz. Periksa log server untuk detailnya.",
      },
      {
        status: isTokenConfigError ? 500 : 502,
      }
    );
  }
}
