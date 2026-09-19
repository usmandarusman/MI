"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";

import { ArrowUpRight, Sparkles } from "lucide-react";

import "swiper/css";

const trade = [
  {
    id: 1,
    trade: "Day Trade",
    subtitle: "Short-term strategy",
    Strategi: `Gunakan kemampuan analisa kamu terhadap saham berdasarkan "Price Action dan Volume", pilih saham yang liquid dan gunakan timeframe 1H.`,
  },
  {
    id: 2,
    trade: "Swing Trade",
    subtitle: "Medium-term strategy",
    Strategi: `Gunakan kemampuan analisa kamu terhadap saham berdasarkan "Broker Summary", pilih saham yang didalamnya ada akumulasi dari suatu broker dan gunakan timeframe 1D.`,
  },
  {
    id: 3,
    trade: "Long Trade",
    subtitle: "Long-term strategy",
    Strategi: `Gunakan kemampuan analisa kamu terhadap saham berdasarkan "Fundamental dan Teknikal", pilih saham growth yang masih punya cerita di dalamnya seperti ekspansi dan sebagainya.`,
  },
];

export function InfiniteMarqueeSlider() {
  return (
    <div className="relative w-full">
      <Swiper
        modules={[Autoplay]}
        slidesPerView="auto"
        spaceBetween={14}
        loop={true}
        speed={800}
        autoplay={{
          delay: 3000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        grabCursor={true}
        allowTouchMove={true}
        className="!overflow-visible"
      >
        {trade.map((item, index) => (
          <SwiperSlide
            key={item.id}
            style={{ width: "270px" }}
            className="!h-auto"
          >
            <div
              className="
                group relative h-full min-h-[205px] overflow-hidden
                rounded-2xl border p-5
                border-amber-300/70
                bg-gradient-to-br from-white via-amber-50/70 to-white
                shadow-[0_4px_20px_rgba(180,130,30,0.07)]
                transition-all duration-300 ease-out

                dark:border-amber-400/20
                dark:bg-gradient-to-br dark:from-[#1c1c20]
                dark:via-[#171719] dark:to-[#111113]
                dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]

                hover:-translate-y-1
                hover:border-amber-400
                hover:shadow-[0_8px_30px_rgba(180,130,30,0.14)]
                dark:hover:border-amber-400/50
                dark:hover:shadow-[0_8px_35px_rgba(245,180,50,0.08)]
              "
            >
              {/* Subtle glow */}
              <div
                className="
                  pointer-events-none absolute -right-12 -top-12
                  h-32 w-32 rounded-full bg-amber-400/10 blur-3xl
                  transition-all duration-500
                  group-hover:bg-amber-400/20
                  dark:bg-amber-400/[0.07]
                  dark:group-hover:bg-amber-400/15
                "
              />

              {/* Top accent line */}
              <div
                className="
                  absolute left-5 right-5 top-0 h-[2px]
                  rounded-full bg-gradient-to-r
                  from-transparent via-amber-400 to-transparent
                  opacity-60 transition-opacity duration-300
                  group-hover:opacity-100
                "
              />

              {/* Header */}
              <div className="relative flex items-start justify-between">
                <div
                  className="
                    flex h-10 w-10 items-center justify-center
                    rounded-xl border border-amber-400/30
                    bg-amber-400/10 text-amber-600
                    dark:text-amber-400
                  "
                >
                  <Sparkles size={18} strokeWidth={1.8} />
                </div>

                <span
                  className="
                    rounded-full border border-amber-500/20
                    bg-amber-400/10 px-2.5 py-1
                    text-[10px] font-semibold tracking-wider
                    text-amber-700 dark:text-amber-400
                  "
                >
                  STRATEGY 0{index + 1}
                </span>
              </div>

              {/* Title */}
              <div className="relative mt-5">
                <h3
                  className="
                    text-md font-bold tracking-tight
                    text-zinc-900 transition-colors
                    group-hover:text-amber-700
                    dark:text-zinc-100
                    dark:group-hover:text-amber-300
                  "
                >
                  {item.trade}
                </h3>

                <p
                  className="
                    mt-1 text-[10px] font-medium uppercase
                    tracking-[0.14em] text-zinc-500
                    dark:text-zinc-500
                  "
                >
                  {item.subtitle}
                </p>
              </div>

              {/* Divider */}
              <div
                className="
                  my-3 h-px w-full
                  bg-gradient-to-r from-amber-400/40
                  via-zinc-300/60 to-transparent
                  dark:via-white/10
                "
              />

              {/* Description */}
              <p
                className="
                  relative text-xs leading-[1.8]
                  text-zinc-600 dark:text-zinc-400
                "
              >
                {item.Strategi}
              </p>

              {/* Bottom right accent */}
              <div
                className="
                  absolute bottom-4 right-4
                  text-amber-600/50 transition-all duration-300
                  group-hover:translate-x-1
                  group-hover:text-amber-600
                  dark:text-amber-400/40
                  dark:group-hover:text-amber-400
                "
              >
                <ArrowUpRight size={16} />
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}