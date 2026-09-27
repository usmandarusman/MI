import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader =
      request.headers.get("authorization");

    const expectedSecret =
      process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        {
          success: false,
          message:
            "CRON_SECRET belum dikonfigurasi.",
        },
        { status: 500 }
      );
    }

    if (
      authHeader !==
      `Bearer ${expectedSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const chatId =
      searchParams.get("chatId");

    if (!chatId?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "chatId wajib diisi.",
        },
        { status: 400 }
      );
    }

    const message =
      [
        "🟡 Mann's Intelligence",
        "",
        "Telegram berhasil terhubung.",
        "",
        "Ini adalah pesan test dari server.",
        "Trade Plane siap dilanjutkan.",
      ].join("\n");

    const result =
      await sendTelegramMessage(
        message,
        chatId
      );

    return NextResponse.json({
      success: true,
      message:
        "Pesan Telegram berhasil dikirim.",
      telegram: result,
    });
  } catch (error) {
    console.error(
      "[TEST TELEGRAM] Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengirim pesan Telegram.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}