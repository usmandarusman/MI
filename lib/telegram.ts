const TELEGRAM_API =
  "https://api.telegram.org";

type TelegramParseMode =
  | "HTML"
  | "MarkdownV2";

function requireEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} belum dikonfigurasi.`
    );
  }

  return value;
}

export async function sendTelegramMessage(
  message: string,
  chatId: string,
  parseMode?: TelegramParseMode
) {
  const token =
    requireEnv(
      "TELEGRAM_BOT_TOKEN"
    );

  const target =
    chatId.trim();

  if (!target) {
    throw new Error(
      "Telegram destination_target belum dikonfigurasi."
    );
  }

  const response =
    await fetch(
      `${TELEGRAM_API}/bot${token}/sendMessage`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          chat_id: target,

          text: message,

          ...(parseMode
            ? {
                parse_mode:
                  parseMode,
              }
            : {}),

          disable_web_page_preview:
            true,
        }),

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      `Telegram error: ${JSON.stringify(
        data
      )}`
    );
  }

  return data;
}