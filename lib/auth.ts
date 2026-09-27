"use client";

import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

export async function signInWithGoogle() {
  const result = await signInWithPopup(
    auth,
    googleProvider
  );

  /*
   * Firebase langsung memasukkan user ke auth.currentUser.
   * onAuthStateChanged di AuthProvider akan menangkap
   * perubahan ini.
   */
  return result.user;
}