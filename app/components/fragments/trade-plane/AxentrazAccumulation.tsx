/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Database,
  Filter,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

const BROKER_CACHE_KEY = "idx-brokers-cache-v1";

const DEFAULT_MINIMUM_RATE = 20;

type BrokerOption = {
  broker_code: string;
  broker_id: number;
  broker_name: string;
  is_foreign?: boolean;
  source?: string;
};

type SymbolRow = {
  symbol_id: number;
  symbol: string;

  buy_lot: number;
  sell_lot: number;

  buy_val: number;
  sell_val: number;

  net_lot: number;
  net_val: number;

  active_day: number;
  active_buy_day: number;
  active_sell_day: number;

  peak_buy: number;
  peak_sell: number;
  avg_net: number;

  last_close: number;
  change_pct: number;

  ma20: number;
  dist_ma20: number;

  shares: number;
  free_float: number;

  accumulation: number;
  accumulation_rate: number;
};

type RateFilter = "all" | "20" | "40" | "60" | "100";

type ApiResponse = {
  success: boolean;
  broker_id?: number;

  from?: string;
  to?: string;

  accumulation_target?: number;
  minimum_rate?: number;

  fetched?: number;
  qualified?: number;

  skipped_ownership?: number;
  skipped_invalid?: number;

  data?: unknown;

  message?: string;
};

type ApiMeta = {
  fetched: number;
  qualified: number;
  skippedOwnership: number;
  skippedInvalid: number;
  minimumRate: number;
  accumulationTarget: number;
};

type UnknownRecord = Record<string, unknown>;

/* =========================================================
 * HELPERS
 * ========================================================= */

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatCompact(value: unknown): string {
  const number = toNumber(value);
  const absolute = Math.abs(number);

  if (absolute >= 1_000_000_000) {
    return `${(number / 1_000_000_000).toFixed(2)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(2)}M`;
  }

  if (absolute >= 1_000) {
    return `${(number / 1_000).toFixed(2)}K`;
  }

  return formatNumber(number);
}

function formatPrice(value: unknown): string {
  const number = toNumber(value);

  if (number === 0) {
    return "-";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDateInput(value: string): string {
  if (!value) {
    return "-";
  }

  const date = value.replaceAll("-", "");

  if (date.length !== 8) {
    return value;
  }

  return `${date.slice(6, 8)}-${date.slice(4, 6)}-${date.slice(0, 4)}`;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* =========================================================
 * BROKER PARSER
 * ========================================================= */

function getBrokerList(raw: unknown): BrokerOption[] {
  let parsed: unknown[] = [];

  if (Array.isArray(raw)) {
    parsed = raw;
  } else if (isRecord(raw)) {
    if (Array.isArray(raw.data)) {
      parsed = raw.data;
    } else if (Array.isArray(raw.brokers)) {
      parsed = raw.brokers;
    }
  }

  return parsed
    .map((item): BrokerOption | null => {
      if (!isRecord(item)) {
        return null;
      }

      const brokerId = toNumber(
        item.broker_id ??
          item.brokerId ??
          item.axentraz_broker_id
      );

      const brokerCode = toStringValue(
        item.broker_code ??
          item.code ??
          item.brokerCode
      )
        .trim()
        .toUpperCase();

      const brokerName = toStringValue(
        item.broker_name ??
          item.name ??
          item.brokerName
      ).trim();

      if (!brokerCode || brokerId <= 0) {
        return null;
      }

      return {
        broker_code: brokerCode,
        broker_id: brokerId,
        broker_name: brokerName,
        is_foreign:
          typeof item.is_foreign === "boolean"
            ? item.is_foreign
            : undefined,
        source:
          typeof item.source === "string"
            ? item.source
            : undefined,
      };
    })
    .filter(
      (item): item is BrokerOption => item !== null
    )
    .sort((a, b) =>
      a.broker_code.localeCompare(b.broker_code)
    );
}

/* =========================================================
 * SYMBOL PARSER
 * ========================================================= */

function normalizeSymbolRows(raw: unknown): SymbolRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item): SymbolRow | null => {
      if (!isRecord(item)) {
        return null;
      }

      const symbol = toStringValue(item.symbol)
        .trim()
        .toUpperCase();

      if (!symbol) {
        return null;
      }

      return {
        symbol_id: toNumber(item.symbol_id),
        symbol,

        buy_lot: toNumber(item.buy_lot),
        sell_lot: toNumber(item.sell_lot),

        buy_val: toNumber(item.buy_val),
        sell_val: toNumber(item.sell_val),

        net_lot: toNumber(item.net_lot),
        net_val: toNumber(item.net_val),

        active_day: toNumber(item.active_day),
        active_buy_day: toNumber(item.active_buy_day),
        active_sell_day: toNumber(item.active_sell_day),

        peak_buy: toNumber(item.peak_buy),
        peak_sell: toNumber(item.peak_sell),
        avg_net: toNumber(item.avg_net),

        last_close: toNumber(item.last_close),
        change_pct: toNumber(item.change_pct),

        ma20: toNumber(item.ma20),
        dist_ma20: toNumber(item.dist_ma20),

        shares: toNumber(item.shares),
        free_float: toNumber(item.free_float),

        accumulation: toNumber(item.accumulation),
        accumulation_rate: toNumber(
          item.accumulation_rate
        ),
      };
    })
    .filter(
      (item): item is SymbolRow => item !== null
    );
}

/* =========================================================
 * RATE FILTER
 * ========================================================= */

function getRateFilterLabel(filter: RateFilter): string {
  switch (filter) {
    case "20":
      return "Rate ≥ 20%";

    case "40":
      return "Rate ≥ 40%";

    case "60":
      return "Rate ≥ 60%";

    case "100":
      return "Rate 100%";

    default:
      return "Semua Rate";
  }
}

/* =========================================================
 * COMPONENT
 * ========================================================= */

export default function AxentrazAccumulation() {
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);

  const [selectedBroker, setSelectedBroker] =
    useState<string>("");

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [data, setData] = useState<SymbolRow[]>([]);

  const [rateFilter, setRateFilter] =
    useState<RateFilter>("all");

  const [loading, setLoading] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string>("");

  const [message, setMessage] =
    useState<string>("");

  const [apiMeta, setApiMeta] = useState<ApiMeta>({
    fetched: 0,
    qualified: 0,
    skippedOwnership: 0,
    skippedInvalid: 0,
    minimumRate: DEFAULT_MINIMUM_RATE,
    accumulationTarget: 5,
  });

  /* =======================================================
   * SELECTED BROKER
   * ======================================================= */

  const selectedBrokerData = useMemo(
    () =>
      brokers.find(
        (broker) =>
          broker.broker_code === selectedBroker
      ),
    [brokers, selectedBroker]
  );

  /* =======================================================
   * FILTERED DATA
   * ======================================================= */

  const filteredData = useMemo(() => {
    const rows = [...data];

    if (rateFilter !== "all") {
      const minimum = Number(rateFilter);

      rows.splice(
        0,
        rows.length,
        ...data.filter((row) => {
          const rate = row.accumulation_rate;

          if (rateFilter === "100") {
            return rate >= 100;
          }

          return rate >= minimum;
        })
      );
    }

    return rows.sort(
      (a, b) =>
        b.accumulation_rate -
          a.accumulation_rate ||
        b.accumulation - a.accumulation ||
        b.net_lot - a.net_lot
    );
  }, [data, rateFilter]);

  /* =======================================================
   * FILTER COUNTS
   * ======================================================= */

  const filterCount = useMemo(
    () => ({
      all: data.length,

      rate20: data.filter(
        (row) =>
          row.accumulation_rate >= 20
      ).length,

      rate40: data.filter(
        (row) =>
          row.accumulation_rate >= 40
      ).length,

      rate60: data.filter(
        (row) =>
          row.accumulation_rate >= 60
      ).length,

      rate100: data.filter(
        (row) =>
          row.accumulation_rate >= 100
      ).length,
    }),
    [data]
  );

  /* =======================================================
   * SUMMARY
   * ======================================================= */

  const summary = useMemo(() => {
    const totalNetLot = data.reduce(
      (sum, row) => sum + row.net_lot,
      0
    );

    const totalNetValue = data.reduce(
      (sum, row) => sum + row.net_val,
      0
    );

    const averageAccumulation =
      data.length > 0
        ? data.reduce(
            (sum, row) =>
              sum + row.accumulation,
            0
          ) / data.length
        : 0;

    const maxRate =
      data.length > 0
        ? Math.max(
            ...data.map(
              (row) => row.accumulation_rate
            )
          )
        : 0;

    return {
      totalNetLot,
      totalNetValue,
      averageAccumulation,
      maxRate,
    };
  }, [data]);

  /* =======================================================
   * LOAD BROKER CACHE + DEFAULT DATE
   * ======================================================= */

  useEffect(() => {
    try {
      const cached = localStorage.getItem(
        BROKER_CACHE_KEY
      );

      if (!cached) {
        setError(
          "Cache broker belum tersedia di localStorage."
        );
      } else {
        const parsed: unknown =
          JSON.parse(cached);

        const brokerList =
          getBrokerList(parsed);

        if (brokerList.length === 0) {
          setError(
            "Data broker di cache tidak memiliki broker_id yang valid."
          );
        } else {
          setBrokers(brokerList);
          setSelectedBroker(
            brokerList[0].broker_code
          );
        }
      }
    } catch (err) {
      console.error(
        "Gagal membaca cache broker:",
        err
      );

      setError(
        "Gagal membaca cache broker."
      );
    }

    const now = new Date();

    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    setFrom(formatDateForInput(start));
    setTo(formatDateForInput(now));
  }, []);

  /* =======================================================
   * FETCH AXENTRAZ
   * ======================================================= */

  async function fetchSymbols(): Promise<void> {
    setError("");
    setMessage("");
    setData([]);
    setRateFilter("all");

    if (!selectedBroker) {
      setError(
        "Pilih broker terlebih dahulu."
      );
      return;
    }

    if (!from || !to) {
      setError(
        "Tanggal from dan to wajib diisi."
      );
      return;
    }

    if (from > to) {
      setError(
        "Tanggal mulai tidak boleh lebih besar dari tanggal akhir."
      );
      return;
    }

    const broker = selectedBrokerData;

    if (!broker) {
      setError(
        `Broker ${selectedBroker} tidak ditemukan di cache.`
      );
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        brokerId: String(
          broker.broker_id
        ),
        from: from.replaceAll("-", ""),
        to: to.replaceAll("-", ""),
      });

      console.log(
        "[Axentraz] Fetch:",
        {
          broker: broker.broker_code,
          brokerId: broker.broker_id,
          from,
          to,
        }
      );

      const response = await fetch(
        `/api/axentraz/accumulation?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const rawResult: unknown =
        await response.json();

      if (!isRecord(rawResult)) {
        throw new Error(
          "Response API Axentraz tidak valid."
        );
      }

      const result =
        rawResult as ApiResponse;

      console.log(
        "[Axentraz] Response:",
        result
      );

      if (
        !response.ok ||
        result.success !== true
      ) {
        throw new Error(
          result.message ||
            "Gagal mengambil data Axentraz."
        );
      }

      const minimumRate =
        toNumber(
          result.minimum_rate
        ) || DEFAULT_MINIMUM_RATE;

      const accumulationTarget =
        toNumber(
          result.accumulation_target
        ) || 5;

      const rows =
        normalizeSymbolRows(
          result.data
        ).filter(
          (row) =>
            row.accumulation > 0 &&
            row.accumulation_rate >=
              minimumRate
        );

      setData(rows);

      setApiMeta({
        fetched: toNumber(
          result.fetched
        ),

        qualified: toNumber(
          result.qualified
        ),

        skippedOwnership:
          toNumber(
            result.skipped_ownership
          ),

        skippedInvalid:
          toNumber(
            result.skipped_invalid
          ),

        minimumRate,

        accumulationTarget,
      });

      setMessage(
        `Berhasil mengambil ${rows.length} saham dengan accumulation rate ≥ ${minimumRate}%.`
      );
    } catch (err) {
      console.error(
        "[Axentraz] Fetch error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data Axentraz."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
   * RENDER
   * ======================================================= */

  return (
    <div className="w-full">
      <div className="space-y-6 p-5 md:p-6">

        {/* HEADER */}

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />

            <h2 className="text-xl font-semibold tracking-tight">
              Broker Activity
            </h2>
          </div>

          <p className="text-sm text-muted-foreground">
            Daftar saham berdasarkan
            accumulation rate broker.
          </p>
        </div>

        {/* FILTER */}

        <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold">
              Filter Data
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              Pilih broker dan periode untuk
              mengambil aktivitas akumulasi.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">

            {/* BROKER */}

            <div className="space-y-2">
              <label
                htmlFor="broker"
                className="text-xs font-medium text-muted-foreground"
              >
                Broker
              </label>

              <select
                id="broker"
                value={selectedBroker}
                onChange={(event) =>
                  setSelectedBroker(
                    event.target.value
                  )
                }
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">
                  Pilih broker
                </option>

                {brokers.map(
                  (broker) => (
                    <option
                      key={`${broker.broker_code}-${broker.broker_id}`}
                      value={
                        broker.broker_code
                      }
                    >
                      {broker.broker_code}
                      {" - "}
                      {broker.broker_name}
                    </option>
                  )
                )}
              </select>

              {selectedBrokerData && (
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    Axentraz ID
                  </span>

                  <span className="font-mono">
                    {
                      selectedBrokerData.broker_id
                    }
                  </span>
                </div>
              )}
            </div>

            {/* FROM */}

            <div className="space-y-2">
              <label
                htmlFor="from"
                className="text-xs font-medium text-muted-foreground"
              >
                Dari tanggal
              </label>

              <input
                id="from"
                type="date"
                value={from}
                onChange={(event) =>
                  setFrom(
                    event.target.value
                  )
                }
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* TO */}

            <div className="space-y-2">
              <label
                htmlFor="to"
                className="text-xs font-medium text-muted-foreground"
              >
                Sampai tanggal
              </label>

              <input
                id="to"
                type="date"
                value={to}
                onChange={(event) =>
                  setTo(
                    event.target.value
                  )
                }
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* BUTTON */}

            <div className="flex items-end">
              <button
                type="button"
                onClick={fetchSymbols}
                disabled={
                  loading ||
                  !selectedBroker ||
                  !from ||
                  !to
                }
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}

                {loading
                  ? "Mengambil..."
                  : "Fetch Data"}
              </button>
            </div>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {message && !error && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
            {message}
          </div>
        )}

        {/* SUMMARY */}

        {data.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

            {/* QUALIFIED */}

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Qualified Stocks
                </span>

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
              </div>

              <p className="mt-3 text-xl font-semibold text-green-500">
                {data.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                accumulation rate ≥{" "}
                {apiMeta.minimumRate}%
              </p>
            </div>

            {/* HIGHEST RATE */}

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Highest Rate
                </span>

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
              </div>

              <p className="mt-3 text-xl font-semibold">
                {formatNumber(
                  summary.maxRate
                )}
                %
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                accumulation rate tertinggi
              </p>
            </div>

            {/* NET LOT */}

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Net Lot
                </span>

                {summary.totalNetLot >=
                0 ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                    <ArrowUp className="h-4 w-4 text-green-500" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                    <ArrowDown className="h-4 w-4 text-red-500" />
                  </div>
                )}
              </div>

              <p
                className={`mt-3 text-xl font-semibold ${
                  summary.totalNetLot >=
                  0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {summary.totalNetLot >=
                0
                  ? "+"
                  : ""}
                {formatCompact(
                  summary.totalNetLot
                )}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {selectedBroker} ·{" "}
                {formatDateInput(from)}
                {" — "}
                {formatDateInput(to)}
              </p>
            </div>

            {/* NET VALUE */}

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Net Value
                </span>

                <Database className="h-4 w-4 text-muted-foreground" />
              </div>

              <p
                className={`mt-3 text-xl font-semibold ${
                  summary.totalNetValue >=
                  0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {summary.totalNetValue >=
                0
                  ? "+"
                  : ""}
                Rp{" "}
                {formatCompact(
                  Math.abs(
                    summary.totalNetValue
                  )
                )}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                dari {apiMeta.fetched}{" "}
                symbol Axentraz
              </p>
            </div>
          </div>
        )}

        {/* DATA QUALITY */}

        {data.length > 0 &&
          apiMeta.skippedOwnership >
            0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Sebagian data ownership
                    tidak tersedia
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {
                      apiMeta.skippedOwnership
                    } saham tidak dihitung
                    karena data CSO / Free
                    Float tidak tersedia.
                  </p>
                </div>

                <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                  -
                  {
                    apiMeta.skippedOwnership
                  }{" "}
                  saham
                </span>
              </div>
            </div>
          )}

        {/* TABLE */}

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">

          {/* TABLE HEADER */}

          <div className="flex flex-col gap-4 border-b px-4 py-4 md:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">
                  Accumulation Stocks
                </h3>

                <p className="mt-1 text-xs text-muted-foreground">
                  Diurutkan berdasarkan
                  accumulation rate
                  tertinggi.
                </p>
              </div>

              <div className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                {filteredData.length} saham
              </div>
            </div>

            {/* RATE FILTER */}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
                  <Filter className="h-3.5 w-3.5" />
                </div>

                <div>
                  <span className="font-medium text-foreground">
                    Filter rate
                  </span>

                  <span className="ml-1.5">
                    ·{" "}
                    {getRateFilterLabel(
                      rateFilter
                    )}
                  </span>
                </div>
              </div>

              <div className="relative w-full sm:w-[260px]">
                <select
                  value={rateFilter}
                  onChange={(event) =>
                    setRateFilter(
                      event.target
                        .value as RateFilter
                    )
                  }
                  className="h-10 w-full appearance-none rounded-xl border border-border/70 bg-background px-3 pr-10 text-sm font-medium outline-none transition-all duration-200 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="all">
                    Semua Rate ({filterCount.all})
                  </option>

                  <option value="20">
                    Rate ≥ 20% ({filterCount.rate20})
                  </option>

                  <option value="40">
                    Rate ≥ 40% ({filterCount.rate40})
                  </option>

                  <option value="60">
                    Rate ≥ 60% ({filterCount.rate60})
                  </option>

                  <option value="100">
                    Rate 100% ({filterCount.rate100})
                  </option>
                </select>

                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* CONTENT */}

          {loading ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />

              <div className="text-center">
                <p className="text-sm font-medium">
                  Mengambil data...
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Menghubungi Axentraz
                  dan menghitung
                  accumulation.
                </p>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-5 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>

              <div>
                <p className="text-sm font-medium">
                  Belum ada data
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Pilih broker dan
                  periode, lalu tekan
                  Fetch Data.
                </p>
              </div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-5 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <Filter className="h-5 w-5 text-muted-foreground" />
              </div>

              <div>
                <p className="text-sm font-medium">
                  Tidak ada saham
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Tidak ada saham
                  dengan{" "}
                  <span className="font-medium text-foreground">
                    {getRateFilterLabel(
                      rateFilter
                    )}
                  </span>
                  .
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1450px] text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="sticky left-0 z-20 bg-muted/40 px-5 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Saham
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Accumulation
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Rate
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Net Lot
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Net Value
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Free Float
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      CSO
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">
                      Active
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Close
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Change
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      MA20
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Dist MA20
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredData.map(
                    (row) => {
                      const change =
                        row.change_pct;

                      const distMa20 =
                        row.dist_ma20;

                      return (
                        <tr
                          key={`${row.symbol_id}-${row.symbol}`}
                          className="border-b transition-colors last:border-0 hover:bg-muted/20"
                        >
                          {/* SYMBOL */}

                          <td className="sticky left-0 z-10 bg-card px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold tracking-wide">
                                {row.symbol}
                              </span>

                              <span className="rounded-md bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-green-500">
                                ACC
                              </span>
                            </div>
                          </td>

                          {/* ACCUMULATION */}

                          <td className="px-4 py-3 text-right font-semibold text-green-500 tabular-nums">
                            +
                            {formatNumber(
                              row.accumulation
                            )}
                            %
                          </td>

                          {/* RATE */}

                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex min-w-[72px] items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums ${
                                row.accumulation_rate >=
                                100
                                  ? "bg-green-500/15 text-green-500"
                                  : row.accumulation_rate >=
                                      60
                                    ? "bg-green-500/10 text-green-500"
                                    : "bg-primary/10 text-primary"
                              }`}
                            >
                              {formatNumber(
                                row.accumulation_rate
                              )}
                              %
                            </span>
                          </td>

                          {/* NET LOT */}

                          <td className="px-4 py-3 text-right font-semibold text-green-500 tabular-nums">
                            +
                            {formatCompact(
                              row.net_lot
                            )}
                          </td>

                          {/* NET VALUE */}

                          <td className="px-4 py-3 text-right font-semibold text-green-500 tabular-nums">
                            +Rp{" "}
                            {formatCompact(
                              Math.abs(
                                row.net_val
                              )
                            )}
                          </td>

                          {/* FREE FLOAT */}

                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatNumber(
                              row.free_float
                            )}
                            %
                          </td>

                          {/* CSO */}

                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCompact(
                              row.shares
                            )}
                          </td>

                          {/* ACTIVE */}

                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                              <span className="font-semibold">
                                {row.active_day}
                              </span>

                              <span className="text-green-500">
                                {
                                  row.active_buy_day
                                }
                                B
                              </span>

                              <span className="text-red-500">
                                {
                                  row.active_sell_day
                                }
                                S
                              </span>
                            </div>
                          </td>

                          {/* CLOSE */}

                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {formatPrice(
                              row.last_close
                            )}
                          </td>

                          {/* CHANGE */}

                          <td
                            className={`px-4 py-3 text-right font-medium tabular-nums ${
                              change > 0
                                ? "text-green-500"
                                : change < 0
                                  ? "text-red-500"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {change > 0
                              ? "+"
                              : ""}
                            {formatNumber(
                              change
                            )}
                            %
                          </td>

                          {/* MA20 */}

                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatPrice(
                              row.ma20
                            )}
                          </td>

                          {/* DIST MA20 */}

                          <td
                            className={`px-5 py-3 text-right font-medium tabular-nums ${
                              distMa20 > 0
                                ? "text-green-500"
                                : distMa20 < 0
                                  ? "text-red-500"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {distMa20 > 0
                              ? "+"
                              : ""}
                            {formatNumber(
                              distMa20
                            )}
                            %
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FOOTER */}

        {data.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Menampilkan{" "}
              <span className="font-semibold text-foreground">
                {filteredData.length}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-foreground">
                {data.length}
              </span>{" "}
              saham qualified.
            </span>

            <span>
              Minimum accumulation rate:{" "}
              <span className="font-semibold text-foreground">
                ≥ {apiMeta.minimumRate}%
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}