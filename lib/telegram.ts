
const TELEGRAM_API = "https://api.telegram.org";

type TelegramParseMode = "HTML" | "MarkdownV2";

type TelegramResponse = {
  ok: boolean;
  result?: unknown;
  error_code?: number;
  description?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} belum dikonfigurasi.`);
  }

  return value;
}

export async function sendTelegramMessage(
  message: string,
  chatId: string,
  parseMode?: TelegramParseMode
) {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const target = chatId.trim();

  if (!target) {
    throw new Error(
      "Telegram destination_target belum dikonfigurasi."
    );
  }

  if (!message.trim()) {
    throw new Error("Pesan Telegram tidak boleh kosong.");
  }

  // Jangan pernah mencetak token bot ke log.
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: target,
        text: message,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : String(error);

    throw new Error(
      `Gagal terhubung ke Telegram API: ${reason}`
    );
  }

  const responseText = await response.text();

  let data: TelegramResponse;

  try {
    data = JSON.parse(responseText) as TelegramResponse;
  } catch {
    throw new Error(
      `Respons Telegram bukan JSON. HTTP ${response.status}. ` +
        `Respons: ${responseText.slice(0, 300)}`
    );
  }

  if (!response.ok || data.ok !== true) {
    const errorCode = data.error_code ?? response.status;
    const description =
      data.description ?? "Telegram tidak memberikan detail error.";

    throw new Error(
      `Telegram API gagal. HTTP ${response.status}, ` +
        `kode ${errorCode}: ${description}`
    );
  }

  return data;
}
