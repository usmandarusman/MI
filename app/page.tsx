"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Crosshair,
  Radio,
  ScanLine,
} from "lucide-react";

import { InfiniteMarqueeSlider } from "./components/fungsi/infiniteSlider";

const links = [
  {
    id: 1,
    title: "Broker Accumulation",
    description:
      "Monitor aktivitas transaksi broker secara terstruktur.",
    url: "/broker-accumulation",
  },
  {
    id: 2,
    title: "Broker Movement",
    description:
      "Monitor pergerakan broker secara terstruktur.",
    url: "https://axentraz.id/broker-activity",
  },
  {
    id: 3,
    title: "Trade Plane",
    description:
      "Bangun trading plane kamu dengan fitur canggih dari Mann's Intelligence.",
    url: "/trade-plane",
  },
];

export default function Home() {
  return (
    <div
      className="
        relative
        min-h-full
        w-full
        overflow-hidden
        bg-[#fafafa]
        px-4
        py-7
        dark:bg-[#050505]
        sm:px-6
        sm:py-10
      "
    >
      {/* =====================================================
          BACKGROUND ATMOSPHERE
      ===================================================== */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="
            absolute
            left-1/2
            top-[-180px]
            h-[520px]
            w-[520px]
            -translate-x-1/2
            rounded-full
            bg-yellow-400/[0.045]
            blur-[130px]
            dark:bg-yellow-400/[0.055]
          "
        />

        <div
          className="
            absolute
            left-[8%]
            top-[40%]
            h-40
            w-40
            rounded-full
            bg-yellow-300/[0.025]
            blur-[100px]
            dark:bg-yellow-400/[0.02]
          "
        />

        <div
          className="
            absolute
            right-[5%]
            bottom-[15%]
            h-44
            w-44
            rounded-full
            bg-yellow-500/[0.02]
            blur-[100px]
          "
        />

        {/* subtle grid */}

        <div
          className="
            absolute
            inset-0
            opacity-[0.018]
            dark:opacity-[0.025]
            [background-image:linear-gradient(rgba(120,120,120,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(120,120,120,0.4)_1px,transparent_1px)]
            [background-size:48px_48px]
          "
        />
      </div>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header
        className="
          relative
          z-10
          mx-auto
          flex
          w-full
          max-w-2xl
          flex-col
          items-center
          text-center
        "
      >
        {/* SYSTEM STATUS */}

        <div
          className="
            mb-5
            flex
            items-center
            gap-2
            rounded-full
            border
            border-zinc-200
            bg-white/70
            px-3
            py-1.5
            shadow-sm
            backdrop-blur-xl
            dark:border-white/[0.07]
            dark:bg-white/[0.025]
          "
        >
          <span className="relative flex h-2 w-2">
            <span
              className="
                absolute
                inline-flex
                h-full
                w-full
                animate-ping
                rounded-full
                bg-yellow-400
                opacity-50
              "
            />

            <span
              className="
                relative
                inline-flex
                h-2
                w-2
                rounded-full
                bg-yellow-400
                shadow-[0_0_8px_rgba(250,204,21,0.8)]
              "
            />
          </span>

          <span
            className="
              text-[9px]
              font-medium
              uppercase
              tracking-[0.22em]
              text-zinc-500
              dark:text-zinc-500
            "
          >
            Intelligence System
          </span>
        </div>

        {/* TITLE */}

        <h1
          className="
            bg-gradient-to-b
            from-zinc-950
            via-zinc-800
            to-zinc-500
            bg-clip-text
            text-[2rem]
            font-semibold
            tracking-[-0.04em]
            text-transparent
            dark:from-white
            dark:via-zinc-100
            dark:to-zinc-500
            sm:text-[2.5rem]
          "
        >
          Mann&apos;s Intelligence
        </h1>

        <p
          className="
            mt-2.5
            max-w-md
            text-[11px]
            leading-relaxed
            text-zinc-500
            dark:text-zinc-500
            sm:text-xs
          "
        >
          Market intelligence tools designed to help you
          read the market with greater clarity.
        </p>

        {/* DECORATIVE LINE */}

        <div
          className="
            mt-6
            flex
            items-center
            gap-2
          "
        >
          <div
            className="
              h-px
              w-8
              bg-gradient-to-r
              from-transparent
              to-yellow-400/40
            "
          />

          <div
            className="
              h-1
              w-1
              rounded-full
              bg-yellow-400
              shadow-[0_0_7px_rgba(250,204,21,0.8)]
            "
          />

          <div
            className="
              h-px
              w-8
              bg-gradient-to-l
              from-transparent
              to-yellow-400/40
            "
          />
        </div>
      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div
        className="
          relative
          mx-auto
          mt-8
          w-full
          max-w-2xl
        "
      >
        {/* outer glow */}

        <div
          className="
            pointer-events-none
            absolute
            -inset-6
            rounded-[2rem]
            bg-yellow-400/[0.025]
            blur-3xl
            dark:bg-yellow-400/[0.045]
          "
        />

        {/* ===================================================
            APPLICATION PANEL
        =================================================== */}

        <main
          className="
            relative
            z-10
            overflow-hidden
            rounded-[1.5rem]
            border
            border-zinc-200/80
            bg-white/75
            p-2
            shadow-[0_25px_80px_rgba(0,0,0,0.06)]
            backdrop-blur-2xl
            dark:border-white/[0.07]
            dark:bg-[#0b0b0b]/80
            dark:shadow-[0_25px_90px_rgba(0,0,0,0.45)]
            sm:p-2.5
          "
        >
          {/* top edge */}

          <div
            className="
              pointer-events-none
              absolute
              left-[15%]
              right-[15%]
              top-0
              h-px
              bg-gradient-to-r
              from-transparent
              via-yellow-400/50
              to-transparent
            "
          />

          {/* PANEL HEADER */}

          <div
            className="
              flex
              items-center
              justify-between
              px-3
              pb-3
              pt-2
              sm:px-4
            "
          >
            <div className="flex items-center gap-2.5">
              <div
                className="
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-yellow-500/15
                  bg-yellow-400/[0.06]
                  text-yellow-500
                  dark:text-yellow-400
                "
              >
                <ScanLine size={14} strokeWidth={1.8} />
              </div>

              <div>
                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.16em]
                    text-zinc-700
                    dark:text-zinc-300
                  "
                >
                  Intelligence Hub
                </p>

                <p
                  className="
                    mt-0.5
                    text-[9px]
                    text-zinc-400
                    dark:text-zinc-600
                  "
                >
                  Select a module to continue
                </p>
              </div>
            </div>

            <div
              className="
                flex
                items-center
                gap-1.5
                rounded-full
                border
                border-zinc-200
                px-2.5
                py-1
                dark:border-white/[0.06]
              "
            >
              <Radio
                size={10}
                className="text-yellow-500"
              />

              <span
                className="
                  text-[8px]
                  font-medium
                  uppercase
                  tracking-wider
                  text-zinc-400
                "
              >
                Online
              </span>
            </div>
          </div>

          {/* =================================================
              MODULES
          ================================================= */}

          <div className="flex flex-col gap-2.5">
            {links.map((item) => {

              const Icon =
                item.id === 1
                  ? BarChart3
                  : item.id === 2
                    ? Activity
                    : Crosshair;

              return (
                <Link
                  key={item.id}
                  href={item.url}
                  className="
                    group
                    relative
                    overflow-hidden
                    rounded-[1.15rem]
                    border
                    border-zinc-200/80
                    bg-zinc-50/70
                    px-4
                    py-4
                    transition-all
                    duration-300
                    hover:-translate-y-[2px]
                    hover:border-yellow-500/25
                    hover:bg-white
                    hover:shadow-[0_18px_45px_rgba(0,0,0,0.06)]
                    active:translate-y-0
                    dark:border-white/[0.06]
                    dark:bg-white/[0.018]
                    dark:hover:border-yellow-400/25
                    dark:hover:bg-white/[0.035]
                    dark:hover:shadow-[0_18px_50px_rgba(0,0,0,0.35)]
                    sm:px-5
                    sm:py-[1.15rem]
                  "
                >
                  {/* CARD GLOW */}

                  <div
                    className="
                      pointer-events-none
                      absolute
                      -right-20
                      -top-20
                      h-40
                      w-40
                      rounded-full
                      bg-yellow-400/[0.06]
                      opacity-0
                      blur-3xl
                      transition-opacity
                      duration-500
                      group-hover:opacity-100
                    "
                  />

                  {/* CARD CONTENT */}

                  <div
                    className="
                      relative
                      flex
                      items-center
                      justify-between
                      gap-4
                    "
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      {/* MODULE ICON */}

                      <div
                        className="
                          relative
                          flex
                          h-11
                          w-11
                          shrink-0
                          items-center
                          justify-center
                          overflow-hidden
                          rounded-xl
                          border
                          border-zinc-200
                          bg-white
                          text-zinc-400
                          shadow-sm
                          transition-all
                          duration-300
                          group-hover:border-yellow-400/25
                          group-hover:text-yellow-500
                          group-hover:shadow-[0_0_25px_rgba(234,179,8,0.1)]
                          dark:border-white/[0.07]
                          dark:bg-white/[0.025]
                          dark:text-zinc-600
                          dark:group-hover:text-yellow-400
                        "
                      >
                        <div
                          className="
                            absolute
                            inset-0
                            bg-gradient-to-br
                            from-yellow-400/[0.08]
                            via-transparent
                            to-transparent
                            opacity-0
                            transition-opacity
                            duration-300
                            group-hover:opacity-100
                          "
                        />

                        <Icon
                          size={18}
                          strokeWidth={1.6}
                          className="relative z-10"
                        />
                      </div>

                      {/* TEXT */}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2
                            className="
                              truncate
                              text-sm
                              font-semibold
                              tracking-tight
                              text-zinc-900
                              transition-colors
                              duration-300
                              group-hover:text-yellow-500
                              dark:text-zinc-100
                              dark:group-hover:text-yellow-400
                              sm:text-[15px]
                            "
                          >
                            {item.title}
                          </h2>

                          
                        </div>

                        <p
                          className="
                            mt-1
                            max-w-lg
                            text-[10px]
                            leading-relaxed
                            text-zinc-500
                            dark:text-zinc-500
                            sm:text-[11px]
                          "
                        >
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* ARROW BUTTON */}

                    <div
                      className="
                        flex
                        h-8
                        w-8
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        border
                        border-zinc-200
                        bg-white
                        text-zinc-400
                        transition-all
                        duration-300
                        group-hover:border-yellow-400/25
                        group-hover:bg-yellow-400/[0.08]
                        group-hover:text-yellow-500
                        dark:border-white/[0.06]
                        dark:bg-white/[0.02]
                        dark:text-zinc-600
                        dark:group-hover:text-yellow-400
                      "
                    >
                      <ArrowUpRight
                        size={15}
                        strokeWidth={1.8}
                        className="
                          transition-transform
                          duration-300
                          group-hover:-translate-y-0.5
                          group-hover:translate-x-0.5
                        "
                      />
                    </div>
                  </div>

                  {/* BOTTOM ACCENT */}

                  <div
                    className="
                      pointer-events-none
                      absolute
                      bottom-0
                      left-1/2
                      h-px
                      w-0
                      -translate-x-1/2
                      bg-gradient-to-r
                      from-transparent
                      via-yellow-400/70
                      to-transparent
                      transition-all
                      duration-500
                      group-hover:w-[55%]
                    "
                  />
                </Link>
              );
            })}
          </div>
        </main>

        {/* ===================================================
            IMPORTANT / MARQUEE
        =================================================== */}

        <section
          className="
            relative
            z-10
            mt-7
          "
        >
          {/* SECTION TITLE */}

          <div
            className="
              mb-3
              flex
              items-center
              gap-3
            "
          >
            <div
              className="
                h-px
                flex-1
                bg-gradient-to-r
                from-transparent
                to-zinc-200
                dark:to-white/[0.06]
              "
            />

            <div
              className="
                flex
                items-center
                gap-2
                rounded-full
                border
                border-yellow-500/15
                bg-yellow-400/[0.035]
                px-3
                py-1.5
              "
            >
              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-yellow-400
                  shadow-[0_0_8px_rgba(250,204,21,0.8)]
                "
              />

              <h2
                className="
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.2em]
                  text-yellow-500
                  dark:text-yellow-400
                "
              >
                Penting Mann !
              </h2>
            </div>

            <div
              className="
                h-px
                flex-1
                bg-gradient-to-l
                from-transparent
                to-zinc-200
                dark:to-white/[0.06]
              "
            />
          </div>

          {/* MARQUEE */}

          <div
            className="
              relative
              overflow-hidden
              rounded-[1.1rem]
              border
              border-zinc-200/80
              bg-white/60
              px-3
              py-3
              shadow-sm
              backdrop-blur-xl
              dark:border-white/[0.05]
              dark:bg-white/[0.015]
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                inset-x-10
                top-0
                h-px
                bg-gradient-to-r
                from-transparent
                via-yellow-400/25
                to-transparent
              "
            />

            <InfiniteMarqueeSlider />
          </div>
        </section>
      </div>

      {/* =====================================================
          FOOTER DECORATION
      ===================================================== */}

      <div
        className="
          relative
          z-10
          mx-auto
          mt-8
          flex
          max-w-2xl
          items-center
          justify-center
          gap-3
        "
      >
        <div
          className="
            h-px
            w-12
            bg-gradient-to-r
            from-transparent
            to-zinc-300
            dark:to-white/[0.08]
          "
        />

        <span
          className="
            text-[8px]
            font-medium
            uppercase
            tracking-[0.35em]
            text-zinc-400/70
            dark:text-zinc-600
          "
        >
          MI • INTELLIGENCE
        </span>

        <div
          className="
            h-px
            w-12
            bg-gradient-to-l
            from-transparent
            to-zinc-300
            dark:to-white/[0.08]
          "
        />
      </div>
    </div>
  );
}

