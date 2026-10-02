/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  BarChart3,
  CalendarDays,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from "lucide-react";

import StockChart from "./stockChart";
import TechnicalLevels from "./teknikal-levels";

import {
  calculateChange,
  formatCompactNumber,
  formatDate,
  formatPrice,
  getPeriodStart,
} from "./stock-chart-utils";

import {
  analyzeSupportResistance,
} from "./support-resistance";

/* =========================================================
   TYPES
========================================================= */

type ChartPeriod =
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "ALL";

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

type ApiResponse = {
  success: boolean;

  code: string;

  startDate: string;

  endDate: string | null;

  count: number;

  data: StockHistory[];

  error?: string;
};

type StockChartCardProps = {
  code: string;
};

/* =========================================================
   COMPANY
========================================================= */

type CompanyData = {
  exchange: string;
  symbol: string;
  name: string;
  iconUrl: string | null;
  subSector: string | null;
};

type CompanyCache = Record<
  string,
  CompanyData
>;

const COMPANY_CACHE_KEY =
  "manns_company";

/* =========================================================
   PERIODS
========================================================= */

const PERIODS: {
  value: ChartPeriod;
  label: string;
}[] = [
  {
    value: "1M",
    label: "1M",
  },
  {
    value: "3M",
    label: "3M",
  },
  {
    value: "6M",
    label: "6M",
  },
  {
    value: "YTD",
    label: "YTD",
  },
  {
    value: "ALL",
    label: "ALL",
  },
];

/* =========================================================
   COMPANY CACHE HELPER
========================================================= */

function getCachedCompany(
  code: string
): CompanyData | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  const normalizedCode =
    code.trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  try {
    const cached =
      localStorage.getItem(
        COMPANY_CACHE_KEY
      );

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(
      cached
    );

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const companyCache =
      parsed as CompanyCache;

    const company =
      companyCache[
        normalizedCode
      ];

    if (
      !company ||
      typeof company !== "object"
    ) {
      return null;
    }

    return {
      exchange:
        company.exchange ??
        "IDX",

      symbol:
        company.symbol ??
        normalizedCode,

      name:
        company.name ??
        normalizedCode,

      iconUrl:
        company.iconUrl ??
        null,

      subSector:
        company.subSector ??
        null,
    };
  } catch (error) {
    console.warn(
      "[StockChartCard] Gagal membaca cache emiten:",
      error
    );

    return null;
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function StockChartCard({
  code,
}: StockChartCardProps) {
  const normalizedCode =
    code.trim().toUpperCase();

  /* =======================================================
     COMPANY
  ======================================================= */

  const [company, setCompany] =
    useState<CompanyData | null>(
      null
    );

  /* =======================================================
     CHART
  ======================================================= */

  const [period, setPeriod] =
    useState<ChartPeriod>("ALL");

  const [data, setData] =
    useState<StockHistory[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /* =======================================================
     SUPPORT / RESISTANCE ENGINE
  ======================================================= */

  const srAnalysis = useMemo(
    () =>
      analyzeSupportResistance(
        data
      ),
    [data]
  );

  /* =======================================================
     LOAD COMPANY
  ======================================================= */

  useEffect(() => {
    const cachedCompany =
      getCachedCompany(
        normalizedCode
      );

    setCompany(cachedCompany);
  }, [normalizedCode]);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const loadData = useCallback(
    async (
      showRefresh = false
    ) => {
      if (!normalizedCode) {
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const controller =
        new AbortController();

      try {
        const startDate =
          getPeriodStart(period);

        const url =
          `/api/stocks/${encodeURIComponent(
            normalizedCode
          )}/history` +
          `?start=${encodeURIComponent(
            startDate
          )}`;

        const response =
          await fetch(url, {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
            signal:
              controller.signal,
          });

        const result =
          (await response.json()) as ApiResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ??
              `HTTP ${response.status}`
          );
        }

        const sorted = [
          ...(result.data ?? []),
        ]
          .filter(
            (item) =>
              item &&
              item.date &&
              Number.isFinite(
                item.open
              ) &&
              Number.isFinite(
                item.high
              ) &&
              Number.isFinite(
                item.low
              ) &&
              Number.isFinite(
                item.close
              ) &&
              Number.isFinite(
                item.volume
              ) &&
              item.high >=
                item.low &&
              item.close > 0
          )
          .sort(
            (a, b) =>
              a.date.localeCompare(
                b.date
              )
          );

        setData(sorted);
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "[StockChartCard]",
          err
        );

        setData([]);

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil data saham"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [normalizedCode, period]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    if (data.length === 0) {
      return null;
    }

    const first =
      data[0];

    const last =
      data[data.length - 1];

    const previous =
      data.length > 1
        ? data[data.length - 2]
        : undefined;

    const dailyChange =
      calculateChange(
        previous?.close,
        last.close
      );

    const periodChange =
      calculateChange(
        first.close,
        last.close
      );

    const high =
      Math.max(
        ...data.map(
          (item) =>
            item.high
        )
      );

    const low =
      Math.min(
        ...data.map(
          (item) =>
            item.low
        )
      );

    const totalVolume =
      data.reduce(
        (sum, item) =>
          sum +
          (Number.isFinite(
            item.volume
          )
            ? item.volume
            : 0),
        0
      );

    const averageVolume =
      data.length > 0
        ? totalVolume /
          data.length
        : 0;

    const latestVolume =
      Number.isFinite(
        last.volume
      )
        ? last.volume
        : 0;

    const volumeRatio =
      averageVolume > 0
        ? latestVolume /
          averageVolume
        : 0;

    return {
      first,
      last,
      previous,

      dailyChange,
      periodChange,

      high,
      low,

      totalVolume,
      averageVolume,
      latestVolume,
      volumeRatio,
    };
  }, [data]);

  const isPeriodPositive =
    (stats?.periodChange ?? 0) >= 0;

  /* =======================================================
     ANALYSIS STATUS
  ======================================================= */

  const analysisReady =
    Boolean(
      srAnalysis &&
        data.length >= 20
    );

  const analysisDataShort =
    Boolean(
      !loading &&
        !error &&
        data.length > 0 &&
        data.length < 20
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section
      className="
        relative
        w-full
        overflow-hidden
        rounded-2xl
        border
        border-zinc-200
        bg-white
        shadow-[0_20px_80px_rgba(0,0,0,0.08)]
        dark:border-white/[0.07]
        dark:bg-[#09090b]
        dark:shadow-[0_20px_80px_rgba(0,0,0,0.35)]
      "
    >
      {/* ===================================================
          CHART AREA
      ================================================== */}

      <div
        className="
          relative
          overflow-hidden
          bg-zinc-50
          dark:bg-[#08080a]
        "
      >
        {/* =================================================
            MINIMAL CHART HEADER
        ================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            left-3
            right-3
            top-2
            z-20
            sm:left-4
            sm:right-4
            sm:top-2.5
          "
        >
          <div
            className="
              flex
              min-w-0
              items-center
              gap-2
            "
          >
            {/* =============================================
                EMITEN
            ============================================== */}

            <div
              className="
                min-w-0
                shrink-0
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-1.5
                  leading-none
                "
              >
                <span
                  className="
                    text-[11px]
                    font-bold
                    tracking-tight
                    dark:text-zinc-200
                    sm:text-xs
                  "
                >
                  {normalizedCode}
                </span>

                <span
                  className="
                    text-[7px]
                    font-semibold
                    uppercase
                    tracking-[0.12em]
                    text-[#a88916]
                    dark:text-[#d4af37]
                  "
                >
                  {company?.exchange ??
                    "IDX"}
                </span>
              </div>

              <div
                className="
                  mt-0.5
                  max-w-[145px]
                  truncate
                  text-[7px]
                  leading-none
                  text-zinc-500
                  dark:text-zinc-300
                  sm:max-w-[190px]
                  sm:text-[8px]
                "
              >
                {company?.name ??
                  "Nama emiten belum tersedia"}
              </div>
            </div>

            {/* =============================================
                SEPARATOR
            ============================================== */}

            <div
              className="
                h-5
                w-px
                shrink-0
                bg-zinc-300/70
                dark:bg-white/[0.10]
              "
            />

            {/* =============================================
                PERIOD
            ============================================== */}

            <div
              className="
                pointer-events-auto
                flex
                min-w-0
                items-center
                gap-0.5
              "
            >
              <CalendarDays
                size={9}
                className="
                  mr-0.5
                  shrink-0
                  text-zinc-400
                  dark:text-zinc-600
                "
              />

              {PERIODS.map(
                (item) => {
                  const active =
                    period ===
                    item.value;

                  return (
                    <button
                      key={
                        item.value
                      }
                      type="button"
                      onClick={() =>
                        setPeriod(
                          item.value
                        )
                      }
                      className={`
                        relative
                        shrink-0
                        px-1.5
                        py-1
                        text-[8px]
                        font-semibold
                        tracking-wide
                        transition-all
                        sm:px-2
                        sm:text-[9px]
                        ${
                          active
                            ? `
                              text-[#b28f16]
                              dark:text-[#d4af37]
                            `
                            : `
                              text-zinc-400
                              hover:text-zinc-700
                              dark:text-zinc-600
                              dark:hover:text-zinc-300
                            `
                        }
                      `}
                    >
                      {item.label}

                      {active && (
                        <span
                          className="
                            absolute
                            bottom-0
                            left-1.5
                            right-1.5
                            h-px
                            bg-[#d4af37]
                            shadow-[0_0_6px_rgba(212,175,55,0.55)]
                            sm:left-2
                            sm:right-2
                          "
                        />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* =================================================
            CHART LEGEND
        ================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            bottom-4
            left-4
            z-10
            hidden
            items-center
            gap-4
            rounded-lg
            border
            border-zinc-200/70
            bg-white/75
            px-3
            py-2
            shadow-sm
            backdrop-blur-md
            dark:border-white/[0.06]
            dark:bg-black/35
            sm:flex
          "
        >
          <div
            className="
              flex
              items-center
              gap-1.5
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                rounded-full
                bg-emerald-400
              "
            />

            <span
              className="
                text-[9px]
                text-zinc-500
              "
            >
              UP
            </span>
          </div>

          <div
            className="
              flex
              items-center
              gap-1.5
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                rounded-full
                bg-red-400
              "
            />

            <span
              className="
                text-[9px]
                text-zinc-500
              "
            >
              DOWN
            </span>
          </div>

          <div
            className="
              flex
              items-center
              gap-1.5
            "
          >
            <BarChart3
              size={10}
              className="
                text-zinc-400
                dark:text-zinc-600
              "
            />

            <span
              className="
                text-[9px]
                text-zinc-500
              "
            >
              VOLUME
            </span>
          </div>
        </div>

        {/* =================================================
            CHART
        ================================================== */}

        {loading ? (
          <ChartSkeleton />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() =>
              void loadData(true)
            }
          />
        ) : data.length ===
          0 ? (
          <EmptyState
            code={normalizedCode}
          />
        ) : (
          <StockChart
            data={data}
            analysis={srAnalysis}
          />
        )}
      </div>

      {/* ===================================================
          MARKET STATS
      ================================================== */}

      {stats && !loading && (
        <div
          className="
            grid
            grid-cols-2
            border-b
            border-zinc-200
            bg-white
            sm:grid-cols-4
            lg:grid-cols-6
            dark:border-white/[0.05]
            dark:bg-[#0b0b0d]
          "
        >
          <StatItem
            label="Period"
            value={
              stats.periodChange >=
              0
                ? `+${stats.periodChange.toFixed(
                    2
                  )}%`
                : `${stats.periodChange.toFixed(
                    2
                  )}%`
            }
            positive={
              isPeriodPositive
            }
          />

          <StatItem
            label="High"
            value={formatPrice(
              stats.high
            )}
          />

          <StatItem
            label="Low"
            value={formatPrice(
              stats.low
            )}
          />

          <StatItem
            label="Volume"
            value={formatCompactNumber(
              stats.totalVolume
            )}
          />

          <StatItem
            label="From"
            value={formatDate(
              data[0].date
            )}
          />

          <StatItem
            label="To"
            value={formatDate(
              data[
                data.length - 1
              ].date
            )}
          />
        </div>
      )}

      {/* ===================================================
          VOLUME INTELLIGENCE
      ================================================== */}

      {stats &&
        !loading &&
        !error &&
        data.length > 0 && (
          <div
            className="
              border-b
              border-zinc-200
              bg-zinc-50/60
              px-4
              py-3
              dark:border-white/[0.05]
              dark:bg-[#0a0a0c]
              md:px-6
            "
          >
            <div
              className="
                flex
                flex-wrap
                items-center
                gap-x-5
                gap-y-2
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <div
                  className="
                    flex
                    h-7
                    w-7
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-[#d4af37]/15
                    bg-[#d4af37]/[0.05]
                  "
                >
                  <BarChart3
                    size={13}
                    className="
                      text-[#a88916]
                      dark:text-[#d4af37]
                    "
                  />
                </div>

                <div>
                  <div
                    className="
                      text-[8px]
                      font-semibold
                      uppercase
                      tracking-[0.16em]
                      text-zinc-400
                      dark:text-zinc-600
                    "
                  >
                    Volume Intelligence
                  </div>

                  <div
                    className="
                      text-[10px]
                      font-medium
                      text-zinc-700
                      dark:text-zinc-300
                    "
                  >
                    Current vs average
                  </div>
                </div>
              </div>

              <MiniMetric
                label="Latest"
                value={formatCompactNumber(
                  stats.latestVolume
                )}
              />

              <MiniMetric
                label="Avg"
                value={formatCompactNumber(
                  stats.averageVolume
                )}
              />

              <MiniMetric
                label="Ratio"
                value={`${stats.volumeRatio.toFixed(
                  2
                )}x`}
                positive={
                  stats.volumeRatio >=
                  1.5
                    ? true
                    : stats.volumeRatio <
                        0.7
                      ? false
                      : undefined
                }
              />

              <div
                className="
                  ml-auto
                  hidden
                  items-center
                  gap-1.5
                  text-[9px]
                  text-zinc-400
                  dark:text-zinc-600
                  md:flex
                "
              >
                <span
                  className="
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-[#d4af37]
                  "
                />

                Volume digunakan sebagai
                konfirmasi struktur.
              </div>
            </div>
          </div>
        )}

      {/* ===================================================
          TECHNICAL INTELLIGENCE
      ================================================== */}

      {!loading &&
        !error &&
        data.length > 0 && (
          <div
            className="
              border-b
              border-zinc-200
              bg-zinc-50/70
              dark:border-white/[0.05]
              dark:bg-[#0b0b0d]
            "
          >
            {srAnalysis &&
            data.length >= 20 ? (
              <TechnicalLevels
                analysis={
                  srAnalysis
                }
              />
            ) : analysisDataShort ? (
              <TechnicalDataShort
                count={
                  data.length
                }
              />
            ) : (
              <TechnicalNoStructure />
            )}
          </div>
        )}

      {/* ===================================================
          FOOTER
      ================================================== */}

      {stats && !loading && (
        <div
          className="
            flex
            flex-col
            gap-2
            border-t
            border-zinc-200
            bg-zinc-50
            px-4
            py-3
            text-[10px]
            text-zinc-400
            dark:border-white/[0.05]
            dark:bg-[#0c0c0e]
            dark:text-zinc-600
            sm:flex-row
            sm:items-center
            sm:justify-between
            md:px-6
          "
        >
          <div>
            {data.length} trading
            days
            {" · "}
            {formatDate(
              data[0].date
            )}
            {" → "}
            {formatDate(
              data[
                data.length - 1
              ].date
            )}
          </div>

          <div>
            Source:{" "}
            <span
              className="
                text-zinc-500
                dark:text-zinc-500
              "
            >
              {stats.last.source ??
                "Firestore"}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   STAT ITEM
========================================================= */

function StatItem({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div
      className="
        border-r
        border-b
        border-zinc-200
        px-4
        py-3
        last:border-r-0
        lg:border-b-0
        dark:border-white/[0.04]
      "
    >
      <div
        className="
          text-[9px]
          uppercase
          tracking-[0.14em]
          text-zinc-400
          dark:text-zinc-600
        "
      >
        {label}
      </div>

      <div
        className={`
          mt-1
          text-xs
          font-semibold
          ${
            positive === undefined
              ? `
                text-zinc-700
                dark:text-zinc-300
              `
              : positive
                ? `
                  text-emerald-500
                  dark:text-emerald-400
                `
                : `
                  text-red-500
                  dark:text-red-400
                `
          }
        `}
      >
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   MINI METRIC
========================================================= */

function MiniMetric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-2
      "
    >
      <span
        className="
          text-[8px]
          uppercase
          tracking-wider
          text-zinc-400
          dark:text-zinc-600
        "
      >
        {label}
      </span>

      <span
        className={`
          text-[10px]
          font-semibold
          ${
            positive === undefined
              ? `
                text-zinc-600
                dark:text-zinc-400
              `
              : positive
                ? `
                  text-emerald-500
                  dark:text-emerald-400
                `
                : `
                  text-red-500
                  dark:text-red-400
                `
          }
        `}
      >
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   TECHNICAL DATA SHORT
========================================================= */

function TechnicalDataShort({
  count,
}: {
  count: number;
}) {
  return (
    <div
      className="
        px-4
        py-5
        md:px-6
      "
    >
      <div
        className="
          relative
          overflow-hidden
          rounded-xl
          border
          border-[#d4af37]/15
          bg-[#d4af37]/[0.035]
          p-4
          dark:bg-[#d4af37]/[0.025]
        "
      >
        {/* decorative glow */}

        <div
          className="
            pointer-events-none
            absolute
            -right-10
            -top-10
            h-28
            w-28
            rounded-full
            bg-[#d4af37]/[0.08]
            blur-3xl
          "
        />

        <div
          className="
            relative
            flex
            flex-col
            gap-3
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <div
              className="
                flex
                items-center
                gap-1.5
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.18em]
                text-[#a88916]
                dark:text-[#d4af37]
              "
            >
              <Sparkles
                size={11}
              />

              Technical Intelligence
            </div>

            <div
              className="
                mt-1
                text-sm
                font-medium
                text-zinc-800
                dark:text-zinc-200
              "
            >
              Membangun market structure
            </div>

            <div
              className="
                mt-1
                text-xs
                text-zinc-500
                dark:text-zinc-600
              "
            >
              Engine membutuhkan minimal
              20 trading days. Saat ini{" "}
              <span
                className="
                  font-semibold
                  text-zinc-700
                  dark:text-zinc-400
                "
              >
                {count}
              </span>{" "}
              hari.
            </div>
          </div>

          <div
            className="
              flex
              shrink-0
              items-center
              gap-2
            "
          >
            <div
              className="
                h-1.5
                w-1.5
                rounded-full
                bg-[#d4af37]
                shadow-[0_0_10px_rgba(212,175,55,0.45)]
              "
            />

            <span
              className="
                text-[10px]
                font-semibold
                text-zinc-500
              "
            >
              {count}/20
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TECHNICAL NO STRUCTURE
========================================================= */

function TechnicalNoStructure() {
  return (
    <div
      className="
        px-4
        py-5
        md:px-6
      "
    >
      <div
        className="
          rounded-xl
          border
          border-zinc-200
          bg-white
          p-4
          dark:border-white/[0.06]
          dark:bg-white/[0.02]
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <div
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-lg
              border
              border-zinc-200
              bg-zinc-50
              dark:border-white/[0.06]
              dark:bg-white/[0.025]
            "
          >
            <Activity
              size={13}
              className="
                text-zinc-400
                dark:text-zinc-600
              "
            />
          </div>

          <div>
            <div
              className="
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.18em]
                text-[#a88916]
                dark:text-[#d4af37]
              "
            >
              Technical Intelligence
            </div>

            <div
              className="
                mt-0.5
                text-xs
                text-zinc-600
                dark:text-zinc-400
              "
            >
              Belum ada struktur support/
              resistance yang cukup kuat.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function ChartSkeleton() {
  return (
    <div
      className="
        relative
        h-[470px]
        animate-pulse
        bg-gradient-to-b
        from-zinc-100
        via-zinc-50
        to-transparent
        dark:from-white/[0.018]
        dark:via-white/[0.008]
        dark:to-transparent
        md:h-[560px]
      "
    >
      {/* minimal fake header */}

      <div
        className="
          absolute
          left-4
          top-3
          flex
          items-center
          gap-2
        "
      >
        <div
          className="
            h-3
            w-10
            rounded
            bg-zinc-200/70
            dark:bg-white/[0.035]
          "
        />

        <div
          className="
            h-2
            w-16
            rounded
            bg-zinc-200/50
            dark:bg-white/[0.025]
          "
        />

        <div
          className="
            ml-2
            h-3
            w-20
            rounded
            bg-zinc-200/50
            dark:bg-white/[0.025]
          "
        />
      </div>

      {/* fake chart grid */}

      <div
        className="
          absolute
          bottom-12
          left-4
          right-4
          top-12
          rounded-xl
          border
          border-zinc-200/50
          bg-gradient-to-t
          from-zinc-200/[0.18]
          via-transparent
          to-transparent
          dark:border-white/[0.025]
          dark:from-white/[0.015]
        "
      />

      <div
        className="
          flex
          h-full
          items-center
          justify-center
        "
      >
        <div
          className="
            flex
            flex-col
            items-center
            gap-3
          "
        >
          <div
            className="
              h-8
              w-8
              rounded-full
              border
              border-[#d4af37]/20
              border-t-[#d4af37]
              animate-spin
            "
          />

          <span
            className="
              text-xs
              text-zinc-400
              dark:text-zinc-600
            "
          >
            Loading market intelligence...
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY
========================================================= */

function EmptyState({
  code,
}: {
  code: string;
}) {
  return (
    <div
      className="
        flex
        h-[470px]
        flex-col
        items-center
        justify-center
        gap-3
        md:h-[560px]
      "
    >
      <div
        className="
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          border
          border-zinc-200
          bg-white
          shadow-sm
          dark:border-white/[0.07]
          dark:bg-white/[0.025]
        "
      >
        <BarChart3
          size={22}
          className="
            text-zinc-400
            dark:text-zinc-600
          "
        />
      </div>

      <div className="text-center">
        <div
          className="
            text-sm
            font-medium
            text-zinc-600
            dark:text-zinc-400
          "
        >
          Data histori belum tersedia
        </div>

        <div
          className="
            mt-1
            text-xs
            text-zinc-400
            dark:text-zinc-600
          "
        >
          Tidak ada data untuk{" "}
          {code}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ERROR
========================================================= */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="
        flex
        h-[470px]
        flex-col
        items-center
        justify-center
        gap-4
        px-6
        md:h-[560px]
      "
    >
      <div
        className="
          rounded-xl
          border
          border-red-500/10
          bg-red-500/[0.04]
          px-4
          py-3
          text-center
        "
      >
        <div
          className="
            flex
            items-center
            justify-center
            gap-2
            text-sm
            font-medium
            text-red-500
            dark:text-red-400
          "
        >
          <TrendingDown
            size={14}
          />

          Gagal mengambil data
        </div>

        <div
          className="
            mt-1
            max-w-md
            text-xs
            text-zinc-500
            dark:text-zinc-600
          "
        >
          {message}
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="
          flex
          items-center
          gap-2
          rounded-lg
          border
          border-zinc-200
          bg-zinc-50
          px-4
          py-2
          text-xs
          font-medium
          text-zinc-500
          transition
          hover:bg-zinc-100
          hover:text-zinc-900
          dark:border-white/[0.07]
          dark:bg-white/[0.03]
          dark:text-zinc-400
          dark:hover:bg-white/[0.07]
          dark:hover:text-zinc-100
        "
      >
        <RefreshCw
          size={14}
        />

        Coba lagi
      </button>
    </div>
  );
}