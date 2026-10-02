"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
        w-full
        min-h-full
        px-4
        py-6
        dark:bg-zinc-950
      "
    >
      <h1 className="text-xl font-semibold">
        Broker Activity
      </h1>

      <div
        className="
          relative
          mx-auto
          mt-4
          w-full
          md:w-2/3
          lg:w-1/2
        "
      >
        {/* =====================================================
            GLOW
        ===================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            -inset-6
            rounded-4xl
            bg-yellow-400/5
            blur-3xl
            dark:bg-yellow-400/20
          "
        />

        {/* =====================================================
            MENU CARD
        ===================================================== */}

        <main
          className="
            relative
            z-10
            w-full
            rounded-2xl
            border
            border-zinc-200
            bg-white/85
            p-5
            shadow-xl
            backdrop-blur-xl
            dark:border-yellow-500/20
            dark:bg-zinc-900/80
            sm:p-6
          "
        >
          <div className="flex flex-col gap-4">

            {/* =================================================
                BROKER ACCUMULATION
            ================================================= */}

            <Link
              href={links[0].url}
              className="
                group
                relative
                overflow-hidden
                rounded-xl
                border
                border-yellow-500/20
                bg-zinc-50
                px-5
                py-4
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:border-yellow-500/50
                hover:shadow-[0_8px_30px_rgba(234,179,8,0.12)]
                dark:bg-zinc-950/60
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >
                <div className="min-w-0">
                  <h2
                    className="
                      text-base
                      font-semibold
                      text-zinc-900
                      dark:text-white
                    "
                  >
                    {links[0].title}
                  </h2>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-relaxed
                      text-zinc-500
                      dark:text-zinc-400
                    "
                  >
                    {links[0].description}
                  </p>
                </div>

                <ArrowRight
                  size={21}
                  className="
                    shrink-0
                    text-yellow-500
                    transition-transform
                    duration-300
                    group-hover:translate-x-1
                  "
                />
              </div>
            </Link>

            {/* =================================================
                BROKER MOVEMENT
            ================================================= */}

            <Link
              href={links[1].url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                group
                relative
                overflow-hidden
                rounded-xl
                border
                border-yellow-500/20
                bg-zinc-50
                px-5
                py-4
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:border-yellow-500/50
                hover:shadow-[0_8px_30px_rgba(234,179,8,0.12)]
                dark:bg-zinc-950/60
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >
                <div className="min-w-0">
                  <h2
                    className="
                      text-base
                      font-semibold
                      text-zinc-900
                      dark:text-white
                    "
                  >
                    {links[1].title}
                  </h2>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-relaxed
                      text-zinc-500
                      dark:text-zinc-400
                    "
                  >
                    {links[1].description}
                  </p>
                </div>

                <ArrowRight
                  size={21}
                  className="
                    shrink-0
                    text-yellow-500
                    transition-transform
                    duration-300
                    group-hover:translate-x-1
                  "
                />
              </div>
            </Link>

            {/* =================================================
                TRADE PLANE
            ================================================= */}

            <Link
              href={links[2].url}
              className="
                group
                relative
                overflow-hidden
                rounded-xl
                border
                border-yellow-500/20
                bg-zinc-50
                px-5
                py-4
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:border-yellow-500/50
                hover:shadow-[0_8px_30px_rgba(234,179,8,0.12)]
                dark:bg-zinc-950/60
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >
                <div className="min-w-0">
                  <h2
                    className="
                      text-base
                      font-semibold
                      text-zinc-900
                      dark:text-white
                    "
                  >
                    {links[2].title}
                  </h2>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-relaxed
                      text-zinc-500
                      dark:text-zinc-400
                    "
                  >
                    {links[2].description}
                  </p>
                </div>

                <ArrowRight
                  size={21}
                  className="
                    shrink-0
                    text-yellow-500
                    transition-transform
                    duration-300
                    group-hover:translate-x-1
                  "
                />
              </div>
            </Link>

          </div>
        </main>

        {/* =====================================================
            IMPORTANT
        ===================================================== */}

        <div
          className="
            relative
            z-10
            mt-5
            flex
            w-full
            flex-col
            gap-2
            px-2
            pt-5
          "
        >
          <h2
            className="
              text-lg
              font-medium
              italic
              text-yellow-400
            "
          >
            Penting Mann !
          </h2>

          <InfiniteMarqueeSlider />
        </div>
      </div>
    </div>
  );
}