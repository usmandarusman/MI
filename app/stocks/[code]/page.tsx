import Link from "next/link";

import {
  ArrowLeft,
  LineChart,
} from "lucide-react";

import StockChartCard from "@/app/components/stock-chart/stockChartCard";

type StockPageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function StockPage({
  params,
}: StockPageProps) {
  const { code } = await params;

  const normalizedCode =
    code.trim().toUpperCase();

  return (
    <main
      className="
        min-h-screen
        dark:bg-[#050506]
        text-zinc-100
      "
    >
      {/* Background decoration */}

      <div
        className="
          pointer-events-none
          fixed
          inset-0
          -z-0
          overflow-hidden
        "
      >
        <div
          className="
            absolute
            left-1/2
            top-0
            h-[500px]
            w-[800px]
            -translate-x-1/2
            rounded-full
            bg-[#d4af37]/[0.025]
            blur-[120px]
          "
        />
      </div>

      <div
        className="
          relative
          z-10
          mx-auto
          w-full
          max-w-[1600px]
          px-4
          py-5
          md:px-6
          md:py-8
          lg:px-8
        "
      >
        {/* Top navigation */}

        <div
          className="
            mb-5
            flex
            items-center
            justify-between
          "
        >
          <Link
            href="/"
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-white/[0.06]
              bg-white/[0.02]
              px-3
              py-2
              text-xs
              text-zinc-500
              transition
              hover:bg-white/[0.05]
              hover:text-zinc-200
            "
          >
            <ArrowLeft size={14} />

            Back
          </Link>

          <div
            className="
              flex
              items-center
              gap-2
              text-[10px]
              uppercase
              tracking-[0.18em]
              text-zinc-700
            "
          >
            <LineChart size={13} />

            {`Mann's Intelligence`}
          </div>
        </div>

        <StockChartCard
          code={normalizedCode}
        />
      </div>
    </main>
  );
}