import { getAuth } from "firebase-admin/auth";

export async function verifyFirebaseToken(
  request: Request
) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    throw new Error("Missing authorization header.");
  }

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Invalid authorization header.");
  }

  const idToken = authorization.substring(7).trim();

  if (!idToken) {
    throw new Error("Missing Firebase ID token.");
  }

  const decodedToken = await getAuth().verifyIdToken(idToken);

  return decodedToken;
}