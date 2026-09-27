import { NextResponse } from "next/server";
import {
  getAxentrazAccumulation,
} from "@/lib/axentraz-accumulation";
import {
  ACCUMULATION_RATE_MIN,
} from "@/lib/accumulation";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const brokerIdParam =
      searchParams.get("brokerId");

    const from =
      searchParams.get("from");

    const to =
      searchParams.get("to");

    if (!brokerIdParam) {
      return NextResponse.json(
        {
          success: false,
          message:
            "brokerId wajib diisi.",
        },
        { status: 400 }
      );
    }

    const brokerId =
      Number(brokerIdParam);

    if (
      !Number.isInteger(brokerId) ||
      brokerId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "brokerId tidak valid.",
        },
        { status: 400 }
      );
    }

    if (
      !from ||
      !/^\d{8}$/.test(from)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Format from harus YYYYMMDD.",
        },
        { status: 400 }
      );
    }

    if (
      !to ||
      !/^\d{8}$/.test(to)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Format to harus YYYYMMDD.",
        },
        { status: 400 }
      );
    }

    const result =
      await getAxentrazAccumulation({
        brokerId,
        from,
        to,
      });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "[AXENTRAZ] Server error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Gagal mengambil data Axentraz.",

        error:
          error instanceof Error
            ? error.message
            : String(error),

        minimum_rate:
          ACCUMULATION_RATE_MIN,
      },
      { status: 502 }
    );
  }
}