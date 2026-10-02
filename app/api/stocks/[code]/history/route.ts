import { NextRequest, NextResponse } from "next/server";
import { getStockHistory } from "@/lib/stock-history";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      code: string;
    }>;
  }
) {
  try {
    const { code } = await context.params;

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "Kode saham wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const searchParams =
      request.nextUrl.searchParams;

    const startDate =
      searchParams.get("start") ??
      "20260820";

    const endDate =
      searchParams.get("end") ??
      undefined;

    const data = await getStockHistory(
      code,
      startDate,
      endDate
    );

    return NextResponse.json(
      {
        success: true,

        code: code
          .trim()
          .toUpperCase(),

        startDate,

        endDate:
          endDate ?? null,

        count: data.length,

        data,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "[GET /api/stocks/[code]/history]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil histori saham",
      },
      {
        status: 500,
      }
    );
  }
}