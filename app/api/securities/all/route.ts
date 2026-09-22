
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    let recordsTotal = Infinity;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSecurities: any[] = [];

    while (start < recordsTotal) {
      const params = new URLSearchParams({
        length: String(pageSize),
        start: String(start),
      });

      const url =
        `https://api.zpi.web.id/v1/finance:idx/securities?${params}`;

      const response = await fetch(url, {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`ZAPI error: ${response.status}`);
      }

      const result = await response.json();

      // Dukung respons berbentuk result.data.data
      // maupun result.data yang langsung berupa array.
      const payload = result.data;
      const rows = Array.isArray(payload)
        ? payload
        : payload?.data;

      if (!Array.isArray(rows)) {
        return NextResponse.json(
          {
            error: "Data ZAPI bukan array",
            response: result,
          },
          { status: 502 }
        );
      }

      if (start === 0) {
        recordsTotal = Number(
          (Array.isArray(payload) ? result : payload)
            ?.recordsFiltered ??
          (Array.isArray(payload) ? result : payload)
            ?.recordsTotal ??
          rows.length
        );
      }

      if (rows.length === 0) break;

      allSecurities.push(...rows);
      start += rows.length;

      if (start >= recordsTotal || rows.length < pageSize) {
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
        error: "Gagal mengambil data emiten",
        detail: error instanceof Error
          ? error.message
          : String(error),
      },
      { status: 500 }
    );
  }
}