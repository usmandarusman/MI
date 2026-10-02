"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  ColorType,
  CrosshairMode,
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

import type {
  SRAnalysis,
  SRZone,
} from "./support-resistance";

/* =========================================================
   TYPES
========================================================= */

type StockHistory = {
  date: string;

  open: number;
  high: number;
  low: number;
  close: number;

  volume: number;

  value?: number;
  frequency?: number;

  foreignBuy?: number;
  foreignSell?: number;

  source?: string;
};

type StockChartProps = {
  data: StockHistory[];

  analysis?: SRAnalysis | null;
};

/* =========================================================
   CONFIG
========================================================= */

/*
 * Volume market yang ditampilkan di chart
 * menggunakan scaling yang sama dengan
 * Trade Plane / Sync Signal.
 *
 * Contoh:
 *
 * 40.956.800 × 0.01
 * = 409.568
 * = 409,57K
 */
const MARKET_VOLUME_SCALE = 0.01;

/* =========================================================
   NUMBER HELPERS
========================================================= */

function formatNumber(
  value: number,
  maximumFractionDigits = 2
): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits,
    }
  ).format(value);
}

/**
 * Format angka menjadi:
 *
 * 409568
 * -> 409,57K
 *
 * 1200000
 * -> 1,2M
 *
 * 3200000000
 * -> 3,2B
 */
function formatCompactNumber(
  value: number,
  maximumFractionDigits = 2
): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const absolute =
    Math.abs(value);

  const sign =
    value < 0
      ? "-"
      : "";

  if (
    absolute >=
    1_000_000_000_000
  ) {
    return (
      sign +
      formatNumber(
        absolute /
          1_000_000_000_000,
        maximumFractionDigits
      ) +
      "T"
    );
  }

  if (
    absolute >=
    1_000_000_000
  ) {
    return (
      sign +
      formatNumber(
        absolute /
          1_000_000_000,
        maximumFractionDigits
      ) +
      "B"
    );
  }

  if (
    absolute >=
    1_000_000
  ) {
    return (
      sign +
      formatNumber(
        absolute /
          1_000_000,
        maximumFractionDigits
      ) +
      "M"
    );
  }

  if (
    absolute >=
    1_000
  ) {
    return (
      sign +
      formatNumber(
        absolute /
          1_000,
        maximumFractionDigits
      ) +
      "K"
    );
  }

  return formatNumber(
    value,
    maximumFractionDigits
  );
}

/* =========================================================
   DATE
========================================================= */

/**
 * Firestore / API:
 *
 * YYYYMMDD
 * 20260821
 *
 * Lightweight Charts:
 *
 * YYYY-MM-DD
 * 2026-08-21
 */
function toTime(
  date: string
): Time {
  const value =
    String(date).trim();

  /*
   * Kalau sudah format
   * Lightweight Charts,
   * langsung gunakan.
   */
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return value as Time;
  }

  /*
   * Format Firestore/API:
   *
   * YYYYMMDD
   */
  if (
    /^\d{8}$/.test(
      value
    )
  ) {
    const year =
      value.slice(0, 4);

    const month =
      value.slice(4, 6);

    const day =
      value.slice(6, 8);

    return `${year}-${month}-${day}` as Time;
  }

  throw new Error(
    `[StockChart] Format tanggal tidak valid: ${value}`
  );
}

/* =========================================================
   PRICE FORMAT
========================================================= */

function formatPrice(
  value: number
): string {
  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits: 2,
    }
  ).format(value);
}

/* =========================================================
   COMPONENT
========================================================= */

export default function StockChart({
  data,
  analysis,
}: StockChartProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const chartRef =
    useRef<IChartApi | null>(
      null
    );

  const candleSeriesRef =
    useRef<
      ISeriesApi<"Candlestick"> | null
    >(null);

  const volumeSeriesRef =
    useRef<
      ISeriesApi<"Histogram"> | null
    >(null);

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    /* =====================================================
       CLEAN OLD CHART
    ===================================================== */

    if (chartRef.current) {
      chartRef.current.remove();

      chartRef.current =
        null;

      candleSeriesRef.current =
        null;

      volumeSeriesRef.current =
        null;
    }

    /* =====================================================
       CREATE CHART
    ===================================================== */

    const chart =
      createChart(
        container,
        {
          width:
            container.clientWidth,

          height:
            window.innerWidth >= 768
              ? 520
              : 430,

          layout: {
            background: {
              type:
                ColorType.Solid,

              color:
                "#09090b",
            },

            textColor:
              "#71717a",
          },

          grid: {
            vertLines: {
              color:
                "rgba(255,255,255,0.025)",
            },

            horzLines: {
              color:
                "rgba(255,255,255,0.025)",
            },
          },

          crosshair: {
            mode:
              CrosshairMode.Normal,

            vertLine: {
              color:
                "rgba(212,175,55,0.35)",

              width: 1,

              style:
                LineStyle.Dashed,

              labelBackgroundColor:
                "#d4af37",
            },

            horzLine: {
              color:
                "rgba(212,175,55,0.35)",

              width: 1,

              style:
                LineStyle.Dashed,

              labelBackgroundColor:
                "#d4af37",
            },
          },

          rightPriceScale: {
            borderColor:
              "rgba(255,255,255,0.06)",

            scaleMargins: {
              top: 0.08,
              bottom: 0.22,
            },
          },

          timeScale: {
            borderColor:
              "rgba(255,255,255,0.06)",

            timeVisible:
              false,

            secondsVisible:
              false,

            rightOffset:
              5,

            barSpacing:
              8,

            minBarSpacing:
              3,
          },

          /*
           * PRICE FORMATTER
           *
           * Ini hanya berlaku untuk
           * price scale utama.
           *
           * Volume punya formatter sendiri
           * di HistogramSeries di bawah.
           */
          localization: {
            priceFormatter:
              formatPrice,
          },

          handleScroll: {
            mouseWheel:
              true,

            pressedMouseMove:
              true,

            horzTouchDrag:
              true,

            vertTouchDrag:
              true,
          },

          handleScale: {
            axisPressedMouseMove:
              true,

            mouseWheel:
              true,

            pinch:
              true,
          },
        }
      );

    chartRef.current =
      chart;

    /* =====================================================
       CANDLESTICK
    ===================================================== */

    const candleSeries =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor:
            "#10b981",

          downColor:
            "#ef4444",

          borderVisible:
            false,

          wickUpColor:
            "#10b981",

          wickDownColor:
            "#ef4444",

          priceLineVisible:
            true,

          lastValueVisible:
            true,
        }
      );

    candleSeriesRef.current =
      candleSeries;

    /* =====================================================
       VOLUME
    ===================================================== */

    const volumeSeries =
      chart.addSeries(
        HistogramSeries,
        {
          /*
           * PENTING
           *
           * Volume menggunakan custom
           * formatter supaya label scale
           * menjadi K / M / B.
           *
           * Contoh:
           *
           * 409568
           * -> 409,57K
           *
           * 1200000
           * -> 1,2M
           */
          priceFormat: {
            type:
              "custom",

            minMove:
              1,

            formatter:
              formatCompactNumber,
          },

          /*
           * Tetap gunakan price scale
           * khusus volume.
           */
          priceScaleId:
            "volume",

          color:
            "rgba(113,113,122,0.35)",
        }
      );

    volumeSeriesRef.current =
      volumeSeries;

    /* =====================================================
       VOLUME PRICE SCALE
    ===================================================== */

    chart
      .priceScale("volume")
      .applyOptions({
        scaleMargins: {
          top:
            0.82,

          bottom:
            0,
        },

        borderVisible:
          false,
      });

    /* =====================================================
       PREPARE VALID DATA
    ===================================================== */

    const validData =
      data.filter(
        (item) =>
          item.date &&
          item.open > 0 &&
          item.high > 0 &&
          item.low > 0 &&
          item.close > 0
      );

    /* =====================================================
       CANDLE DATA
    ===================================================== */

    const candleData =
      validData.map(
        (item) => ({
          time:
            toTime(
              item.date
            ),

          open:
            item.open,

          high:
            item.high,

          low:
            item.low,

          close:
            item.close,
        })
      );

    /*
     * Debug date conversion.
     */
    if (
      candleData.length >
      0
    ) {
      console.log(
        "[StockChart] Date conversion:",
        {
          original:
            validData[0]
              .date,

          converted:
            candleData[0]
              .time,

          lastOriginal:
            validData[
              validData.length -
                1
            ].date,

          lastConverted:
            candleData[
              candleData.length -
                1
            ].time,
        }
      );
    }

    candleSeries.setData(
      candleData
    );

    /* =====================================================
       VOLUME DATA
    =====================================================

       RAW FIRESTORE:

       40.956.800

       SCALE:

       × 0.01

       HASIL:

       409.568

       TAMPILAN:

       409,57K
    ===================================================== */

    const volumeData =
      validData.map(
        (item) => {
          /*
           * Volume asli dari Firestore
           */
          const rawVolume =
            Number(
              item.volume
            ) || 0;

          /*
           * Scale hanya untuk
           * visual chart.
           *
           * Data Firestore tetap raw.
           */
          const marketVolume =
            rawVolume *
            MARKET_VOLUME_SCALE;

          return {
            time:
              toTime(
                item.date
              ),

            value:
              marketVolume,

            color:
              item.close >=
              item.open
                ? "rgba(16,185,129,0.28)"
                : "rgba(239,68,68,0.28)",
          };
        }
      );

    volumeSeries.setData(
      volumeData
    );

    /* =====================================================
       DEBUG VOLUME
    ===================================================== */

    if (
      volumeData.length >
      0
    ) {
      const lastRawVolume =
        Number(
          validData[
            validData.length -
              1
          ].volume
        ) || 0;

      const lastScaledVolume =
        lastRawVolume *
        MARKET_VOLUME_SCALE;

      console.log(
        "[StockChart] Volume scaling:",
        {
          rawVolume:
            lastRawVolume,

          scale:
            MARKET_VOLUME_SCALE,

          scaledVolume:
            lastScaledVolume,

          compact:
            formatCompactNumber(
              lastScaledVolume
            ),
        }
      );
    }

    /* =====================================================
       CURRENT PRICE
    ===================================================== */

    if (analysis) {
      candleSeries.createPriceLine(
        {
          price:
            analysis.currentPrice,

          color:
            "rgba(212,175,55,0.8)",

          lineWidth:
            1,

          lineStyle:
            LineStyle.Dashed,

          axisLabelVisible:
            true,

          title:
            "PRICE",
        }
      );
    }

    /* =====================================================
       RESISTANCE
    ===================================================== */

    if (analysis) {
      const resistanceLines =
        getTopZones(
          analysis.resistances,
          analysis.currentPrice,
          "resistance"
        );

      resistanceLines.forEach(
        (
          zone,
          index
        ) => {
          addZoneLines(
            candleSeries,
            zone,
            `R${index + 1}`,
            "resistance"
          );
        }
      );
    }

    /* =====================================================
       SUPPORT
    ===================================================== */

    if (analysis) {
      const supportLines =
        getTopZones(
          analysis.supports,
          analysis.currentPrice,
          "support"
        );

      supportLines.forEach(
        (
          zone,
          index
        ) => {
          addZoneLines(
            candleSeries,
            zone,
            `S${index + 1}`,
            "support"
          );
        }
      );
    }

    /* =====================================================
       ENTRY AREA
    ===================================================== */

    if (
      analysis?.entryZone
    ) {
      const entry =
        analysis.entryZone;

      /*
       * ENTRY LOW
       */
      candleSeries.createPriceLine(
        {
          price:
            entry.low,

          color:
            "rgba(212,175,55,0.9)",

          lineWidth:
            2,

          lineStyle:
            LineStyle.Solid,

          axisLabelVisible:
            true,

          title:
            "ENTRY",
        }
      );

      /*
       * ENTRY HIGH
       */
      candleSeries.createPriceLine(
        {
          price:
            entry.high,

          color:
            "rgba(212,175,55,0.55)",

          lineWidth:
            1,

          lineStyle:
            LineStyle.Dotted,

          axisLabelVisible:
            true,

          title:
            "ENTRY",
        }
      );
    }

    /* =====================================================
       FIT CONTENT
    ===================================================== */

    chart
      .timeScale()
      .fitContent();

    /* =====================================================
       RESPONSIVE
    ===================================================== */

    const resizeObserver =
      new ResizeObserver(
        (
          entries
        ) => {
          const entry =
            entries[0];

          if (!entry) {
            return;
          }

          const width =
            entry.contentRect
              .width;

          const height =
            window.innerWidth >=
            768
              ? 520
              : 430;

          chart.applyOptions({
            width,
            height,
          });
        }
      );

    resizeObserver.observe(
      container
    );

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      resizeObserver.disconnect();

      chart.remove();

      chartRef.current =
        null;

      candleSeriesRef.current =
        null;

      volumeSeriesRef.current =
        null;
    };
  }, [
    data,
    analysis,
  ]);

  return (
    <div
      ref={
        containerRef
      }
      className="
        relative
        w-full
        h-[430px]
        md:h-[520px]
      "
    />
  );
}

/* =========================================================
   TOP ZONES
========================================================= */

function getTopZones(
  zones: SRZone[],
  currentPrice: number,
  type:
    | "support"
    | "resistance"
): SRZone[] {
  const filtered =
    zones.filter(
      (zone) => {
        if (
          type ===
          "support"
        ) {
          return (
            zone.center <=
            currentPrice
          );
        }

        return (
          zone.center >
          currentPrice
        );
      }
    );

  return filtered
    .sort(
      (a, b) => {
        const distanceA =
          Math.abs(
            a.center -
              currentPrice
          );

        const distanceB =
          Math.abs(
            b.center -
              currentPrice
          );

        const scoreA =
          a.strength -
          (distanceA /
            Math.max(
              currentPrice,
              1
            )) *
            100;

        const scoreB =
          b.strength -
          (distanceB /
            Math.max(
              currentPrice,
              1
            )) *
            100;

        return (
          scoreB -
          scoreA
        );
      }
    )
    .slice(
      0,
      3
    );
}

/* =========================================================
   ZONE LINES
========================================================= */

function addZoneLines(
  series: ISeriesApi<"Candlestick">,
  zone: SRZone,
  label: string,
  type:
    | "support"
    | "resistance"
) {
  const isSupport =
    type ===
    "support";

  const mainColor =
    isSupport
      ? "rgba(16,185,129,0.75)"
      : "rgba(239,68,68,0.75)";

  const secondaryColor =
    isSupport
      ? "rgba(16,185,129,0.4)"
      : "rgba(239,68,68,0.4)";

  /* =======================================================
     CENTER
  ======================================================= */

  series.createPriceLine(
    {
      price:
        zone.center,

      color:
        mainColor,

      lineWidth:
        1,

      lineStyle:
        LineStyle.Solid,

      axisLabelVisible:
        true,

      title:
        `${label} ${zone.strength}`,
    }
  );

  /* =======================================================
     LOWER BOUNDARY
  ======================================================= */

  series.createPriceLine(
    {
      price:
        zone.low,

      color:
        secondaryColor,

      lineWidth:
        1,

      lineStyle:
        LineStyle.Dotted,

      axisLabelVisible:
        false,

      title:
        "",
    }
  );

  /* =======================================================
     UPPER BOUNDARY
  ======================================================= */

  series.createPriceLine(
    {
      price:
        zone.high,

      color:
        secondaryColor,

      lineWidth:
        1,

      lineStyle:
        LineStyle.Dotted,

      axisLabelVisible:
        false,

      title:
        "",
    }
  );
}