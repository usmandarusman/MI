"use client";

import {
  Bot,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import AutoTrade from "../components/fragments/trade-plane/AutoTrade";
import TradePlane from "../components/fragments/trade-plane/TradePlane";

export default function TradePlanePage() {
  /* =====================================================
     SMOOTH SCROLL
  ===================================================== */

  const scrollToSection = (
    id: "signal" | "auto-trade"
  ) => {
    const element =
      document.getElementById(id);

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main
      className="
        relative
        min-h-screen
        overflow-hidden
        scroll-smooth
      "
    >
      {/* =====================================================
          AMBIENT BACKGROUND
      ===================================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          -z-10
          overflow-hidden
        "
      >
        {/* Top glow */}
        <div
          className="
            absolute
            left-1/2
            top-[-180px]
            h-[420px]
            w-[700px]
            -translate-x-1/2
            rounded-full
            bg-yellow-500/[0.07]
            blur-[120px]
          "
        />

        {/* Left glow */}
        <div
          className="
            absolute
            left-[-180px]
            top-[35%]
            h-[300px]
            w-[300px]
            rounded-full
            bg-amber-500/[0.035]
            blur-[100px]
          "
        />

        {/* Right glow */}
        <div
          className="
            absolute
            right-[-180px]
            top-[55%]
            h-[320px]
            w-[320px]
            rounded-full
            bg-yellow-400/[0.025]
            blur-[110px]
          "
        />

        {/* Futuristic grid */}
        <div
          className="
            absolute
            inset-0
            opacity-[0.025]
            dark:opacity-[0.035]
          "
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(234,179,8,0.35) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(234,179,8,0.35) 1px,
                transparent 1px
              )
            `,
            backgroundSize:
              "44px 44px",
          }}
        />

        {/* Top fade */}
        <div
          className="
            absolute
            inset-x-0
            top-0
            h-40
            bg-gradient-to-b
            from-white
            to-transparent
            dark:from-zinc-950
            dark:to-transparent
          "
        />
      </div>

      {/* =====================================================
          PAGE CONTAINER
      ===================================================== */}

      <div
        className="
          relative
          mx-auto
          w-full
          max-w-2xl
          px-4
          pb-10
          pt-5
          sm:px-6
          sm:pt-7
        "
      >
        {/* ===================================================
            PAGE HEADER
        =================================================== */}

        <header className="mb-5">
          {/* Top line */}
          <div className="mb-3 flex items-center justify-between">
            <div
              className="
                flex
                items-center
                gap-2
                text-[9px]
                font-bold
                uppercase
                tracking-[0.2em]
                text-yellow-500
              "
            >
              <span
                className="
                  relative
                  flex
                  h-2
                  w-2
                  items-center
                  justify-center
                "
              >
                <span
                  className="
                    absolute
                    h-2
                    w-2
                    animate-ping
                    rounded-full
                    bg-yellow-500/50
                  "
                />

                <span
                  className="
                    relative
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-yellow-500
                  "
                />
              </span>

              Trading Intelligence
            </div>

            <div
              className="
                flex
                items-center
                gap-1.5
                rounded-full
                border
                border-zinc-200
                bg-white/70
                px-2.5
                py-1
                text-[9px]
                font-medium
                text-zinc-500
                backdrop-blur-md
                dark:border-zinc-800
                dark:bg-zinc-900/60
                dark:text-zinc-400
              "
            >
              <ShieldCheck
                size={11}
                className="text-green-500"
              />

              Secure
            </div>
          </div>

          {/* Title */}
          <div
            className="
              relative
              overflow-hidden
              rounded-2xl
              border
              border-zinc-200
              bg-white/75
              p-5
              shadow-[0_15px_50px_rgba(0,0,0,0.05)]
              backdrop-blur-xl
              dark:border-yellow-500/10
              dark:bg-zinc-900/65
              dark:shadow-[0_15px_50px_rgba(0,0,0,0.25)]
            "
          >
            {/* Decorative glow */}
            <div
              className="
                pointer-events-none
                absolute
                -right-16
                -top-16
                h-40
                w-40
                rounded-full
                bg-yellow-500/[0.08]
                blur-3xl
              "
            />

            <div className="relative">
              <div className="flex items-center gap-2">
                <h1
                  className="
                    text-xl
                    font-bold
                    tracking-tight
                    text-zinc-900
                    dark:text-white
                    sm:text-2xl
                  "
                >
                  Trade Plane
                </h1>

                <Sparkles
                  size={15}
                  className="
                    text-yellow-500
                    opacity-80
                  "
                />
              </div>

              <p
                className="
                  mt-1.5
                  max-w-lg
                  text-xs
                  leading-relaxed
                  text-zinc-500
                  dark:text-zinc-400
                  sm:text-sm
                "
              >
                Bangun trading plane kamu
                dengan fitur canggih dari{" "}
                {`Mann's Intelligence.`}
              </p>

              {/* =================================================
                  FEATURE NAVIGATION
              ================================================= */}

              <div
                className="
                  mt-4
                  flex
                  flex-wrap
                  gap-2
                "
              >
                {/* =================================================
                    SIGNAL BUTTON
                ================================================= */}

                <button
                  type="button"
                  onClick={() =>
                    scrollToSection("signal")
                  }
                  className="
                    group
                    flex
                    items-center
                    gap-1.5
                    rounded-full
                    border
                    border-zinc-200
                    bg-zinc-50/80
                    px-2.5
                    py-1.5
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    hover:border-yellow-500/40
                    hover:bg-yellow-500/10
                    hover:shadow-[0_0_20px_rgba(234,179,8,0.08)]
                    active:scale-95
                    dark:border-zinc-800
                    dark:bg-zinc-950/50
                    dark:hover:border-yellow-500/30
                  "
                >
                  <Radio
                    size={11}
                    className="
                      text-yellow-500
                      transition-transform
                      duration-200
                      group-hover:scale-110
                    "
                  />

                  <span
                    className="
                      text-[9px]
                      font-medium
                      text-zinc-500
                      transition-colors
                      group-hover:text-yellow-500
                      dark:text-zinc-400
                    "
                  >
                    Signal
                  </span>
                </button>

                {/* =================================================
                    AUTO TRADE BUTTON
                ================================================= */}

                <button
                  type="button"
                  onClick={() =>
                    scrollToSection("auto-trade")
                  }
                  className="
                    group
                    flex
                    items-center
                    gap-1.5
                    rounded-full
                    border
                    border-zinc-200
                    bg-zinc-50/80
                    px-2.5
                    py-1.5
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    hover:border-yellow-500/40
                    hover:bg-yellow-500/10
                    hover:shadow-[0_0_20px_rgba(234,179,8,0.08)]
                    active:scale-95
                    dark:border-zinc-800
                    dark:bg-zinc-950/50
                    dark:hover:border-yellow-500/30
                  "
                >
                  <Bot
                    size={11}
                    className="
                      text-yellow-500
                      transition-transform
                      duration-200
                      group-hover:scale-110
                    "
                  />

                  <span
                    className="
                      text-[9px]
                      font-medium
                      text-zinc-500
                      transition-colors
                      group-hover:text-yellow-500
                      dark:text-zinc-400
                    "
                  >
                    Auto Trade
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ===================================================
            SIGNAL SECTION
        =================================================== */}

        <section
          id="signal"
          className="
            min-h-screen
            scroll-mt-4
          "
        >
          {/* SIGNAL SECTION LABEL */}

          <div
            className="
              mb-[-1px]
              flex
              items-center
              gap-2
              px-1
            "
          >
            <div
              className="
                flex
                h-6
                w-6
                items-center
                justify-center
                rounded-lg
                bg-yellow-500/10
                text-yellow-500
              "
            >
              <Radio size={13} />
            </div>

            <span
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.16em]
                text-zinc-400
              "
            >
              Signal Engine
            </span>

            <div
              className="
                h-px
                flex-1
                bg-gradient-to-r
                from-yellow-500/20
                to-transparent
              "
            />
          </div>

          {/* SIGNAL */}

          <TradePlane />
        </section>

        {/* ===================================================
            AUTO TRADE SECTION
        =================================================== */}

        <section
          id="auto-trade"
          className="
            mt-7
            min-h-screen
            scroll-mt-4
          "
        >
          {/* AUTO TRADE SECTION LABEL */}

          <div
            className="
              flex
              items-center
              gap-2
              px-1
            "
          >
            <div
              className="
                flex
                h-6
                w-6
                items-center
                justify-center
                rounded-lg
                bg-yellow-500/10
                text-yellow-500
              "
            >
              <Bot size={13} />
            </div>

            <span
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.16em]
                text-zinc-400
              "
            >
              Execution Engine
            </span>

            <div
              className="
                h-px
                flex-1
                bg-gradient-to-r
                from-yellow-500/20
                to-transparent
              "
            />
          </div>

          {/* AUTO TRADE */}

          <AutoTrade />
        </section>

        {/* ===================================================
            FOOTER STATUS
        =================================================== */}

        <div
          className="
            mt-5
            flex
            items-center
            justify-center
            gap-2
            px-2
            text-center
          "
        >
          <span
            className="
              h-1
              w-1
              rounded-full
              bg-green-500
            "
          />

          <span
            className="
              text-[9px]
              text-zinc-400
            "
          >
            Mann&apos;s Intelligence
            Trading Infrastructure
          </span>

          <span
            className="
              h-1
              w-1
              rounded-full
              bg-zinc-700
            "
          />
        </div>
      </div>
    </main>
  );
}