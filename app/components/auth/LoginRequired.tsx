"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import GoogleLoginButton from "./GoogleLoginButton";
import { useAuth } from "../auth/AuthProvider";

type LoginRequiredProps = {
  onClose?: () => void;
};

export default function LoginRequired({
  onClose,
}: LoginRequiredProps) {
  const { user } = useAuth();

  /*
   * Setelah Firebase selesai login dan AuthProvider
   * menerima user, tutup modal otomatis.
   */
  useEffect(() => {
    if (user) {
      onClose?.();
    }
  }, [user, onClose]);

  return (
    <div
      className="
        relative
        w-full
        max-w-md
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-[#111111]
        p-6
        shadow-2xl
      "
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="
            absolute
            right-4
            top-4
            rounded-full
            p-2
            text-white/40
            transition
            hover:bg-white/5
            hover:text-white
          "
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div
        className="
          mx-auto
          mb-5
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          bg-white/5
        "
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#EA4335"
            d="M12 6.19c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.27 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.91 9.46 6.19 12 6.19Z"
          />

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
        </svg>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">
          Login diperlukan
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/50">
          Silakan login dengan akun Google untuk menggunakan
          Trade Plane.
        </p>
      </div>

      <div className="mt-6">
        <GoogleLoginButton />
      </div>
    </div>
  );
}