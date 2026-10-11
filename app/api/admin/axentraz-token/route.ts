
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "system_config";
const DOCUMENT = "axentraz_auth";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

async function verifyAdmin(request: NextRequest) {
  const expectedEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    ?.trim()
    .toLowerCase();

  if (!expectedEmail) {
    throw new Error(
      "ADMIN_EMAIL belum dikonfigurasi di environment server."
    );
  }

  const authorization =
    request.headers.get("authorization") ?? "";

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) return null;

  try {
    const decoded = await getAuth().verifyIdToken(
      match[1],
      true
    );

    const email = decoded.email?.trim().toLowerCase();

    if (
      !email ||
      email !== expectedEmail ||
      decoded.email_verified !== true
    ) {
      return null;
    }

    return { email };
  } catch (error) {
    console.error(
      "[AXENTRAZ ADMIN] Firebase token verification failed:",
      error instanceof Error ? error.message : error
    );

    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);

    if (!admin) {
      return jsonError(
        "Akses ditolak. Periksa akun Google admin dan status verifikasi email.",
        403
      );
    }

    const snapshot = await db
      .collection(COLLECTION)
      .doc(DOCUMENT)
      .get();

    const data = snapshot.data();
    const updatedAt = data?.updatedAt?.toDate?.();

    return NextResponse.json(
      {
        success: true,
        configured:
          typeof data?.accessToken === "string" &&
          data.accessToken.trim().length > 0,
        updatedAt: updatedAt
          ? updatedAt.toISOString()
          : null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[AXENTRAZ ADMIN] GET failed:", error);

    return jsonError(
      "Gagal membaca Firestore. Periksa ADMIN_EMAIL dan konfigurasi Firebase Admin SDK.",
      500
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);

    if (!admin) {
      return jsonError(
        "Akses ditolak. Pastikan lu login menggunakan akun Google admin yang benar dan email sudah terverifikasi.",
        403
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Body request bukan JSON yang valid.",
        400
      );
    }

    const accessToken =
      body &&
      typeof body === "object" &&
      "accessToken" in body &&
      typeof body.accessToken === "string"
        ? body.accessToken.trim()
        : "";

    if (!accessToken) {
      return jsonError(
        "Token Axentraz wajib diisi.",
        400
      );
    }

    if (accessToken.length > 10000) {
      return jsonError("Token terlalu panjang.", 400);
    }

    // Pemeriksaan bentuk JWT, bukan verifikasi ke Axentraz.
    const parts = accessToken.split(".");

    if (
      parts.length !== 3 ||
      !parts.every((part) => part.length > 0)
    ) {
      return jsonError(
        "Format token tidak valid. Masukkan JWT saja tanpa awalan Bearer.",
        400
      );
    }

    await db
      .collection(COLLECTION)
      .doc(DOCUMENT)
      .set(
        {
          accessToken,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.email,
        },
        { merge: true }
      );

    console.info(
      "[AXENTRAZ ADMIN] Token saved successfully.",
      { updatedBy: admin.email }
    );

    return NextResponse.json({
      success: true,
      message: "Token Axentraz berhasil disimpan ke Firestore.",
    });
  } catch (error) {
    // Detail hanya masuk terminal/server log, tidak membocorkan token.
    console.error("[AXENTRAZ ADMIN] PUT failed:", error);

    return jsonError(
      "Penyimpanan gagal. Periksa terminal Next.js untuk detail error Firebase/Firestore.",
      500
    );
  }
}
