"use client";

import { useState } from "react";
import {
  Bot,
  LockKeyhole,
  X,
} from "lucide-react";

import { useAuth } from "../../auth/AuthProvider";
import LoginRequired from "../../auth/LoginRequired";

/* =========================================================
   AUTO TRADE
========================================================= */

export default function AutoTrade() {
  /* =======================================================
     AUTH
  ======================================================= */

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    showLogin,
    setShowLogin,
  ] = useState(false);

  /* =======================================================
     COMING SOON
  ======================================================= */

  const [
    showComingSoon,
    setShowComingSoon,
  ] = useState(false);

  /* =======================================================
     SWITCH
  ======================================================= */

  const [
    isAutoTradeOn,
    setIsAutoTradeOn,
  ] = useState(false);

  /* =======================================================
     TOGGLE
  ======================================================= */

  const handleAutoTradeToggle = () => {
    if (authLoading) {
      return;
    }

    /*
     * Belum login.
     *
     * Login dulu sebelum fitur
     * bisa dicoba diaktifkan.
     */
    if (!user) {
      setShowLogin(true);
      return;
    }

    /*
     * Sudah login.
     *
     * Untuk sekarang fitur belum
     * tersedia.
     */
    setShowComingSoon(true);
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      {/* =================================================
          LOGIN MODAL
      ================================================= */}

      {showLogin && (
        <div
          className="
            fixed
            inset-0
            z-[10000]
            flex
            items-center
            justify-center
            bg-black/70
            p-4
            backdrop-blur-sm
          "
        >
          <LoginRequired
            onClose={() => {
              setShowLogin(false);
            }}
          />
        </div>
      )}

      {/* =================================================
          COMING SOON MODAL
      ================================================= */}

      {showComingSoon && (
        <div
          className="
            fixed
            inset-0
            z-[10000]
            flex
            items-center
            justify-center
            bg-black/70
            p-4
            backdrop-blur-sm
          "
        >
          <div
            className="
              w-full
              max-w-sm
              overflow-hidden
              rounded-2xl
              border
              border-zinc-200
              bg-white
              shadow-2xl
              dark:border-yellow-500/20
              dark:bg-zinc-900
            "
          >
            {/* HEADER */}

            <div
              className="
                flex
                items-start
                justify-between
                gap-4
                border-b
                border-zinc-200
                px-5
                py-4
                dark:border-zinc-800
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-yellow-500/10
                    text-yellow-500
                  "
                >
                  <Bot size={19} />
                </div>

                <div>
                  <h3
                    className="
                      text-sm
                      font-semibold
                      text-zinc-900
                      dark:text-white
                    "
                  >
                    Auto Trade
                  </h3>

                  <p
                    className="
                      mt-0.5
                      text-[10px]
                      text-zinc-500
                      dark:text-zinc-400
                    "
                  >
                    Coming Soon
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowComingSoon(false)
                }
                className="
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center
                  rounded-lg
                  text-zinc-400
                  transition-colors
                  hover:bg-zinc-100
                  hover:text-zinc-700
                  dark:hover:bg-zinc-800
                  dark:hover:text-zinc-200
                "
              >
                <X size={15} />
              </button>
            </div>

            {/* CONTENT */}

            <div className="px-5 py-5">
              <div
                className="
                  rounded-xl
                  border
                  border-yellow-500/15
                  bg-yellow-500/5
                  p-4
                "
              >
                <div
                  className="
                    flex
                    items-start
                    gap-3
                  "
                >
                  <div
                    className="
                      mt-0.5
                      flex
                      h-7
                      w-7
                      shrink-0
                      items-center
                      justify-center
                      rounded-lg
                      bg-yellow-500/10
                      text-yellow-500
                    "
                  >
                    <Bot size={14} />
                  </div>

                  <div>
                    <p
                      className="
                        text-sm
                        font-semibold
                        text-zinc-800
                        dark:text-zinc-100
                      "
                    >
                      Fitur Auto Trade
                    </p>

                    <p
                      className="
                        mt-1.5
                        text-xs
                        leading-relaxed
                        text-zinc-500
                        dark:text-zinc-400
                      "
                    >
                      Fitur ini sedang dalam
                      tahap pengembangan dan
                      belum tersedia untuk
                      digunakan.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}

            <div
              className="
                border-t
                border-zinc-200
                bg-zinc-50/70
                px-5
                py-4
                dark:border-zinc-800
                dark:bg-zinc-950/40
              "
            >
              <button
                type="button"
                onClick={() =>
                  setShowComingSoon(false)
                }
                className="
                  w-full
                  rounded-xl
                  bg-yellow-500
                  px-4
                  py-2.5
                  text-xs
                  font-bold
                  text-zinc-950
                  transition-all
                  hover:bg-yellow-400
                  active:scale-[0.985]
                "
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          AUTO TRADE CARD
      ================================================= */}

      <section
        className="
          relative
          z-20
          mt-5
          overflow-hidden
          rounded-2xl
          border
          border-zinc-200
          bg-white/90
          p-5
          shadow-xl
          backdrop-blur-xl
          dark:border-yellow-500/20
          dark:bg-zinc-900/90
          sm:p-6
        "
      >
        {/* =================================================
            DECORATIVE GLOW
        ================================================= */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            -right-16
            -top-16
            h-32
            w-32
            rounded-full
            bg-yellow-500/[0.06]
            blur-3xl
          "
        />

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="
            relative
            z-10
            flex
            items-center
            justify-between
            gap-4
          "
        >
          <div
            className="
              flex
              min-w-0
              items-center
              gap-3
            "
          >
            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-yellow-500/10
                text-yellow-500
              "
            >
              <Bot size={18} />
            </div>

            <div className="min-w-0">
              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                <h2
                  className="
                    text-base
                    font-semibold
                    text-zinc-900
                    dark:text-white
                  "
                >
                  Auto Trade
                </h2>

                <span
                  className="
                    rounded-full
                    bg-yellow-500/10
                    px-2
                    py-0.5
                    text-[8px]
                    font-bold
                    tracking-wide
                    text-yellow-500
                  "
                >
                  COMING SOON
                </span>
              </div>

              <p
                className="
                  mt-0.5
                  text-[11px]
                  text-zinc-500
                  dark:text-zinc-400
                "
              >
                Automatic order execution
              </p>
            </div>
          </div>

          {/* =================================================
              SWITCH
          ================================================= */}

          <div
            className="
              flex
              shrink-0
              flex-col
              items-end
              gap-1
            "
          >
            <button
              type="button"
              role="switch"
              aria-checked={
                isAutoTradeOn
              }
              aria-label="Toggle Auto Trade"
              disabled={
                authLoading
              }
              onClick={
                handleAutoTradeToggle
              }
              className="
                relative
                h-7
                w-12
                rounded-full
                bg-zinc-300
                transition-all
                duration-300
                dark:bg-zinc-700
              "
            >
              <span
                className="
                  absolute
                  left-1
                  top-1
                  h-5
                  w-5
                  rounded-full
                  bg-white
                  shadow-sm
                  transition-all
                  duration-300
                "
              />
            </button>

            <span
              className="
                text-[9px]
                font-semibold
                tracking-wider
                text-zinc-400
              "
            >
              OFF
            </span>
          </div>
        </div>

        {/* =================================================
            INFORMATION
        ================================================= */}

        <div
          className="
            relative
            z-10
            mt-5
            rounded-xl
            border
            border-yellow-500/15
            bg-yellow-500/5
            px-4
            py-4
          "
        >
          <div
            className="
              flex
              items-start
              gap-3
            "
          >
            <div
              className="
                mt-0.5
                flex
                h-7
                w-7
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-yellow-500/10
                text-yellow-500
              "
            >
              <LockKeyhole size={14} />
            </div>

            <div>
              <p
                className="
                  text-xs
                  font-semibold
                  text-yellow-500
                "
              >
                Auto Trade belum tersedia
              </p>

              <p
                className="
                  mt-1
                  text-[10px]
                  leading-relaxed
                  text-zinc-500
                  dark:text-zinc-400
                "
              >
                Fitur eksekusi order otomatis
                sedang dalam tahap
                pengembangan. Fitur akan
                tersedia setelah sistem
                siap digunakan.
              </p>
            </div>
          </div>
        </div>

        {/* =================================================
            CURRENT STATUS
        ================================================= */}

        <div
          className="
            relative
            z-10
            mt-3
            flex
            items-center
            gap-2
            rounded-lg
            border
            border-zinc-200
            bg-zinc-50
            px-3
            py-2.5
            dark:border-zinc-800
            dark:bg-zinc-950/40
          "
        >
          <span
            className="
              h-1.5
              w-1.5
              rounded-full
              bg-zinc-400
            "
          />

          <span
            className="
              text-[10px]
              text-zinc-500
              dark:text-zinc-400
            "
          >
            Auto Trade belum aktif
          </span>
        </div>
      </section>
    </>
  );
}