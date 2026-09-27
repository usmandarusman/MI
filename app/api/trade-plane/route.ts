import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { db } from "@/lib/firebase-admin";

type DestinationType = "telegram" | "whatsapp";

type TradePlaneConfig = {
  enabled: boolean;
  broker_code: string;
  broker_id: number | null;
  broker_name: string;
  destination_type: DestinationType;
  destination_target: string;
  updatedAt: Date;
};

function getToken(request: NextRequest) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization
    .slice(7)
    .trim();

  return token || null;
}

async function authenticate(
  request: NextRequest
) {
  const token = getToken(request);

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const decoded =
    await getAuth().verifyIdToken(token);

  return decoded;
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const user =
      await authenticate(request);

    const uid = user.uid;

    const snapshot =
      await db
        .collection("trade-plane")
        .doc(uid)
        .get();

    if (!snapshot.exists) {
      return NextResponse.json({
        exists: false,

        config: {
          enabled: false,
          broker_code: "",
          broker_id: null,
          broker_name: "",
          destination_type: "telegram",
          destination_target: "",
        },
      });
    }

    const data =
      snapshot.data();

    return NextResponse.json({
      exists: true,

      config: {
        enabled:
          data?.enabled === true,

        broker_code:
          typeof data?.broker_code ===
          "string"
            ? data.broker_code
            : "",

        broker_id:
          typeof data?.broker_id ===
          "number"
            ? data.broker_id
            : null,

        broker_name:
          typeof data?.broker_name ===
          "string"
            ? data.broker_name
            : "",

        destination_type:
          data?.destination_type ===
          "whatsapp"
            ? "whatsapp"
            : "telegram",

        destination_target:
          typeof data?.destination_target ===
          "string"
            ? data.destination_target
            : "",
      },
    });
  } catch (error) {
    console.error(
      "GET /api/trade-plane error:",
      error
    );

    if (
      error instanceof Error &&
      error.message ===
        "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Gagal mengambil konfigurasi Trade Plane.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   PUT
========================================================= */

export async function PUT(
  request: NextRequest
) {
  try {
    const user =
      await authenticate(request);

    const uid = user.uid;

    const body =
      await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Payload tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    const enabled =
      body.enabled === true;

    const destinationType: DestinationType =
      body.destination_type ===
      "whatsapp"
        ? "whatsapp"
        : "telegram";

    /* =====================================================
       OFF

       Hanya ubah enabled.
       Konfigurasi terakhir tetap disimpan.
    ===================================================== */

    if (!enabled) {
      const snapshot =
        await db
          .collection("trade-plane")
          .doc(uid)
          .get();

      if (!snapshot.exists) {
        const config: TradePlaneConfig = {
          enabled: false,
          broker_code: "",
          broker_id: null,
          broker_name: "",
          destination_type:
            destinationType,
          destination_target: "",
          updatedAt: new Date(),
        };

        await db
          .collection("trade-plane")
          .doc(uid)
          .set(config);

        return NextResponse.json({
          success: true,

          config: {
            enabled: false,
            broker_code: "",
            broker_id: null,
            broker_name: "",
            destination_type:
              destinationType,
            destination_target: "",
          },
        });
      }

      const existing =
        snapshot.data();

      await db
        .collection("trade-plane")
        .doc(uid)
        .set(
          {
            enabled: false,
            updatedAt:
              new Date(),
          },
          {
            merge: true,
          }
        );

      return NextResponse.json({
        success: true,

        config: {
          enabled: false,

          broker_code:
            typeof existing?.broker_code ===
            "string"
              ? existing.broker_code
              : "",

          broker_id:
            typeof existing?.broker_id ===
            "number"
              ? existing.broker_id
              : null,

          broker_name:
            typeof existing?.broker_name ===
            "string"
              ? existing.broker_name
              : "",

          destination_type:
            existing?.destination_type ===
            "whatsapp"
              ? "whatsapp"
              : "telegram",

          destination_target:
            typeof existing?.destination_target ===
            "string"
              ? existing.destination_target
              : "",
        },
      });
    }

    /* =====================================================
       ON
    ===================================================== */

    const brokerCode =
      typeof body.broker_code ===
      "string"
        ? body.broker_code
            .trim()
            .toUpperCase()
        : "";

    const brokerId =
      typeof body.broker_id ===
        "number" &&
      Number.isInteger(
        body.broker_id
      ) &&
      body.broker_id > 0
        ? body.broker_id
        : null;

    const brokerName =
      typeof body.broker_name ===
      "string"
        ? body.broker_name.trim()
        : "";

    const destinationTarget =
      typeof body.destination_target ===
      "string"
        ? body.destination_target.trim()
        : "";

    if (
      !/^[A-Z]{2}$/.test(
        brokerCode
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Kode broker tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    if (!brokerId) {
      return NextResponse.json(
        {
          error:
            "Broker ID tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    if (!brokerName) {
      return NextResponse.json(
        {
          error:
            "Nama broker wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (!destinationTarget) {
      return NextResponse.json(
        {
          error:
            "Target tujuan wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    const config: TradePlaneConfig = {
      enabled: true,

      broker_code:
        brokerCode,

      broker_id:
        brokerId,

      broker_name:
        brokerName,

      destination_type:
        destinationType,

      destination_target:
        destinationTarget,

      updatedAt:
        new Date(),
    };

    await db
      .collection("trade-plane")
      .doc(uid)
      .set(
        config,
        {
          merge: true,
        }
      );

    return NextResponse.json({
      success: true,

      config: {
        enabled: true,
        broker_code:
          brokerCode,
        broker_id:
          brokerId,
        broker_name:
          brokerName,
        destination_type:
          destinationType,
        destination_target:
          destinationTarget,
      },
    });
  } catch (error) {
    console.error(
      "PUT /api/trade-plane error:",
      error
    );

    if (
      error instanceof Error &&
      error.message ===
        "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Gagal menyimpan konfigurasi Trade Plane.",
      },
      {
        status: 500,
      }
    );
  }
}