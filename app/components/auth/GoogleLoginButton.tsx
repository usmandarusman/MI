"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { signInWithGoogle } from "@/lib/auth";

type GoogleLoginButtonProps = {
  onSuccess?: () => void;
};

export default function GoogleLoginButton({
  onSuccess,
}: GoogleLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    try {
      setLoading(true);

      await signInWithGoogle();

      /*
       * Login Firebase berhasil.
       *
       * AuthProvider akan menangkap user melalui
       * onAuthStateChanged().
       *
       * Kita tidak melakukan save konfigurasi di sini.
       */
      onSuccess?.();
    } catch (error) {
      console.error(
        "[GoogleLoginButton] Google login error:",
        error
      );

      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      className="
        flex
        w-full
        items-center
        justify-center
        gap-3
        rounded-xl
        border
        border-white/10
        bg-white
        px-4
        py-3
        text-sm
        font-medium
        text-black
        transition
        hover:bg-white/90
        disabled:cursor-not-allowed
        disabled:opacity-60
      "
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z"
          />

          <path
            fill="#34A853"
            d="M12 21.7c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.7Z"
          />

          <path
            fill="#FBBC05"
            d="M6.54 13.78A5.86 5.86 0 0 1 6.23 12c0-.62.11-1.23.31-1.78V7.69H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.31l3.24-2.53Z"
          />

          <path
            fill="#EA4335"
            d="M12 6.19c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.27 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.91 9.46 6.19 12 6.19Z"
          />
        </svg>
      )}

      <span>
        {loading
          ? "Memproses login..."
          : "Continue with Google"}
      </span>
    </button>
  );
}