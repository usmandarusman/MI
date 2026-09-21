/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.ZAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ZAPI_API_KEY belum diatur" },
        { status: 500 }
      );
    }

    const pageSize = 100;
    let start = 0;
    let recordsTotal = 0;

    const allSecurities: any[] = [];

    while (true) {
      const params = new URLSearchParams({
        length: String(pageSize),
        start: String(start),
      });

      const url =
        `https://api.zpi.web.id/v1/finance:idx/securities?${params}`;

      console.log("Fetching ZAPI:", url);

      const response = await fetch(url, {
        headers: {
          "x-api-key": apiKey,
        },
        cache: "no-store",
      });

      const text = await response.text();

      if (!response.ok) {
        console.error("ZAPI status:", response.status);
        console.error("ZAPI body:", text);

        return NextResponse.json(
          {
            error: "ZAPI request gagal",
            status: response.status,
            detail: text,
            start,
          },
          { status: 502 }
        );
      }

      const result = JSON.parse(text);

      if (!Array.isArray(result.data)) {
        console.error("Invalid ZAPI response:", result);

        return NextResponse.json(
          {
            error: "Data ZAPI bukan array",
            response: result,
          },
          { status: 502 }
        );
      }

      if (start === 0) {
        recordsTotal = result.recordsFiltered ?? result.recordsTotal ?? 0;
      }

      if (result.data.length === 0) break;

      allSecurities.push(...result.data);

      console.log(
        `Fetched: ${allSecurities.length}/${recordsTotal}`
      );

      start += result.data.length;

      if (
        result.data.length < pageSize ||
        (recordsTotal > 0 && start >= recordsTotal)
      ) {
        break;
      }
    }

    return NextResponse.json({
      provider: "idx",
      total: allSecurities.length,
      data: allSecurities,
    });
  } catch (error) {
    console.error("FULL SECURITIES ERROR:", error);

    return NextResponse.json(
      {
        error: "Terjadi kesalahan saat mengambil data emiten",
        detail:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}