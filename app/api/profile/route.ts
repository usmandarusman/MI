
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams
      .get("code")
      ?.trim()
      .toUpperCase();

    if (!code) {
      return NextResponse.json(
        { error: "Parameter code wajib diisi" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ZAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ZAPI_API_KEY belum dikonfigurasi" },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      symbol: code,
    });

    const response = await fetch(
      `https://api.zpi.web.id/v1/finance:stockbit/profile?${params.toString()}`,
      {
        headers: {
          "x-api-key": apiKey,
        },
        next: { revalidate: 86400 },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "null",
          details: result,
        },
        { status: response.status }
      );
    }

    // Teruskan response Stockbit apa adanya.
    return NextResponse.json(result);
  } catch (error) {
    console.error("Stockbit profile API error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  }
}