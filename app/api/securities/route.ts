
import { NextRequest, NextResponse } from "next/server";

type Security = {
  Code: string;
  Name: string;
  Shares: number;
  ListingDate: string;
  ListingBoard: string;
};

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

    const apiKey = process.env.ZAPI_API_KEY_IDX;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ZAPI_API_KEY belum diatur" },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      length: "1000",
      start: "0",
      code,
    });

    const response = await fetch(
      `https://api.zpi.web.id/v1/finance:idx/securities?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
        next: { revalidate: 86400 },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("ZAPI error:", response.status, errorText);

      return NextResponse.json(
        { error: "Gagal mengambil data dari ZAPI" },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Pastikan data dari IDX berbentuk array
    const securities: Security[] = Array.isArray(result.data)
      ? result.data
      : [];

    // Cari emiten sesuai kode
    const company = securities.find(
      (item) => item.Code?.toUpperCase() === code
    );

    if (!company) {
      return NextResponse.json(
        {
          error: `Emiten ${code} tidak ditemukan`,
          provider: result.provider,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      provider: result.provider,
      code: company.Code,
      name: company.Name,
      shares: company.Shares,
      listingDate: company.ListingDate,
      listingBoard: company.ListingBoard,
    });
  } catch (error) {
    console.error("Securities API error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil data emiten" },
      { status: 500 }
    );
  }
}