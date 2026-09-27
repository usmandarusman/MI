import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AXENTRAZ_BASE_URL = "https://api.axentraz.id";
const ACCUMULATION_CONTROL_ID = "98";

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

    const token = process.env.AXENTRAZ_TOKEN;

    if (!token) {
      console.error("[AXENTRAZ] AXENTRAZ_TOKEN belum diset.");

      return NextResponse.json(
        {
          success: false,
          message: "AXENTRAZ_TOKEN belum dikonfigurasi di server.",
        },
        { status: 500 }
      );
    }

    const url =
      `${AXENTRAZ_BASE_URL}/broker-activity/` +
      `${encodeURIComponent(brokerId)}/symbols/` +
      `${ACCUMULATION_CONTROL_ID}/calendar` +
      `?from=${from}&to=${to}`;

    console.log("[AXENTRAZ] Request:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const rawText = await response.text();

    console.log("[AXENTRAZ] HTTP Status:", response.status);

    if (!response.ok) {
      console.error("[AXENTRAZ] Error response:", rawText);

      return NextResponse.json(
        {
          success: false,
          message: "Axentraz mengembalikan HTTP error.",
          status: response.status,
          statusText: response.statusText,
          raw: rawText,
        },
        { status: 502 }
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Response Axentraz bukan JSON.",
          raw: rawText,
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
        ((parsed as { data: { data?: unknown[] } }).data).data
      )
    ) {
      data = ((parsed as { data: { data: unknown[] } }).data).data;
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

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghubungi Axentraz.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 502 }
    );
  }
}