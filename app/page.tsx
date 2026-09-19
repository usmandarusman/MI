import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InfiniteMarqueeSlider } from "./components/fungsi/infiniteSlider";

const links = [
  {
    id: 1,
    title: "Broker Accumulation",
    description:
      "Monitoring aktivitas transaksi broker secara terstruktur.",
    url: "/broker-accumulation",
  },
  {
    id: 2,
    title: "Broker Movement",
    description:
      "Monitor pergerakan broker secara terstruktur.",
    url: "https://axentraz.id/broker-activity",
  },
];

export default function Home() {
  return (
    <div className="w-full h-full flex flex-col gap-4 items-center justify-center scrollbar-none overflow-x-scroll  dark:bg-zinc-950 px-4">
      <h1 className="text-xl font-semibold">Broker Activity</h1>

      {/* CONTAINER + GLOW */}
      <div className="relative w-full md:w-2/3 lg:w-1/2">

        {/* Ambient Gold Glow */}
        <div
          className="
            pointer-events-none
            absolute
            -inset-6
            rounded-4xl

            
            dark:bg-yellow-400/25

            blur-3xl

            opacity-60
            dark:opacity-80

            transition-all duration-700
          "
        />

        {/* Secondary Glow */}
        <div
          className="
            pointer-events-none
            absolute
            -inset-2
            rounded-[1.5rem]

            bg-gradient-to-r
            from-yellow-500/20
            via-yellow-300/10
            to-yellow-500/20

            blur-xl

            opacity-50
            dark:opacity-70
          "
        />

        {/* MAIN */}
        <main
          className="
            relative
            z-10

            w-full
            p-5 sm:p-6

            rounded-2xl

            bg-white/80
            dark:bg-zinc-900/75

            backdrop-blur-xl

            border
            border-zinc-200
            dark:border-yellow-500/20

            shadow-xl
            dark:shadow-[0_0_30px_rgba(234,179,8,0.12)]

            flex flex-col gap-5
          "
        >

          {links.map((link) => (
            <Link
              key={link.id}
              href={link.url}
              className="
                group relative
                w-full
                overflow-hidden
                rounded-xl

                border
                border-yellow-500/25
                dark:border-yellow-500/30

                bg-zinc-100
                dark:bg-zinc-950/80

                px-5 py-4

                text-zinc-900
                dark:text-white

                transition-all
                duration-300
                ease-out

                hover:scale-[1.02]

                hover:border-yellow-400
                dark:hover:border-yellow-300

                hover:shadow-[0_0_20px_rgba(234,179,8,0.25)]

                active:scale-[0.97]
                active:duration-100
              "
            >

              {/* Inner Light */}
              <span
                className="
                  pointer-events-none
                  absolute inset-0

                  bg-gradient-to-r
                  from-yellow-500/10
                  via-transparent
                  to-yellow-400/10

                  opacity-0

                  transition-opacity
                  duration-300

                  group-hover:opacity-100
                "
              />

              {/* Content */}
              <div className="relative z-10 flex items-center justify-between gap-4">

                <div className="flex flex-col gap-1">

                  <h2
                    className="
                      text-base sm:text-lg
                      font-semibold
                      tracking-wide

                      dark:text-white

                      transition-colors
                      duration-300

                      group-hover:text-yellow-600
                      dark:group-hover:text-yellow-300
                    "
                  >
                    {link.title}
                  </h2>

                  <p
                    className="
                      text-xs sm:text-sm
                      leading-relaxed

                      text-zinc-500
                      dark:text-zinc-400

                      transition-colors
                      duration-300

                      group-hover:text-zinc-600
                      dark:group-hover:text-zinc-300
                    "
                  >
                    {link.description}
                  </p>

                </div>

                {/* Arrow */}
                <span
                  className="
                    relative z-10
                    shrink-0

                    flex items-center justify-center

                    text-yellow-500

                    drop-shadow-[0_0_7px_rgba(234,179,8,0.8)]

                    transition-all
                    duration-300
                    ease-out

                    group-hover:translate-x-1
                    group-hover:text-yellow-300

                    group-hover:drop-shadow-[0_0_14px_rgba(253,224,71,1)]

                    group-active:scale-90
                  "
                >
                  <ArrowRight
                    size={23}
                    strokeWidth={2}
                  />
                </span>

              </div>

            </Link>
          ))}

        </main>
        <div className=" w-full flex flex-col gap-2  px-2 pt-10">
        <h2 className="text-lg font-medium italic text-yellow-400">Penting Mann !</h2>
        <InfiniteMarqueeSlider/>
      </div>

      </div>

    </div>
  );
}