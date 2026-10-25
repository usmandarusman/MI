
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useAuth } from "../../auth/AuthProvider";
import LoginRequired from "../../auth/LoginRequired";

/* =========================================================
   TYPES
========================================================= */

type BrokerOption = {
  broker_code: string;
  broker_id?: number;
  broker_name: string;
  is_foreign: boolean | null;
  is_bumn?: boolean;
  category?: string;
  type?: string;
  source?: string;
  updatedAt?: unknown;
  [key: string]: unknown;
};

type AccumulationPeriod = "1w" | "mtd" | "1m" | "2m" | "3m";
type TradingSetup = "fishing-bottom" | "retracement";
type SaveStatus = "idle" | "saving" | "success" | "error";

type TradePlaneConfig = {
  enabled: boolean;
  broker_code: string;
  broker_id: number | null;
  broker_name: string;
  destination_type: "telegram";
  destination_target: string;
  accumulation_period: AccumulationPeriod;
  setup: TradingSetup;
};

/* =========================================================
   CONSTANTS
========================================================= */

const BROKERS_CACHE_KEY = "idx-brokers-cache-v1";
const DEFAULT_ACCUMULATION_PERIOD: AccumulationPeriod = "mtd";
const DEFAULT_SETUP: TradingSetup = "fishing-bottom";

const accumulationPeriodOptions: {
  value: AccumulationPeriod;
  label: string;
  description: string;
}[] = [
  {
    value: "1w",
    label: "1 Minggu",
    description: "7 hari terakhir",
  },
  {
    value: "mtd",
    label: "Month to Date",
    description: "Awal bulan sampai hari ini",
  },
  {
    value: "1m",
    label: "1 Bulan",
    description: "Akumulasi satu bulan",
  },
  {
    value: "2m",
    label: "2 Bulan",
    description: "Akumulasi dua bulan",
  },
  {
    value: "3m",
    label: "3 Bulan",
    description: "Akumulasi tiga bulan",
  },
];

const strategyOptions: {
  value: TradingSetup;
  label: string;
  description: string;
}[] = [
  {
    value: "fishing-bottom",
    label: "Fishing Bottom",
    description:
      "Mencari kandidat saham di area bawah berdasarkan filter akumulasi broker dan posisi harga terhadap MA20.",
  },
  {
    value: "retracement",
    label: "Retracement",
    description:
      "Mencari peluang pullback ketika harga terkoreksi dalam tren yang berpotensi berlanjut.",
  },
];

const notes = [
  "Sinyal dikirim ke tujuan Telegram yang telah dikonfigurasi.",
  "Hindari trading ketika kondisi pasar tidak normal atau ada event besar.",
  "Akumulasi broker bukan jaminan harga akan naik.",
  "Tidak melakukan transaksi juga merupakan keputusan trading.",
];

/* =========================================================
   DEFAULT CONFIG
========================================================= */

function getDefaultTradePlaneConfig(): TradePlaneConfig {
  return {
    enabled: false,
    broker_code: "",
    broker_id: null,
    broker_name: "",
    destination_type: "telegram",
    destination_target: "",
    accumulation_period: DEFAULT_ACCUMULATION_PERIOD,
    setup: DEFAULT_SETUP,
  };
}

/* =========================================================
   NORMALIZERS
========================================================= */

function normalizeAccumulationPeriod(
  value: unknown,
): AccumulationPeriod {
  switch (value) {
    case "1w":
    case "mtd":
    case "1m":
    case "2m":
    case "3m":
      return value;
    default:
      return DEFAULT_ACCUMULATION_PERIOD;
  }
}

function normalizeSetup(value: unknown): TradingSetup {
  return value === "retracement" ? "retracement" : DEFAULT_SETUP;
}

function normalizeBrokers(payload: unknown): BrokerOption[] {
  let rows: unknown[] = [];

  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;

    if (Array.isArray(obj.data)) {
      rows = obj.data;
    } else if (Array.isArray(obj.brokers)) {
      rows = obj.brokers;
    } else if (obj.data && typeof obj.data === "object") {
      const nested = obj.data as Record<string, unknown>;

      if (Array.isArray(nested.data)) {
        rows = nested.data;
      }
    }
  }

  const mapped = rows
    .map((item): BrokerOption | null => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;

      const brokerCode = String(
        row.broker_code ?? row.code ?? "",
      )
        .trim()
        .toUpperCase();

      if (!brokerCode) return null;

      const brokerName = String(
        row.broker_name ?? row.name ?? brokerCode,
      ).trim();

      const rawForeign = row.is_foreign;
      let isForeign: boolean | null = null;

      if (
        rawForeign === true ||
        rawForeign === 1 ||
        rawForeign === "1" ||
        rawForeign === "true"
      ) {
        isForeign = true;
      } else if (
        rawForeign === false ||
        rawForeign === 0 ||
        rawForeign === "0" ||
        rawForeign === "false"
      ) {
        isForeign = false;
      }

      let brokerId: number | undefined;

      if (typeof row.broker_id === "number") {
        brokerId = row.broker_id;
      } else if (
        typeof row.broker_id === "string" &&
        row.broker_id.trim()
      ) {
        const parsed = Number(row.broker_id);

        if (Number.isFinite(parsed)) {
          brokerId = parsed;
        }
      }

      return {
        ...row,
        broker_code: brokerCode,
        broker_id: brokerId,
        broker_name: brokerName || brokerCode,
        is_foreign: isForeign,
      };
    })
    .filter((item): item is BrokerOption => item !== null);

  return Array.from(
    new Map(
      mapped.map((broker) => [broker.broker_code, broker]),
    ).values(),
  ).sort((a, b) => a.broker_code.localeCompare(b.broker_code));
}

/* =========================================================
   BROKER CACHE
========================================================= */

function getCachedBrokers(): BrokerOption[] {
  try {
    const cached = localStorage.getItem(BROKERS_CACHE_KEY);

    return cached ? normalizeBrokers(JSON.parse(cached)) : [];
  } catch (error) {
    console.error("[Signal] Broker cache error:", error);
    return [];
  }
}

/* =========================================================
   REUSABLE UI
========================================================= */

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Radio;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-200">
        <Icon size={17} />
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function FieldSelect({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-xl border border-zinc-200 bg-white py-3 pl-3.5 pr-11 text-sm font-semibold text-zinc-800 outline-none transition hover:border-yellow-500/40 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/[0.08] dark:border-white/[0.08] dark:bg-[#10141d] dark:text-zinc-100"
      >
        {children}
      </select>

      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
      />
    </div>
  );
}

/* =========================================================
   SIGNAL
========================================================= */

export default function Signal() {
  const { user, loading: authLoading } = useAuth();

  const [showLogin, setShowLogin] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [pendingEnableAfterLogin, setPendingEnableAfterLogin] =
    useState(false);

  const previousUserRef = useRef<typeof user>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [brokers, setBrokers] = useState<BrokerOption[]>([]);
  const [isBrokerLoading, setIsBrokerLoading] = useState(true);
  const [selectedBrokerCode, setSelectedBrokerCode] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] =
    useState<number | null>(null);

  const [isTradePlaneOn, setIsTradePlaneOn] = useState(false);
  const [setup, setSetup] = useState<TradingSetup>(DEFAULT_SETUP);
  const [destinationTarget, setDestinationTarget] = useState("");
  const [accumulationPeriod, setAccumulationPeriod] =
    useState<AccumulationPeriod>(DEFAULT_ACCUMULATION_PERIOD);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [validationMessage, setValidationMessage] = useState("");
  const [serverErrorMessage, setServerErrorMessage] = useState("");

  const [isTradePlaneLoading, setIsTradePlaneLoading] = useState(false);
  const [isToggleSaving, setIsToggleSaving] = useState(false);
  const [isBrokerDropdownOpen, setIsBrokerDropdownOpen] = useState(false);

  /* =======================================================
     DERIVED VALUES
  ======================================================= */

  const selectedBroker =
    brokers.find(
      (broker) => broker.broker_code === selectedBrokerCode,
    ) ?? null;

  const selectedAccumulationPeriod =
    accumulationPeriodOptions.find(
      (item) => item.value === accumulationPeriod,
    ) ?? accumulationPeriodOptions[1];

  const selectedStrategy =
    strategyOptions.find((item) => item.value === setup) ??
    strategyOptions[0];

  /* =======================================================
     LOAD BROKERS
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadBrokers() {
      const cached = getCachedBrokers();

      if (cached.length > 0) {
        if (!cancelled) {
          setBrokers(cached);
          setIsBrokerLoading(false);
        }
        return;
      }

      try {
        setIsBrokerLoading(true);

        const response = await fetch("/api/brokers", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ?? "Gagal mengambil data broker.",
          );
        }

        const fetchedBrokers = normalizeBrokers(data);

        if (fetchedBrokers.length === 0) {
          throw new Error("Data broker dari API kosong.");
        }

        if (cancelled) return;

        setBrokers(fetchedBrokers);

        try {
          localStorage.setItem(
            BROKERS_CACHE_KEY,
            JSON.stringify(fetchedBrokers),
          );
        } catch (error) {
          console.error("[Signal] Failed to save broker cache:", error);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[Signal] Broker fetch error:", error);
          setBrokers([]);
        }
      } finally {
        if (!cancelled) {
          setIsBrokerLoading(false);
        }
      }
    }

    void loadBrokers();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     LOAD SAVED CONFIGURATION
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadTradePlane() {
      if (authLoading) return;

      if (!user) {
        setIsTradePlaneLoading(false);
        return;
      }

      try {
        setIsTradePlaneLoading(true);

        const idToken = await user.getIdToken();

        const response = await fetch("/api/trade-plane", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ?? "Gagal mengambil konfigurasi Signal.",
          );
        }

        if (cancelled) return;

        const config = {
          ...getDefaultTradePlaneConfig(),
          ...(data?.config ?? {}),
        };

        if (!pendingEnableAfterLogin) {
          setIsTradePlaneOn(config.enabled === true);
        }

        setSelectedBrokerCode(
          String(config.broker_code ?? "").trim().toUpperCase(),
        );

        setSelectedBrokerId(
          typeof config.broker_id === "number"
            ? config.broker_id
            : null,
        );

        setDestinationTarget(
          String(config.destination_target ?? "").trim(),
        );

        setAccumulationPeriod(
          normalizeAccumulationPeriod(config.accumulation_period),
        );

        setSetup(normalizeSetup(config.setup));

        setSaveStatus("idle");
        setValidationMessage("");
        setServerErrorMessage("");
      } catch (error) {
        if (!cancelled) {
          console.error("[Signal] Load error:", error);
          setServerErrorMessage(
            error instanceof Error
              ? error.message
              : "Gagal memuat konfigurasi Signal.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsTradePlaneLoading(false);
        }
      }
    }

    void loadTradePlane();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, pendingEnableAfterLogin]);

  /* =======================================================
     LOGOUT DETECTION
  ======================================================= */

  useEffect(() => {
    if (authLoading) return;

    if (previousUserRef.current && !user) {
      setIsTradePlaneOn(false);
      setSelectedBrokerCode("");
      setSelectedBrokerId(null);
      setDestinationTarget("");
      setAccumulationPeriod(DEFAULT_ACCUMULATION_PERIOD);
      setSetup(DEFAULT_SETUP);
      setSaveStatus("idle");
      setValidationMessage("");
      setServerErrorMessage("");
      setIsTradePlaneLoading(false);
      setIsToggleSaving(false);
      setIsBrokerDropdownOpen(false);
      setPendingEnableAfterLogin(false);
      setShowLogin(false);
      setShowDisableConfirm(false);
    }

    previousUserRef.current = user;
  }, [user, authLoading]);

  /* =======================================================
     ENABLE AFTER LOGIN
  ======================================================= */

  useEffect(() => {
    if (!user || !pendingEnableAfterLogin) return;

    setShowLogin(false);
    setIsTradePlaneOn(true);
    setSaveStatus("idle");
    setValidationMessage("");
    setPendingEnableAfterLogin(false);
  }, [user, pendingEnableAfterLogin]);

  /* =======================================================
     CLOSE BROKER DROPDOWN ON OUTSIDE CLICK
  ======================================================= */

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsBrokerDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /* =======================================================
     HELPERS
  ======================================================= */

  function clearMessages() {
    setValidationMessage("");
    setServerErrorMessage("");
    setSaveStatus("idle");
  }

  function handleBrokerSelect(broker: BrokerOption) {
    setSelectedBrokerCode(broker.broker_code);
    setSelectedBrokerId(broker.broker_id ?? null);
    setIsBrokerDropdownOpen(false);
    clearMessages();
  }

  function handleTradePlaneToggle() {
    if (authLoading || isTradePlaneLoading || isToggleSaving) {
      return;
    }

    if (isTradePlaneOn) {
      setShowDisableConfirm(true);
      return;
    }

    if (!user) {
      setPendingEnableAfterLogin(true);
      setShowLogin(true);
      return;
    }

    setIsTradePlaneOn(true);
    clearMessages();
  }

  /* =======================================================
     DISABLE SIGNAL
  ======================================================= */

  async function disableTradePlane() {
    if (!user || isToggleSaving) return;

    setIsToggleSaving(true);
    setSaveStatus("saving");
    setValidationMessage("");
    setServerErrorMessage("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/trade-plane", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ enabled: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal mematikan Signal.");
      }

      const savedConfig = data?.config;

      setIsTradePlaneOn(false);

      if (savedConfig) {
        setSelectedBrokerCode(
          String(
            savedConfig.broker_code ?? selectedBrokerCode,
          )
            .trim()
            .toUpperCase(),
        );

        setSelectedBrokerId(
          typeof savedConfig.broker_id === "number"
            ? savedConfig.broker_id
            : selectedBrokerId,
        );

        setDestinationTarget(
          String(
            savedConfig.destination_target ?? destinationTarget,
          ).trim(),
        );

        setAccumulationPeriod(
          normalizeAccumulationPeriod(
            savedConfig.accumulation_period ?? accumulationPeriod,
          ),
        );

        setSetup(normalizeSetup(savedConfig.setup ?? setup));
      }

      setSaveStatus("success");
    } catch (error) {
      console.error("[Signal] Disable error:", error);
      setIsTradePlaneOn(true);
      setSaveStatus("error");
      setServerErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal mematikan Signal.",
      );
    } finally {
      setIsToggleSaving(false);
    }
  }

  /* =======================================================
     SAVE CONFIGURATION
  ======================================================= */

  async function handleSaveTradePlane() {
    if (!user) {
      setIsTradePlaneOn(false);
      setPendingEnableAfterLogin(true);
      setShowLogin(true);
      return;
    }

    setValidationMessage("");
    setServerErrorMessage("");
    setSaveStatus("idle");

    const brokerIsValid = Boolean(
      selectedBroker &&
        selectedBrokerCode &&
        selectedBrokerId !== null,
    );

    const telegramIsValid = Boolean(destinationTarget.trim());

    if (!brokerIsValid && !telegramIsValid) {
      setValidationMessage(
        "Silakan lengkapi broker dan Telegram Chat ID terlebih dahulu.",
      );
      return;
    }

    if (!brokerIsValid) {
      setValidationMessage(
        "Pilih broker yang memiliki broker ID valid terlebih dahulu.",
      );
      return;
    }

    if (!telegramIsValid) {
      setValidationMessage("Isi Telegram Chat ID terlebih dahulu.");
      return;
    }

    await saveTradePlaneWithUser(user);
  }

  async function saveTradePlaneWithUser(
    currentUser: NonNullable<typeof user>,
  ) {
    setSaveStatus("saving");
    setValidationMessage("");
    setServerErrorMessage("");

    try {
      const idToken = await currentUser.getIdToken();

      const config: TradePlaneConfig = {
        enabled: true,
        broker_code: selectedBrokerCode,
        broker_id: selectedBrokerId,
        broker_name: selectedBroker?.broker_name ?? "",
        destination_type: "telegram",
        destination_target: destinationTarget.trim(),
        accumulation_period: accumulationPeriod,
        setup,
      };

      const response = await fetch("/api/trade-plane", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Gagal menyimpan konfigurasi.",
        );
      }

      const savedConfig = {
        ...config,
        ...(data?.config ?? {}),
      };

      setIsTradePlaneOn(savedConfig.enabled === true);

      setSelectedBrokerCode(
        String(savedConfig.broker_code ?? "")
          .trim()
          .toUpperCase(),
      );

      setSelectedBrokerId(
        typeof savedConfig.broker_id === "number"
          ? savedConfig.broker_id
          : null,
      );

      setDestinationTarget(
        String(savedConfig.destination_target ?? "").trim(),
      );

      setAccumulationPeriod(
        normalizeAccumulationPeriod(
          savedConfig.accumulation_period,
        ),
      );

      setSetup(normalizeSetup(savedConfig.setup));
      setSaveStatus("success");
    } catch (error) {
      console.error("[Signal] Save error:", error);
      setSaveStatus("error");
      setServerErrorMessage(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan konfigurasi.",
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  const isBusy =
    authLoading || isTradePlaneLoading || isToggleSaving;

  return (
    <>
      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <LoginRequired
            onClose={() => {
              setShowLogin(false);
              setPendingEnableAfterLogin(false);
            }}
          />
        </div>
      )}

      {/* DISABLE CONFIRMATION */}
      {showDisableConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131b]">
            <div className="border-b border-zinc-200 p-5 dark:border-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                  <Radio size={20} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Matikan Signal?
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Pengiriman sinyal akan dinonaktifkan.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Konfigurasi broker, strategi, periode akumulasi, dan
                Telegram tetap tersimpan sehingga dapat digunakan kembali.
              </p>
            </div>

            <div className="flex gap-2 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-white/[0.07] dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setShowDisableConfirm(false)}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDisableConfirm(false);
                  void disableTradePlane();
                }}
                disabled={isToggleSaving}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-xs font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {isToggleSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Memproses...
                  </span>
                ) : (
                  "Ya, Matikan"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN PANEL */}
      <section className="relative z-30 mt-5 overflow-visible rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_12px_50px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#0c1018]/95 dark:shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
        {/* DECORATIVE GLOW */}
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-yellow-400/[0.06] blur-3xl" />

        {/* HEADER */}
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-400/20 to-amber-500/[0.04] text-yellow-600 dark:text-yellow-400">
              <Radio size={21} />
              <span
                className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white dark:border-[#0c1018] ${
                  isTradePlaneOn
                    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]"
                    : "bg-zinc-400"
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                  Signal
                </h2>
                <span className="rounded-full border border-yellow-500/20 bg-yellow-500/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-yellow-700 dark:text-yellow-400">
                  Trading Engine
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Konfigurasi strategi dan pengiriman sinyal
              </p>
            </div>
          </div>

          {/* SWITCH */}
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={isTradePlaneOn}
              aria-label="Aktifkan atau matikan Signal"
              disabled={isBusy}
              onClick={handleTradePlaneToggle}
              className={`relative h-7 w-12 rounded-full transition-all duration-300 ${
                isTradePlaneOn
                  ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  : "bg-zinc-300 dark:bg-zinc-700"
              } ${isBusy ? "cursor-wait opacity-60" : ""}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-300 ${
                  isTradePlaneOn ? "left-6" : "left-1"
                }`}
              />
            </button>

            <span
              className={`text-[9px] font-bold uppercase tracking-[0.16em] ${
                isTradePlaneOn
                  ? "text-emerald-500"
                  : "text-zinc-400"
              }`}
            >
              {isBusy
                ? "Loading"
                : isTradePlaneOn
                  ? "Active"
                  : "Inactive"}
            </span>
          </div>
        </div>

        {/* CONFIGURATION */}
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
            isTradePlaneOn
              ? "mt-6 grid-rows-[1fr] opacity-100"
              : "mt-0 grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-visible">
            <div className="space-y-4">
              {/* TELEGRAM DESTINATION */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-white/[0.02] sm:p-5">
                <SectionHeading
                  icon={Send}
                  title="Telegram Destination"
                  description="Tentukan tujuan pengiriman sinyal."
                />

                <label
                  htmlFor="signal-telegram-chat-id"
                  className="mb-2 block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Telegram Chat ID
                </label>

                <div className="relative">
                  <Send
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                  />

                  <input
                    id="signal-telegram-chat-id"
                    type="text"
                    value={destinationTarget}
                    onChange={(event) => {
                      setDestinationTarget(event.target.value);
                      clearMessages();
                    }}
                    placeholder="-1001234567890"
                    autoComplete="off"
                    className={`w-full rounded-xl border bg-white py-3 pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/[0.08] dark:bg-[#10141d] dark:text-white ${
                      validationMessage && !destinationTarget.trim()
                        ? "border-red-400 dark:border-red-500/60"
                        : "border-zinc-200 dark:border-white/[0.08]"
                    }`}
                  />
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Pastikan bot sudah ditambahkan ke channel dan memiliki
                  izin mengirim pesan.
                </p>
              </div>

              {/* BROKER */}
              <div className="relative z-[100] rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-white/[0.02] sm:p-5">
                <SectionHeading
                  icon={ShieldCheck}
                  title="Broker Accumulation"
                  description="Pilih broker sebagai sumber data akumulasi."
                />

                <div ref={dropdownRef} className="relative z-[200]">
                  <button
                    type="button"
                    aria-expanded={isBrokerDropdownOpen}
                    disabled={isBrokerLoading || brokers.length === 0}
                    onClick={() =>
                      setIsBrokerDropdownOpen((value) => !value)
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3.5 text-left transition hover:border-yellow-500/40 focus:border-yellow-500 focus:outline-none focus:ring-4 focus:ring-yellow-500/[0.06] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#10141d] ${
                      validationMessage &&
                      (!selectedBroker || selectedBrokerId === null)
                        ? "border-red-400 dark:border-red-500/60"
                        : "border-zinc-200 dark:border-white/[0.08]"
                    }`}
                  >
                    {selectedBroker ? (
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white">
                          {selectedBroker.broker_code}
                        </div>

                        <div className="min-w-0">
                          <p
                            className={`truncate text-sm font-semibold ${
                              selectedBroker.is_foreign
                                ? "text-red-500"
                                : "text-zinc-900 dark:text-white"
                            }`}
                          >
                            {selectedBroker.broker_name}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                            Broker code: {selectedBroker.broker_code}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          {isBrokerLoading
                            ? "Memuat data broker..."
                            : brokers.length === 0
                              ? "Data broker tidak tersedia"
                              : "Pilih broker"}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                          Pilih broker untuk melanjutkan
                        </p>
                      </div>
                    )}

                    <ChevronDown
                      size={17}
                      className={`shrink-0 text-zinc-400 transition-transform ${
                        isBrokerDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isBrokerDropdownOpen && brokers.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-[99999] mt-2 max-h-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-[#151a25] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                      {brokers.map((broker) => {
                        const selected =
                          broker.broker_code === selectedBrokerCode;

                        return (
                          <button
                            key={`${broker.broker_code}-${broker.broker_id ?? "na"}`}
                            type="button"
                            onClick={() => handleBrokerSelect(broker)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                              selected
                                ? "bg-yellow-500/[0.09]"
                                : "hover:bg-zinc-100 dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={`flex h-9 w-12 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                                  broker.is_foreign
                                    ? "bg-red-500/10 text-red-500"
                                    : "bg-zinc-100 text-zinc-800 dark:bg-white/[0.05] dark:text-zinc-200"
                                }`}
                              >
                                {broker.broker_code}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                  {broker.broker_name}
                                </p>
                                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                                  {broker.is_foreign
                                    ? "Foreign broker"
                                    : "Broker"}
                                </p>
                              </div>
                            </div>

                            {selected && (
                              <Check
                                size={16}
                                className="shrink-0 text-emerald-500"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!isBrokerLoading && brokers.length === 0 && (
                  <p className="mt-3 text-xs text-red-500">
                    Data broker gagal dimuat. Periksa endpoint /api/brokers
                    lalu coba muat ulang halaman.
                  </p>
                )}
              </div>

              {/* PERIOD DROPDOWN */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-white/[0.02] sm:p-5">
                <SectionHeading
                  icon={Clock3}
                  title="Accumulation Period"
                  description="Tentukan rentang waktu perhitungan akumulasi broker."
                />

                <FieldSelect
                  id="signal-accumulation-period"
                  value={accumulationPeriod}
                  onChange={(value) => {
                    setAccumulationPeriod(
                      normalizeAccumulationPeriod(value),
                    );
                    clearMessages();
                  }}
                >
                  {accumulationPeriodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.description}
                    </option>
                  ))}
                </FieldSelect>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-zinc-200/70 bg-white px-3.5 py-3 dark:border-white/[0.06] dark:bg-[#10141d]">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Periode terpilih
                  </span>
                  <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">
                    {selectedAccumulationPeriod.label}
                  </span>
                </div>
              </div>

              {/* STRATEGY DROPDOWN */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-white/[0.02] sm:p-5">
                <SectionHeading
                  icon={Sparkles}
                  title="Trading Strategy"
                  description="Pilih strategi untuk pembentukan sinyal."
                />

                <FieldSelect
                  id="signal-trading-strategy"
                  value={setup}
                  onChange={(value) => {
                    setSetup(normalizeSetup(value));
                    clearMessages();
                  }}
                >
                  {strategyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FieldSelect>

                <div className="mt-3 rounded-xl border border-zinc-200/70 bg-white p-3.5 dark:border-white/[0.06] dark:bg-[#10141d]">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                      <Sparkles size={14} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {selectedStrategy.label}
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {selectedStrategy.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* VALIDATION MESSAGE */}
        {isTradePlaneOn && validationMessage && (
          <div
            role="alert"
            className="relative z-10 mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3.5 text-xs text-amber-700 dark:text-amber-400"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{validationMessage}</span>
          </div>
        )}

        {/* SAVE BUTTON */}
        {isTradePlaneOn && (
          <div className="relative z-10 mt-4">
            <button
              type="button"
              onClick={() => void handleSaveTradePlane()}
              disabled={
                saveStatus === "saving" ||
                isTradePlaneLoading ||
                isToggleSaving
              }
              className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-3.5 text-xs font-extrabold text-zinc-950 shadow-[0_8px_28px_rgba(234,179,8,0.16)] transition-all duration-200 hover:shadow-[0_10px_35px_rgba(234,179,8,0.25)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan konfigurasi...
                </>
              ) : saveStatus === "success" ? (
                <>
                  <Check size={16} strokeWidth={3} />
                  Konfigurasi Tersimpan
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  Simpan Konfigurasi
                  <span className="ml-1 opacity-60 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* SERVER ERROR */}
        {saveStatus === "error" && (
          <div
            role="alert"
            className="relative z-10 mt-3 flex items-start gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.05] px-3.5 py-3 text-xs text-red-500"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>
              {serverErrorMessage ||
                "Terjadi kesalahan. Silakan coba lagi."}
            </span>
          </div>
        )}

        {/* SUCCESS */}
        {saveStatus === "success" && isTradePlaneOn && (
          <div className="relative z-10 mt-3 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-3 text-xs text-emerald-600 dark:text-emerald-400">
            <Check size={14} strokeWidth={2.5} />
            Konfigurasi berhasil disimpan.
          </div>
        )}

        {/* CURRENT STATUS */}
        <div
          className={`relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            isTradePlaneOn
              ? "border-emerald-500/15 bg-emerald-500/[0.04]"
              : "border-zinc-200 bg-zinc-50/70 dark:border-white/[0.07] dark:bg-white/[0.02]"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`relative flex h-2 w-2 shrink-0 rounded-full ${
                isTradePlaneOn
                  ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                  : "bg-zinc-400"
              }`}
            />

            <div className="min-w-0">
              <p
                className={`text-xs font-semibold ${
                  isTradePlaneOn
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {isTradePlaneOn
                  ? "Signal aktif"
                  : "Signal tidak aktif"}
              </p>

              <p className="mt-1 truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                {isTradePlaneOn
                  ? `${selectedBrokerCode || "Broker belum dipilih"} · ${selectedStrategy.label}`
                  : "Aktifkan untuk mengatur konfigurasi"}
              </p>
            </div>
          </div>

          <span
            className={`rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
              isTradePlaneOn
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-zinc-200/80 text-zinc-500 dark:bg-white/[0.05] dark:text-zinc-400"
            }`}
          >
            {isTradePlaneOn ? "Running config" : "Standby"}
          </span>
        </div>

        {/* TRADING NOTES */}
        <div className="relative z-10 mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-white/[0.07] dark:bg-white/[0.02] sm:p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              <ShieldCheck size={15} />
            </div>

            <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Trading Notes
            </h3>
          </div>

          <ul className="mt-3 space-y-2.5">
            {notes.map((note, index) => (
              <li
                key={note}
                className="flex items-start gap-2.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-200/80 text-[9px] font-bold text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                  {index + 1}
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
