
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ZAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ZAPI_API_KEY belum dikonfigurasi" },
        { status: 500 }
      );
    }

    // IDX endpoint untuk ringkasan seluruh saham
    const path = "TradingSummary/GetStockSummary";

    // Ambil tanggal opsional dari query URL
    const requestedDate = request.nextUrl.searchParams.get("date");

    // IDX membaca tanggal YYYYMMDD
    const date = requestedDate
      ? requestedDate.replace(/-/g, "")
      : "";

    if (date && !/^\d{8}$/.test(date)) {
      return NextResponse.json(
        { error: "Format date harus YYYY-MM-DD atau YYYYMMDD" },
        { status: 400 }
      );
    }

    // Query diteruskan ke endpoint IDX
    const queryParams = new URLSearchParams({
      length: "5000",
      start: "0",
    });

    if (date) {
      queryParams.set("date", date);
    }

    const params = new URLSearchParams({
      path,
      query: queryParams.toString(),
    });

    const url =
      `https://api.zpi.web.id/v1/finance:idx/raw?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Gagal mengambil data IDX dari Zapi",
          details: result,
        },
        { status: response.status }
      );
    }

    // Respons Zapi bertingkat:
    // result.data.data = array emiten
    const payload = result?.data;
    const stocks = payload?.data;

    if (!Array.isArray(stocks)) {
      return NextResponse.json(
        {
          error: "Format respons Zapi tidak sesuai",
          details: result,
        },
        { status: 502 }
      );
    }

    const recordsTotal = payload.recordsTotal ?? 0;
    const recordsFiltered = payload.recordsFiltered ?? 0;

    return NextResponse.json({
      success: true,
      dataset: "stock-summary",
      provider: "idx",
      date: stocks[0]?.Date ?? null,
      count: stocks.length,
      recordsTotal,
      recordsFiltered,
      isComplete:
        stocks.length >= recordsFiltered,
      data: stocks,
    });
  } catch (error) {
    console.error("IDX Stock Summary API error:", error);

    return NextResponse.json(
      {
        error: "Terjadi kesalahan saat mengambil data IDX",
      },
      { status: 500 }
    );
  }
}