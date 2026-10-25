
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { db } from "@/lib/firebase-admin";

type DestinationType = "telegram";
type AccumulationPeriod = "1w" | "mtd" | "1m" | "2m" | "3m";
type TradingSetup = "fishing-bottom" | "retracement";

type TradePlaneConfig = {
  enabled: boolean;
  broker_code: string;
  broker_id: number | null;
  broker_name: string;
  destination_type: DestinationType;
  destination_target: string;
  accumulation_period: AccumulationPeriod;
  setup: TradingSetup;
  updatedAt?: Date;
};

const DEFAULT_ACCUMULATION_PERIOD: AccumulationPeriod = "mtd";
const DEFAULT_SETUP: TradingSetup = "fishing-bottom";
const COLLECTION = "trade-plane";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeAccumulationPeriod(
  value: unknown,
): AccumulationPeriod {
  switch (value) {
    case "1w":
    case "mtd":
    case "1m":
    case "2m":
    case "3m":
      return value;
    default:
      return DEFAULT_ACCUMULATION_PERIOD;
  }
}

function normalizeSetup(value: unknown): TradingSetup {
  switch (value) {
    case "retracement":
      return "retracement";
    case "fishing-bottom":
    default:
      return DEFAULT_SETUP;
  }
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeConfig(
  data?: Record<string, unknown>,
): Omit<TradePlaneConfig, "updatedAt"> {
  return {
    enabled: data?.enabled === true,

    broker_code: normalizeString(data?.broker_code).toUpperCase(),

    broker_id:
      typeof data?.broker_id === "number" &&
      Number.isInteger(data.broker_id)
        ? data.broker_id
        : null,

    broker_name: normalizeString(data?.broker_name),

    destination_type: "telegram",

    destination_target: normalizeString(data?.destination_target),

    accumulation_period: normalizeAccumulationPeriod(
      data?.accumulation_period,
    ),

    setup: normalizeSetup(data?.setup),
  };
}

function getToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

async function authenticate(request: NextRequest) {
  const token = getToken(request);

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  return getAuth().verifyIdToken(token);
}

function handleError(error: unknown, method: string) {
  console.error(`${method} /api/trade-plane error:`, error);

  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return jsonError("Unauthorized. Silakan login kembali.", 401);
  }

  return jsonError("Terjadi kesalahan pada konfigurasi Signal.", 500);
}

/* =========================================================
   GET: MEMBACA KONFIGURASI USER
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    const snapshot = await db
      .collection(COLLECTION)
      .doc(user.uid)
      .get();

    if (!snapshot.exists) {
      return NextResponse.json({
        exists: false,
        config: normalizeConfig(),
      });
    }

    return NextResponse.json({
      exists: true,
      config: normalizeConfig(
        snapshot.data() as Record<string, unknown>,
      ),
    });
  } catch (error) {
    return handleError(error, "GET");
  }
}

/* =========================================================
   PUT: MENYIMPAN / MEMATIKAN SIGNAL
========================================================= */

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const documentRef = db.collection(COLLECTION).doc(user.uid);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Format JSON tidak valid.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Payload tidak valid.", 400);
    }

    const input = body as Record<string, unknown>;
    const snapshot = await documentRef.get();
    const existing = snapshot.exists
      ? (snapshot.data() as Record<string, unknown>)
      : {};

    /* OFF: pertahankan seluruh konfigurasi terakhir. */
    if (input.enabled === false) {
      if (!snapshot.exists) {
        const config = normalizeConfig();

        await documentRef.set({
          ...config,
          updatedAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          config,
        });
      }

      const config = {
        ...normalizeConfig(existing),
        enabled: false,
      };

      await documentRef.set(
        {
          enabled: false,
          accumulation_period: config.accumulation_period,
          setup: config.setup,
          updatedAt: new Date(),
        },
        { merge: true },
      );

      return NextResponse.json({
        success: true,
        config,
      });
    }

    /* ON: validasi seluruh konfigurasi yang diperlukan. */
    if (input.enabled !== true) {
      return jsonError("Status Signal tidak valid.", 400);
    }

    const brokerCode = normalizeString(input.broker_code).toUpperCase();
    const brokerId =
      typeof input.broker_id === "number" &&
      Number.isInteger(input.broker_id) &&
      input.broker_id > 0
        ? input.broker_id
        : null;
    const brokerName = normalizeString(input.broker_name);
    const destinationTarget = normalizeString(input.destination_target);
    const accumulationPeriod = normalizeAccumulationPeriod(
      input.accumulation_period,
    );
    const setup = normalizeSetup(input.setup);

    if (!/^[A-Z0-9]{2,5}$/.test(brokerCode)) {
      return jsonError("Kode broker tidak valid.", 400);
    }

    if (brokerId === null) {
      return jsonError("Broker ID tidak valid.", 400);
    }

    if (!brokerName) {
      return jsonError("Nama broker wajib diisi.", 400);
    }

    if (!destinationTarget) {
      return jsonError("Telegram Chat ID wajib diisi.", 400);
    }

    const config: Omit<TradePlaneConfig, "updatedAt"> = {
      enabled: true,
      broker_code: brokerCode,
      broker_id: brokerId,
      broker_name: brokerName,
      destination_type: "telegram",
      destination_target: destinationTarget,
      accumulation_period: accumulationPeriod,
      setup,
    };

    await documentRef.set({
      ...config,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    return handleError(error, "PUT");
  }
}
