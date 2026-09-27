import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import { db } from "@/lib/firebase-admin";

import {
  getAxentrazAccumulation,
  type AxentrazResult,
} from "@/lib/axentraz-accumulation";

import {
  sendTelegramMessage,
} from "@/lib/telegram";

export const dynamic =
  "force-dynamic";

export const maxDuration = 60;

const SIGNAL_COLLECTION =
  "trade-signals";

const MIN_ACCUMULATION_RATE =
  20;

const TELEGRAM_MAX_LENGTH =
  3500;

const SENDING_TIMEOUT_MS =
  10 * 60 * 1000;

type DestinationType =
  | "telegram"
  | "whatsapp";

type TradePlaneConfig = {
  enabled: boolean;

  broker_code: string;

  broker_id: number;

  broker_name: string;

  destination_type:
    DestinationType;

  destination_target: string;
};

type TradePlaneDocument =
  TradePlaneConfig & {
    uid: string;
  };

type SignalStatus =
  | "sending"
  | "sent"
  | "failed";

type SignalDocument = {
  uid: string;

  symbol: string;

  brokerId: number;

  brokerCode: string;

  brokerName: string;

  accumulation: number;

  accumulationRate: number;

  lastClose: number;

  ma20: number;

  from: string;

  to: string;

  status: SignalStatus;

  createdAt:
    | FirebaseFirestore.FieldValue
    | Date;

  updatedAt:
    | FirebaseFirestore.FieldValue
    | Date;

  sentAt?:
    | FirebaseFirestore.FieldValue
    | Date;

  sentDestination?: string;

  error?: string;
};

/* =========================================================
   DATE
========================================================= */

function getJakartaDate(): string {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Jakarta",

        year: "numeric",

        month: "2-digit",

        day: "2-digit",
      }
    );

  return formatter
    .format(new Date())
    .replace(/-/g, "");
}

function formatDate(
  value: string
): string {
  if (
    !value ||
    !/^\d{8}$/.test(value)
  ) {
    return value;
  }

  return (
    `${value.slice(6, 8)}/` +
    `${value.slice(4, 6)}/` +
    `${value.slice(0, 4)}`
  );
}

/* =========================================================
   NUMBER
========================================================= */

function formatNumber(
  value: number,
  maximumFractionDigits = 2
): string {
  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits,
    }
  ).format(value);
}

function formatSignedPercent(
  value: number
): string {
  const absolute =
    Math.abs(value);

  const formatted =
    formatNumber(
      absolute
    );

  if (value > 0) {
    return `+${formatted}%`;
  }

  if (value < 0) {
    return `-${formatted}%`;
  }

  return "0%";
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
  value: string
): string {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    );
}

/* =========================================================
   SIGNAL HEADER
========================================================= */

function buildSignalHeader(
  config: TradePlaneConfig,
  from: string,
  to: string
): string {
  return (
    `🚨 TRADE SIGNAL\n\n` +

    `🏢 Broker Accumulator\n` +

    `${escapeHtml(
      config.broker_code
    )} — ` +

    `${escapeHtml(
      config.broker_name
    )}\n\n` +

    `📅 Periode\n` +

    `${formatDate(
      from
    )} — ` +

    `${formatDate(
      to
    )}\n\n` +

    `━━━━━━━━━━━━━━━━━━`
  );
}

/* =========================================================
   SIGNAL EMITEN
========================================================= */

function buildSignalBlock(
  row: AxentrazResult
): string {
  const symbol =
    escapeHtml(
      row.symbol
    );

  const stockbitUrl =
    `https://stockbit.com/#/symbol/` +
    `${encodeURIComponent(
      row.symbol
    )}`;

  return (
    `📌 <a href="${stockbitUrl}">${symbol}</a>\n\n` +

    `🔥 Accumulation: ` +

    `${formatSignedPercent(
      row.accumulation
    )}\n` +

    `⚡ Rate: ` +

    `${formatNumber(
      row.accumulation_rate
    )}%\n` +

    `📊 Price: ` +

    `${formatNumber(
      row.last_close
    )}\n\n` +

    `━━━━━━━━━━━━━━━━━━`
  );
}

/* =========================================================
   TELEGRAM CHUNK
========================================================= */

type SignalChunk = {
  rows: AxentrazResult[];

  message: string;
};

function buildSignalChunks(
  rows: AxentrazResult[],
  config: TradePlaneConfig,
  from: string,
  to: string
): SignalChunk[] {
  const header =
    buildSignalHeader(
      config,
      from,
      to
    );

  const chunks:
    SignalChunk[] = [];

  let currentRows:
    AxentrazResult[] = [];

  let currentMessage =
    header;

  for (
    const row of rows
  ) {
    const block =
      `\n\n` +
      buildSignalBlock(
        row
      );

    /*
     * Sisakan buffer supaya aman
     * dari limit Telegram.
     */

    if (
      currentMessage.length +
        block.length <=
      TELEGRAM_MAX_LENGTH
    ) {
      currentRows.push(
        row
      );

      currentMessage +=
        block;

      continue;
    }

    if (
      currentRows.length >
      0
    ) {
      chunks.push({
        rows:
          currentRows,

        message:
          currentMessage,
      });
    }

    currentRows = [
      row,
    ];

    currentMessage =
      header +
      `\n\n` +
      buildSignalBlock(
        row
      );
  }

  if (
    currentRows.length >
    0
  ) {
    chunks.push({
      rows:
        currentRows,

      message:
        currentMessage,
    });
  }

  return chunks;
}

/* =========================================================
   ENABLED TRADE PLANES
========================================================= */

async function getEnabledTradePlanes(): Promise<
  TradePlaneDocument[]
> {
  const snapshot =
    await db
      .collection(
        "trade-plane"
      )
      .where(
        "enabled",
        "==",
        true
      )
      .get();

  return snapshot.docs
    .map((doc) => {
      const data =
        doc.data() as Partial<TradePlaneConfig>;

      if (
        typeof data.broker_id !==
          "number" ||
        !Number.isInteger(
          data.broker_id
        ) ||
        data.broker_id <= 0
      ) {
        return null;
      }

      return {
        uid:
          doc.id,

        enabled:
          true,

        broker_code:
          typeof data.broker_code ===
          "string"
            ? data.broker_code
            : "",

        broker_id:
          data.broker_id,

        broker_name:
          typeof data.broker_name ===
          "string"
            ? data.broker_name
            : "",

        destination_type:
          data.destination_type ===
          "whatsapp"
            ? "whatsapp"
            : "telegram",

        destination_target:
          typeof data.destination_target ===
          "string"
            ? data.destination_target
            : "",
      };
    })
    .filter(
      (
        item
      ): item is TradePlaneDocument =>
        item !== null
    );
}

/* =========================================================
   CLAIM SIGNAL
========================================================= */

async function claimSignal(
  config: TradePlaneDocument,
  row: AxentrazResult,
  from: string,
  to: string
): Promise<boolean> {
  const signalId =
    `${config.uid}_` +
    `${config.broker_id}_` +
    `${row.symbol}_` +
    `${to}`;

  const ref =
    db
      .collection(
        SIGNAL_COLLECTION
      )
      .doc(signalId);

  return db.runTransaction(
    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          ref
        );

      if (
        snapshot.exists
      ) {
        const data =
          snapshot.data() as Partial<SignalDocument>;

        /*
         * Kalau sudah sent,
         * jangan kirim ulang.
         */

        if (
          data.status ===
          "sent"
        ) {
          return false;
        }

        /*
         * Kalau masih sending,
         * cegah duplicate send.
         */

        if (
          data.status ===
            "sending" &&
          data.updatedAt
        ) {
          const updatedAt =
            data.updatedAt instanceof
            Date
              ? data.updatedAt
              : null;

          if (
            updatedAt &&
            Date.now() -
              updatedAt.getTime() <
              SENDING_TIMEOUT_MS
          ) {
            return false;
          }
        }
      }

      const signalData:
        SignalDocument = {
        uid:
          config.uid,

        symbol:
          row.symbol,

        brokerId:
          config.broker_id,

        brokerCode:
          config.broker_code,

        brokerName:
          config.broker_name,

        accumulation:
          row.accumulation,

        accumulationRate:
          row.accumulation_rate,

        lastClose:
          row.last_close,

        ma20:
          row.ma20,

        from,

        to,

        status:
          "sending",

        createdAt:
          snapshot.exists
            ? (
                snapshot
                  .data()
                  ?.createdAt ??
                FieldValue.serverTimestamp()
              )
            : FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      };

      transaction.set(
        ref,
        signalData,
        {
          merge: true,
        }
      );

      return true;
    }
  );
}

/* =========================================================
   UPDATE SIGNAL STATUS
========================================================= */

async function updateSignalStatus(
  config: TradePlaneDocument,
  row: AxentrazResult,
  to: string,
  status: SignalStatus,
  extra: Record<
    string,
    unknown
  > = {}
) {
  const signalId =
    `${config.uid}_` +
    `${config.broker_id}_` +
    `${row.symbol}_` +
    `${to}`;

  await db
    .collection(
      SIGNAL_COLLECTION
    )
    .doc(signalId)
    .set(
      {
        status,

        updatedAt:
          FieldValue.serverTimestamp(),

        ...extra,
      },
      {
        merge: true,
      }
    );
}

/* =========================================================
   SEND DESTINATION
========================================================= */

async function sendToDestination(
  config: TradePlaneDocument,
  message: string
) {
  if (
    config.destination_type ===
    "telegram"
  ) {
    return sendTelegramMessage(
      message,

      config.destination_target,

      "HTML"
    );
  }

  throw new Error(
    "Destination WhatsApp belum memiliki sender/API."
  );
}

/* =========================================================
   PROCESS TRADE PLANE
========================================================= */

async function processTradePlane(
  config: TradePlaneDocument,
  from: string,
  to: string
) {
  console.log(
    "[TRADE PLANE] Processing:",
    {
      uid:
        config.uid,

      broker:
        config.broker_code,

      brokerId:
        config.broker_id,

      destination:
        config.destination_type,
    }
  );

  /* =====================================================
     AXENTRAZ
  ===================================================== */

  const result =
    await getAxentrazAccumulation({
      brokerId:
        config.broker_id,

      from,

      to,
    });

  /*
   * Signal:
   *
   * Rate >= 20%
   * MA20 valid
   * Price / Close < MA20
   *
   * MA20 tetap digunakan untuk FILTER,
   * tetapi tidak ditampilkan di Telegram.
   */

  const signals =
    result.data.filter(
      (row) =>
        row.accumulation_rate >=
          MIN_ACCUMULATION_RATE &&

        row.ma20 > 0 &&

        row.last_close <
          row.ma20
    );

  console.log(
    "[TRADE PLANE] Signals:",
    {
      uid:
        config.uid,

      broker:
        config.broker_code,

      qualified:
        result.data.length,

      signals:
        signals.length,
    }
  );

  /* =====================================================
     NO SIGNAL
  ===================================================== */

  if (
    signals.length ===
    0
  ) {
    return {
      uid:
        config.uid,

      broker_id:
        config.broker_id,

      broker_code:
        config.broker_code,

      broker_name:
        config.broker_name,

      destination_type:
        config.destination_type,

      from,

      to,

      qualified:
        result.data.length,

      signals:
        0,

      sent:
        0,

      symbols:
        [],
    };
  }

  /* =====================================================
     CLAIM SIGNAL
  ===================================================== */

  const newSignals:
    AxentrazResult[] = [];

  for (
    const row of signals
  ) {
    const claimed =
      await claimSignal(
        config,
        row,
        from,
        to
      );

    if (
      claimed
    ) {
      newSignals.push(
        row
      );
    }
  }

  /* =====================================================
     ALL ALREADY SENT
  ===================================================== */

  if (
    newSignals.length ===
    0
  ) {
    return {
      uid:
        config.uid,

      broker_id:
        config.broker_id,

      broker_code:
        config.broker_code,

      broker_name:
        config.broker_name,

      destination_type:
        config.destination_type,

      from,

      to,

      qualified:
        result.data.length,

      signals:
        signals.length,

      sent:
        0,

      symbols:
        [],

      message:
        "Semua signal sudah pernah dikirim.",
    };
  }

  /* =====================================================
     BUILD TELEGRAM CHUNKS
  ===================================================== */

  const chunks =
    buildSignalChunks(
      newSignals,
      config,
      from,
      to
    );

  console.log(
    "[TRADE PLANE] Message chunks:",
    {
      uid:
        config.uid,

      broker:
        config.broker_code,

      totalSignals:
        newSignals.length,

      chunks:
        chunks.length,
    }
  );

  let totalSent =
    0;

  const sentSymbols:
    string[] = [];

  /* =====================================================
     SEND CHUNKS
  ===================================================== */

  for (
    let index = 0;
    index < chunks.length;
    index++
  ) {
    const chunk =
      chunks[index];

    console.log(
      "[TRADE PLANE] Sending chunk:",
      {
        uid:
          config.uid,

        broker:
          config.broker_code,

        chunk:
          `${index + 1}/${chunks.length}`,

        symbols:
          chunk.rows.map(
            (
              row
            ) =>
              row.symbol
          ),

        length:
          chunk.message.length,
      }
    );

    try {
      await sendToDestination(
        config,
        chunk.message
      );

      /* ===============================================
         MARK SENT
      =============================================== */

      for (
        const row of chunk.rows
      ) {
        await updateSignalStatus(
          config,
          row,
          to,
          "sent",
          {
            sentAt:
              FieldValue.serverTimestamp(),

            sentDestination:
              config.destination_target,

            error:
              FieldValue.delete(),
          }
        );

        totalSent++;

        sentSymbols.push(
          row.symbol
        );
      }
    } catch (
      error
    ) {
      const errorMessage =
        error instanceof
        Error
          ? error.message
          : String(error);

      console.error(
        "[TRADE PLANE] Chunk failed:",
        {
          uid:
            config.uid,

          broker:
            config.broker_code,

          chunk:
            `${index + 1}/${chunks.length}`,

          error:
            errorMessage,
        }
      );

      /* ===============================================
         MARK FAILED
      =============================================== */

      for (
        const row of chunk.rows
      ) {
        await updateSignalStatus(
          config,
          row,
          to,
          "failed",
          {
            error:
              errorMessage,
          }
        );
      }

      /*
       * Stop chunk berikutnya.
       */

      break;
    }
  }

  /* =====================================================
     RESULT
  ===================================================== */

  return {
    uid:
      config.uid,

    broker_id:
      config.broker_id,

    broker_code:
      config.broker_code,

    broker_name:
      config.broker_name,

    destination_type:
      config.destination_type,

    from,

    to,

    qualified:
      result.data.length,

    signals:
      signals.length,

    new_signals:
      newSignals.length,

    chunks:
      chunks.length,

    sent:
      totalSent,

    symbols:
      sentSymbols,
  };
}

/* =========================================================
   CRON SECRET
========================================================= */

function getCronSecret(
  request: NextRequest
): string {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    authorization?.startsWith(
      "Bearer "
    )
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return (
    request.headers.get(
      "x-cron-secret"
    ) ?? ""
  ).trim();
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    /* =====================================================
       AUTH CRON
    ===================================================== */

    const cronSecret =
      process.env.CRON_SECRET;

    const requestSecret =
      getCronSecret(
        request
      );

    if (
      !cronSecret ||
      requestSecret !==
        cronSecret
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    /* =====================================================
       DATE
    ===================================================== */

    const today =
      getJakartaDate();

    const from =
      `${today.slice(0, 6)}01`;

    const to =
      today;

    /* =====================================================
       ENABLED USERS
    ===================================================== */

    const tradePlanes =
      await getEnabledTradePlanes();

    const results = [];

    let sent =
      0;

    /* =====================================================
       PROCESS ALL ENABLED TRADE PLANES
    ===================================================== */

    for (
      const config of tradePlanes
    ) {
      try {
        const result =
          await processTradePlane(
            config,
            from,
            to
          );

        results.push(
          result
        );

        sent +=
          result.sent;
      } catch (
        error
      ) {
        results.push({
          uid:
            config.uid,

          broker_id:
            config.broker_id,

          broker_code:
            config.broker_code,

          broker_name:
            config.broker_name,

          destination_type:
            config.destination_type,

          from,

          to,

          success:
            false,

          error:
            error instanceof
            Error
              ? error.message
              : String(error),
        });
      }
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success:
        true,

      message:
        "Trade Plane signal sync selesai.",

      from,

      to,

      enabled_users:
        tradePlanes.length,

      processed:
        results.length,

      sent,

      results,
    });
  } catch (
    error
  ) {
    console.error(
      "[TRADE PLANE] Sync error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}