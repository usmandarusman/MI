import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Default emiten
    const code = (
      searchParams.get("code") || "BBCA"
    ).toUpperCase();

    // Default: kemarin
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const formatDate = (date: Date) =>
      date.toISOString().split("T")[0];

    const defaultDate = formatDate(yesterday);

    const startDate =
      searchParams.get("startDate") || defaultDate;

    const endDate =
      searchParams.get("endDate") || defaultDate;

    const net = searchParams.get("net") || "true";

    const apiKey = process.env.ZAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ZAPI_API_KEY belum diset di env" },
        { status: 500 }
      );
    }

    // Validasi kode emiten
    if (!/^[A-Z0-9]{2,10}$/.test(code)) {
      return NextResponse.json(
        { error: "Kode emiten tidak valid" },
        { status: 400 }
      );
    }

    // Validasi format tanggal
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (
      !dateRegex.test(startDate) ||
      !dateRegex.test(endDate)
    ) {
      return NextResponse.json(
        {
          error: "Format tanggal harus YYYY-MM-DD",
        },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        {
          error: "startDate tidak boleh melebihi endDate",
        },
        { status: 400 }
      );
    }

    if (!["true", "false"].includes(net)) {
      return NextResponse.json(
        { error: "net harus true atau false" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      code,
      startDate,
      endDate,
      net,
    });

    const url =
      `https://api.zpi.web.id/v1/finance:pluang/broker-summary?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: response.status,
          error: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      requested: {
        code,
        startDate,
        endDate,
        net,
      },
      data,
    });
  } catch (error) {
    console.error("Broker Summary Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil broker summary",
      },
      { status: 500 }
    );
  }
}