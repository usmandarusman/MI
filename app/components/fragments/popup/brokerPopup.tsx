
"use client";

import { useEffect, useState } from "react";
import {
  X,
  TrendingUp,
  Wallet,
  Users,
  Layers3,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

type BrokerPopupProps = {
  emiten: string;
  freeFloat: string;
  cso: string;
  netBuy: string;
  broker: string;
  accumulation: number;
  onClose: () => void;
};

type CompanyData = {
  provider: string;
  code: string;
  name: string;
  exchange: string;
  logo: string | null;
  sector: string | null;
  subSector: string | null;
};

type StockbitProfileResponse = {
  project: string;
  data: {
    provider: string;
    symbol: string;
    name: string;
    companyId: string;
    sector: string | null;
    subSector: string | null;
    exchange: string;
    iconUrl: string | null;
    background?: string;
    listingStatus?: string;
    tradeable?: boolean;
  };
  timestamp: string;
  error?: string;
};

export const BrokerPopup = ({
  emiten,
  freeFloat,
  cso,
  netBuy,
  broker,
  accumulation,
  onClose,
}: BrokerPopupProps) => {
  const ACCUMULATION_TARGET = 5;

  const [isClosing, setIsClosing] = useState(false);

  // State data emiten dari Stockbit API
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // Fetch profil emiten berdasarkan kode saham
  useEffect(() => {
    const controller = new AbortController();

    const fetchCompany = async () => {
      setCompanyLoading(true);
      setCompanyError(null);
      setCompany(null);

      try {
        const response = await fetch(
          `/api/profile?code=${encodeURIComponent(emiten.trim())}`,
          { signal: controller.signal }
        );

        const result: StockbitProfileResponse = await response.json();

        console.log("Stockbit Profile:", result);

        if (!response.ok) {
          throw new Error(
            result.error ?? "Gagal mengambil data emiten"
          );
        }

        // Struktur JSON Stockbit: result.data
        const profile = result?.data;

        if (!profile?.symbol) {
          throw new Error(
            `Data emiten ${emiten} tidak ditemukan`
          );
        }

        // Mapping data Stockbit ke CompanyData
        const companyData: CompanyData = {
          provider: profile.provider ?? "stockbit",
          code: profile.symbol,
          name: profile.name,
          exchange: profile.exchange,
          logo: profile.iconUrl || null,
          sector: profile.sector || null,
          subSector: profile.subSector || null,
        };

        setCompany(companyData);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        setCompanyError(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan"
        );
      } finally {
        if (!controller.signal.aborted) {
          setCompanyLoading(false);
        }
      }
    };

    if (emiten.trim()) {
      fetchCompany();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompanyLoading(false);
    }

    return () => controller.abort();
  }, [emiten]);

  const closePopup = () => {
    if (isClosing) return;
    setIsClosing(true);
  };

  const accumulationRate = Math.min(
    (Math.abs(accumulation) / ACCUMULATION_TARGET) * 100,
    100
  );

  const isPositive = accumulation > 0;
  const isNegative = accumulation < 0;
  const isNetBuyPositive = !netBuy.trim().startsWith("-");

  const status = isPositive
    ? "AKUMULASI"
    : isNegative
      ? "DISTRIBUSI"
      : "NETRAL";

  const accentColor = isPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : isNegative
      ? "text-rose-600 dark:text-rose-400"
      : "text-zinc-500 dark:text-zinc-400";

  const progressColor = isPositive
    ? "bg-emerald-500"
    : isNegative
      ? "bg-rose-500"
      : "bg-zinc-400";

  const statusStyle = isPositive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
    : isNegative
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400"
      : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";

  const cardStyle =
    "rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-white/[0.07] dark:bg-[#0e1420]";

  const labelStyle =
    "flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-500";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center
        overflow-y-auto bg-zinc-950/50 p-3 backdrop-blur-md
        dark:bg-black/75 sm:p-5"
      onClick={closePopup}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-popup-title"
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget) return;

          if (isClosing && e.animationName === "popupZoomOut") {
            onClose();
          }
        }}
        className={`relative my-auto w-full max-w-xl
          overflow-hidden rounded-3xl border border-zinc-200
          bg-[#f8fafc] text-zinc-900
          shadow-[0_24px_100px_-20px_rgba(0,0,0,0.35)]
          dark:border-white/[0.09] dark:bg-[#090d14] dark:text-white
          ${
            isClosing
              ? "animate-popup-zoom-out"
              : "animate-popup-zoom-in"
          }`}
      >
        {/* TOP ACCENT */}
        <div
          className="h-[3px] w-full bg-gradient-to-r
          from-amber-500 via-yellow-300 to-emerald-400"
        />

        {/* HEADER */}
        <div
          className="flex items-center justify-between border-b
          border-zinc-200/80 px-5 py-5 dark:border-white/[0.07]
          sm:px-6"
        >
          <div className="flex min-w-0 items-center gap-3">
            {/* LOGO EMITEN */}
            <div
              className="flex h-12 w-12 shrink-0 items-center
              justify-center overflow-hidden rounded-2xl border
              border-amber-200 bg-amber-50
              dark:border-amber-400/20 dark:bg-amber-400/[0.08]"
            >
              {company?.logo ? (
                <img
                  src={company.logo}
                  alt={`${company.code} logo`}
                  className="h-full w-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Building2
                  className="h-5 w-5 text-amber-600
                  dark:text-amber-400"
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="broker-popup-title"
                  className="text-lg font-bold tracking-tight
                    text-zinc-900 dark:text-white sm:text-xl"
                >
                  {emiten}
                </h2>

                <span
                  className="rounded-md border border-amber-200
                  bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold
                  tracking-wider text-amber-700
                  dark:border-amber-400/20 dark:bg-amber-400/10
                  dark:text-amber-400"
                >
                  {company?.exchange ?? company?.provider}
                </span>
              </div>

              {/* DATA EMITEN DARI STOCKBIT */}
              <div className="mt-1 space-y-0.5">
                <p className="truncate text-xs text-zinc-500">
                  {companyLoading
                    ? "Memuat data emiten..."
                    : company?.name ?? "Nama emiten tidak tersedia"}
                </p>

                <p className="text-[10px] text-zinc-400">
                  {company?.subSector ?? "Subsektor tidak tersedia"}
                </p>

                {companyError && (
                  <p className="text-[10px] text-rose-500">
                    {companyError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closePopup}
            aria-label="Tutup popup"
            disabled={isClosing}
            className="ml-3 rounded-xl border border-zinc-200
              bg-white p-2 text-zinc-500 transition
              hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600
              dark:border-white/[0.08] dark:bg-white/[0.03]
              dark:text-zinc-400 dark:hover:border-rose-500/20
              dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          >
            <X size={17} />
          </button>
        </div>

        {/* BODY */}
        <div className="space-y-4 p-4 sm:p-6">
          {/* ACCUMULATION RATE HERO */}
          <div
            className={`relative overflow-hidden rounded-2xl
            border p-5 ${
              isPositive
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-500/20 dark:from-emerald-500/[0.09] dark:to-[#0c121b]"
                : isNegative
                  ? "border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:border-rose-500/20 dark:from-rose-500/[0.09] dark:to-[#0c121b]"
                  : "border-zinc-200 bg-gradient-to-br from-zinc-100 to-white dark:border-white/[0.08] dark:from-zinc-500/[0.08] dark:to-[#0c121b]"
            }`}
          >
            {/* Decorative glow */}
            <div
              className="pointer-events-none absolute -right-12
              -top-16 h-40 w-40 rounded-full bg-emerald-400/[0.08]
              blur-3xl dark:bg-emerald-400/[0.10]"
            />

            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className={labelStyle}>
                  <TrendingUp size={14} />
                  Accumulation Rate
                </div>

                <span
                  className={`rounded-full border px-2.5 py-1
                  text-[9px] font-bold tracking-wider ${statusStyle}`}
                >
                  {status}
                </span>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <div
                    className={`text-4xl font-bold
                    tracking-[-0.05em] tabular-nums sm:text-5xl
                    ${accentColor}`}
                  >
                    {accumulationRate.toFixed(2)}
                    <span className="ml-1 text-xl">%</span>
                  </div>

                  <p className="mt-2 text-[11px] text-zinc-500">
                    Intensity score · Target {ACCUMULATION_TARGET}%
                  </p>
                </div>

                <div
                  className={`mb-1 flex h-10 w-10 shrink-0
                  items-center justify-center rounded-xl
                  border border-zinc-200/70 bg-white/80
                  dark:border-white/[0.08] dark:bg-white/[0.04]
                  ${accentColor}`}
                >
                  {isPositive ? (
                    <ArrowUpRight size={21} />
                  ) : isNegative ? (
                    <ArrowDownRight size={21} />
                  ) : (
                    <Minus size={21} />
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="mt-5">
                <div
                  className="h-2 overflow-hidden rounded-full
                  bg-zinc-200 dark:bg-white/[0.07]"
                >
                  <div
                    className={`h-full rounded-full
                      transition-all duration-500 ${progressColor}`}
                    style={{ width: `${accumulationRate}%` }}
                  />
                </div>

                <div
                  className="mt-2 flex items-center
                  justify-between text-[10px] text-zinc-500"
                >
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACCUMULATION + NET BUY */}
          <div className="grid grid-cols-2 gap-3">
            {/* ACCUMULATION */}
            <div className={cardStyle}>
              <div className={labelStyle}>
                <TrendingUp size={14} />
                Accumulation
              </div>

              <div
                className={`mt-4 break-words text-xl font-bold
                tracking-tight tabular-nums sm:text-2xl
                ${accentColor}`}
              >
                {accumulation > 0 ? "+" : ""}
                {accumulation.toFixed(2)}%
              </div>

              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Akumulasi bersih
              </p>
            </div>

            {/* NET BUY */}
            <div className={cardStyle}>
              <div className={labelStyle}>
                <Wallet size={14} />
                Net Buy
              </div>

              <div
                className={`mt-4 break-words text-xl font-bold
                tracking-tight tabular-nums sm:text-2xl ${
                  isNetBuyPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {netBuy}
              </div>

              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Nilai bersih transaksi
              </p>
            </div>
          </div>

          {/* FREE FLOAT + CSO */}
          <div className="grid grid-cols-2 gap-3">
            {/* FREE FLOAT */}
            <div className={cardStyle}>
              <div className={labelStyle}>
                <Users size={14} />
                Free Float
              </div>

              <p
                className="mt-4 break-words text-lg font-semibold
                tracking-tight text-zinc-800 dark:text-zinc-100
                sm:text-xl"
              >
                {freeFloat}
              </p>

              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Saham beredar publik
              </p>
            </div>

            {/* CSO */}
            <div className={cardStyle}>
              <div className={labelStyle}>
                <Layers3 size={14} />
                Current Shares
              </div>

              <p
                className="mt-4 break-all text-lg font-semibold
                tracking-tight text-zinc-800 dark:text-zinc-100
                sm:text-xl"
              >
                {cso}
              </p>

              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Shares outstanding
              </p>
            </div>
          </div>

          {/* BROKER */}
          <div
            className="flex items-center justify-between
            rounded-2xl border border-zinc-200/80 bg-white
            px-4 py-3.5 dark:border-white/[0.07]
            dark:bg-[#0e1420]"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center
                justify-center rounded-xl bg-zinc-100
                text-zinc-500 dark:bg-white/[0.05]
                dark:text-zinc-400"
              >
                <Building2 size={16} />
              </div>

              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Kode Broker
                </p>

                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Broker terkait emiten
                </p>
              </div>
            </div>

            <span
              className="rounded-xl border border-amber-200
              bg-amber-50 px-4 py-2 text-sm font-bold
              tracking-[0.18em] text-amber-700
              dark:border-amber-400/20 dark:bg-amber-400/[0.08]
              dark:text-amber-400"
            >
              {broker}
            </span>
          </div>
        </div>

        {/* FOOTER */}
        <div
          className="flex items-center justify-between
          border-t border-zinc-200/80 px-5 py-4
          dark:border-white/[0.07] sm:px-6"
        >
          <div>
            <p
              className="text-[9px] font-bold tracking-[0.2em]
              text-zinc-500"
            >
              MANNS INTELLIGENCE
            </p>

            <p className="mt-1 text-[9px] text-zinc-400 dark:text-zinc-600">
              Broker analytics
            </p>
          </div>

          <button
            type="button"
            onClick={closePopup}
            disabled={isClosing}
            className="rounded-xl border border-zinc-200
              bg-white px-4 py-2 text-xs font-semibold
              text-zinc-600 transition hover:bg-zinc-100
              disabled:pointer-events-none
              dark:border-white/[0.08] dark:bg-white/[0.04]
              dark:text-zinc-300 dark:hover:bg-white/[0.08]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};