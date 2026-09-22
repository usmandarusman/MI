
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Ambil credentials dari environment variables
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

// Ubah karakter \n menjadi newline asli
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ?.replace(/\\n/g, "\n")
  .trim();

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    "Firebase Admin credentials belum lengkap. Cek FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, dan FIREBASE_PRIVATE_KEY."
  );
}

// Gunakan Firebase Admin app yang sudah ada,
// atau inisialisasi app baru
const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

// Export Firestore database
export const db = getFirestore(app);