/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Radio,
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

type DestinationType = "telegram";

type AccumulationPeriod =
  | "1w"
  | "mtd"
  | "1m"
  | "2m"
  | "3m";

type TradePlaneConfig = {
  enabled: boolean;
  broker_code: string;
  broker_id: number | null;
  broker_name: string;
  destination_type: DestinationType;
  destination_target: string;
  accumulation_period: AccumulationPeriod;
};

type SaveStatus =
  | "idle"
  | "saving"
  | "success"
  | "error";

/* =========================================================
   CONSTANTS
========================================================= */

const BROKERS_CACHE_KEY =
  "idx-brokers-cache-v1";

const DEFAULT_ACCUMULATION_PERIOD: AccumulationPeriod =
  "mtd";

/* =========================================================
   ACCUMULATION PERIOD OPTIONS
========================================================= */

const accumulationPeriodOptions: {
  value: AccumulationPeriod;
  label: string;
  description: string;
}[] = [
  {
    value: "1w",
    label: "Last 1 Week",
    description: "7 hari terakhir",
  },
  {
    value: "mtd",
    label: "Month to Date",
    description: "Awal bulan sampai hari ini",
  },
  {
    value: "1m",
    label: "Last 1 Month",
    description: "1 bulan terakhir",
  },
  {
    value: "2m",
    label: "Last 2 Month",
    description: "2 bulan terakhir",
  },
  {
    value: "3m",
    label: "Last 3 Month",
    description: "3 bulan terakhir",
  },
];

/* =========================================================
   NOTES
========================================================= */

const notes = [
  {
    id: 1,
    note: "Fitur ini untuk mengirimkan signal ke channel.",
  },
  {
    id: 2,
    note: "Jangan trade dikala market sedang kacau atau ada event tertentu yang berpengaruh terhadap market.",
  },
  {
    id: 3,
    note: "Sebagus apapun analisamu akan hancur jika ada kejadian atau event tertentu, karena event diatas segalanya dalam dunia saham.",
  },
  {
    id: 4,
    note: "Kadang tidak trade sama sekali adalah pilihan terbaik.",
  },
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
    accumulation_period:
      DEFAULT_ACCUMULATION_PERIOD,
  };
}

/* =========================================================
   NORMALIZE ACCUMULATION PERIOD
========================================================= */

function normalizeAccumulationPeriod(
  value: unknown
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

/* =========================================================
   NORMALIZE BROKERS
========================================================= */

function normalizeBrokers(
  payload: unknown
): BrokerOption[] {
  let rows: unknown[] = [];

  if (Array.isArray(payload)) {
    rows = payload;
  } else if (
    payload &&
    typeof payload === "object"
  ) {
    const obj =
      payload as Record<string, unknown>;

    if (Array.isArray(obj.data)) {
      rows = obj.data;
    } else if (
      Array.isArray(obj.brokers)
    ) {
      rows = obj.brokers;
    } else if (
      obj.data &&
      typeof obj.data === "object"
    ) {
      const nested =
        obj.data as Record<
          string,
          unknown
        >;

      if (Array.isArray(nested.data)) {
        rows = nested.data;
      }
    }
  }

  const mapped = rows
    .map(
      (
        item
      ): BrokerOption | null => {
        if (
          !item ||
          typeof item !== "object"
        ) {
          return null;
        }

        const row =
          item as Record<
            string,
            unknown
          >;

        const brokerCode =
          String(
            row.broker_code ??
              row.code ??
              ""
          )
            .trim()
            .toUpperCase();

        if (!brokerCode) {
          return null;
        }

        const brokerName =
          String(
            row.broker_name ??
              row.name ??
              brokerCode
          ).trim();

        const rawForeign =
          row.is_foreign;

        let isForeign:
          | boolean
          | null = null;

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

        let brokerId:
          | number
          | undefined;

        if (
          typeof row.broker_id ===
          "number"
        ) {
          brokerId =
            row.broker_id;
        } else if (
          typeof row.broker_id ===
            "string" &&
          row.broker_id.trim()
        ) {
          const parsed =
            Number(
              row.broker_id
            );

          if (
            Number.isFinite(parsed)
          ) {
            brokerId = parsed;
          }
        }

        return {
          ...row,
          broker_code:
            brokerCode,
          broker_id:
            brokerId,
          broker_name:
            brokerName ||
            brokerCode,
          is_foreign:
            isForeign,
        };
      }
    )
    .filter(
      (
        item
      ): item is BrokerOption =>
        item !== null
    );

  return Array.from(
    new Map(
      mapped.map(
        (broker) => [
          broker.broker_code,
          broker,
        ]
      )
    ).values()
  ).sort(
    (a, b) =>
      a.broker_code.localeCompare(
        b.broker_code
      )
  );
}

/* =========================================================
   BROKER CACHE
========================================================= */

function getCachedBrokers(): BrokerOption[] {
  try {
    const cached =
      localStorage.getItem(
        BROKERS_CACHE_KEY
      );

    if (!cached) {
      return [];
    }

    const parsed =
      JSON.parse(cached);

    return normalizeBrokers(parsed);
  } catch (error) {
    console.error(
      "[Signal] Broker cache error:",
      error
    );

    return [];
  }
}

/* =========================================================
   SIGNAL
========================================================= */

export default function Signal() {
  /* =======================================================
     AUTH
  ======================================================= */

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    showLogin,
    setShowLogin,
  ] = useState(false);

  const [
    showDisableConfirm,
    setShowDisableConfirm,
  ] = useState(false);

  const [
    pendingEnableAfterLogin,
    setPendingEnableAfterLogin,
  ] = useState(false);

  const previousUserRef =
    useRef<typeof user>(null);

  /* =======================================================
     BROKERS
  ======================================================= */

  const [brokers, setBrokers] =
    useState<BrokerOption[]>([]);

  const [
    isBrokerLoading,
    setIsBrokerLoading,
  ] = useState(true);

  const [
    selectedBrokerCode,
    setSelectedBrokerCode,
  ] = useState("");

  const [
    selectedBrokerId,
    setSelectedBrokerId,
  ] = useState<number | null>(
    null
  );

  /* =======================================================
     SIGNAL STATE
  ======================================================= */

  const [
    isTradePlaneOn,
    setIsTradePlaneOn,
  ] = useState(false);

  const [
    destinationType,
    setDestinationType,
  ] =
    useState<DestinationType>(
      "telegram"
    );

  const [
    destinationTarget,
    setDestinationTarget,
  ] = useState("");

  const [
    accumulationPeriod,
    setAccumulationPeriod,
  ] =
    useState<AccumulationPeriod>(
      DEFAULT_ACCUMULATION_PERIOD
    );

  /* =======================================================
     SAVE
  ======================================================= */

  const [
    saveStatus,
    setSaveStatus,
  ] = useState<SaveStatus>(
    "idle"
  );

  /*
   * Pesan khusus validasi form.
   *
   * Ini BERBEDA dengan saveStatus === "error".
   *
   * Contoh:
   * - "Pilih broker terlebih dahulu."
   * - "Isi Telegram Chat ID terlebih dahulu."
   * - "Silakan lengkapi semua konfigurasi terlebih dahulu."
   */
  const [
    validationMessage,
    setValidationMessage,
  ] = useState("");

  /* =======================================================
     SERVER LOADING
  ======================================================= */

  const [
    isTradePlaneLoading,
    setIsTradePlaneLoading,
  ] = useState(false);

  const [
    isToggleSaving,
    setIsToggleSaving,
  ] = useState(false);

  /* =======================================================
     BROKER DROPDOWN
  ======================================================= */

  const [
    isBrokerDropdownOpen,
    setIsBrokerDropdownOpen,
  ] = useState(false);

  const dropdownRef =
    useRef<HTMLDivElement>(null);

  /* =======================================================
     LOAD BROKERS
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadBrokers() {
      const cached =
        getCachedBrokers();

      if (cached.length > 0) {
        if (!cancelled) {
          setBrokers(cached);
          setIsBrokerLoading(false);
        }

        console.log(
          `[Signal] Broker loaded from localStorage: ${cached.length}`
        );

        return;
      }

      try {
        if (!cancelled) {
          setIsBrokerLoading(true);
        }

        const response =
          await fetch(
            "/api/brokers",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ??
              "Gagal mengambil data broker."
          );
        }

        const fetchedBrokers =
          normalizeBrokers(data);

        if (
          fetchedBrokers.length === 0
        ) {
          throw new Error(
            "Data broker dari API kosong."
          );
        }

        if (cancelled) {
          return;
        }

        setBrokers(
          fetchedBrokers
        );

        try {
          localStorage.setItem(
            BROKERS_CACHE_KEY,
            JSON.stringify(
              fetchedBrokers
            )
          );
        } catch (storageError) {
          console.error(
            "[Signal] Failed to save broker cache:",
            storageError
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[Signal] Broker fetch error:",
            error
          );

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
     SELECTED BROKER
  ======================================================= */

  const selectedBroker =
    brokers.find(
      (broker) =>
        broker.broker_code ===
        selectedBrokerCode
    ) ?? null;

  /* =======================================================
     SELECTED ACCUMULATION PERIOD
  ======================================================= */

  const selectedAccumulationPeriod =
    accumulationPeriodOptions.find(
      (item) =>
        item.value ===
        accumulationPeriod
    ) ??
    accumulationPeriodOptions.find(
      (item) =>
        item.value ===
        DEFAULT_ACCUMULATION_PERIOD
    )!;

  /* =======================================================
     LOAD SAVED SIGNAL
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadTradePlane() {
      if (!user) {
        setIsTradePlaneLoading(false);
        return;
      }

      try {
        setIsTradePlaneLoading(true);

        const idToken =
          await user.getIdToken();

        const response =
          await fetch(
            "/api/trade-plane",
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${idToken}`,
              },
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ??
              "Gagal mengambil konfigurasi Signal."
          );
        }

        if (cancelled) {
          return;
        }

        const config =
          data?.config ??
          getDefaultTradePlaneConfig();

        if (!pendingEnableAfterLogin) {
          setIsTradePlaneOn(
            config.enabled === true
          );
        }

        /* BROKER */

        setSelectedBrokerCode(
          String(
            config.broker_code ??
              ""
          )
            .trim()
            .toUpperCase()
        );

        setSelectedBrokerId(
          typeof config.broker_id ===
            "number"
            ? config.broker_id
            : null
        );

        /* DESTINATION */

        setDestinationType("telegram");

        setDestinationTarget(
          String(
            config.destination_target ??
              ""
          ).trim()
        );

        /* ACCUMULATION PERIOD */

        setAccumulationPeriod(
          normalizeAccumulationPeriod(
            config.accumulation_period
          )
        );

        setSaveStatus("idle");

        /*
         * Jangan tampilkan pesan validasi
         * ketika konfigurasi berhasil
         * dimuat dari Firebase.
         */
        setValidationMessage("");
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[Signal] Load error:",
            error
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
  }, [
    user,
    pendingEnableAfterLogin,
  ]);

  /* =======================================================
     LOGOUT DETECTION
  ======================================================= */

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (
      previousUserRef.current &&
      !user
    ) {
      console.log(
        "[Signal] User logout. Reset UI state."
      );

      setIsTradePlaneOn(false);

      setSelectedBrokerCode("");
      setSelectedBrokerId(null);

      setDestinationType("telegram");
      setDestinationTarget("");

      setAccumulationPeriod(
        DEFAULT_ACCUMULATION_PERIOD
      );

      setSaveStatus("idle");

      setValidationMessage("");

      setIsTradePlaneLoading(false);
      setIsToggleSaving(false);

      setIsBrokerDropdownOpen(false);

      setPendingEnableAfterLogin(
        false
      );

      setShowLogin(false);
      setShowDisableConfirm(false);
    }

    previousUserRef.current = user;
  }, [
    user,
    authLoading,
  ]);

  /* =======================================================
     ENABLE AFTER LOGIN
  ======================================================= */

  useEffect(() => {
    if (
      !user ||
      !pendingEnableAfterLogin
    ) {
      return;
    }

    /*
     * Login berhasil.
     *
     * TIDAK melakukan PUT.
     *
     * Switch hanya dibuka.
     */
    setShowLogin(false);

    setIsTradePlaneOn(true);

    setSaveStatus("idle");

    setValidationMessage("");

    setPendingEnableAfterLogin(
      false
    );
  }, [
    user,
    pendingEnableAfterLogin,
  ]);

  /* =======================================================
     CLOSE DROPDOWN
  ======================================================= */

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setIsBrokerDropdownOpen(
          false
        );
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* =======================================================
     DISABLE SIGNAL
  ======================================================= */

  async function disableTradePlane() {
    if (!user || isToggleSaving) {
      return;
    }

    setIsToggleSaving(true);
    setSaveStatus("saving");
    setValidationMessage("");

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/trade-plane",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body: JSON.stringify({
              enabled: false,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Gagal mematikan Signal."
        );
      }

      const savedConfig =
        data?.config;

      setIsTradePlaneOn(false);

      if (savedConfig) {
        setSelectedBrokerCode(
          String(
            savedConfig.broker_code ??
              selectedBrokerCode
          )
            .trim()
            .toUpperCase()
        );

        setSelectedBrokerId(
          typeof savedConfig.broker_id ===
            "number"
            ? savedConfig.broker_id
            : selectedBrokerId
        );

        setDestinationType(
          "telegram"
        );

        setDestinationTarget(
          String(
            savedConfig.destination_target ??
              destinationTarget
          ).trim()
        );

        setAccumulationPeriod(
          normalizeAccumulationPeriod(
            savedConfig.accumulation_period ??
              accumulationPeriod
          )
        );
      }

      setSaveStatus("success");
    } catch (error) {
      console.error(
        "[Signal] Disable error:",
        error
      );

      setIsTradePlaneOn(true);

      setSaveStatus("error");
    } finally {
      setIsToggleSaving(false);
    }
  }

  /* =======================================================
     TOGGLE SIGNAL
  ======================================================= */

  const handleTradePlaneToggle =
    () => {
      if (
        authLoading ||
        isTradePlaneLoading ||
        isToggleSaving
      ) {
        return;
      }

      /* ON -> OFF */

      if (isTradePlaneOn) {
        setShowDisableConfirm(true);
        return;
      }

      /* OFF -> ON */

      if (!user) {
        setPendingEnableAfterLogin(
          true
        );

        setShowLogin(true);

        return;
      }

      /*
       * Sudah login.
       *
       * ON hanya membuka konfigurasi.
       */
      setIsTradePlaneOn(true);

      setSaveStatus("idle");

      setValidationMessage("");
    };

  /* =======================================================
     CONFIRM DISABLE
  ======================================================= */

  const handleConfirmDisable =
    async () => {
      setShowDisableConfirm(false);

      await disableTradePlane();
    };

  /* =======================================================
     CANCEL DISABLE
  ======================================================= */

  const handleCancelDisable = () => {
    setShowDisableConfirm(false);
  };

  /* =======================================================
     SELECT BROKER
  ======================================================= */

  const handleBrokerSelect = (
    broker: BrokerOption
  ) => {
    setSelectedBrokerCode(
      broker.broker_code
    );

    setSelectedBrokerId(
      broker.broker_id ?? null
    );

    setIsBrokerDropdownOpen(
      false
    );

    /*
     * Broker sudah diisi.
     * Hapus pesan validasi.
     */
    setValidationMessage("");

    setSaveStatus("idle");
  };

  /* =======================================================
     ACCUMULATION PERIOD
  ======================================================= */

  const handleAccumulationPeriodChange =
    (
      period: AccumulationPeriod
    ) => {
      setAccumulationPeriod(
        period
      );

      setValidationMessage("");

      setSaveStatus("idle");
    };

  /* =======================================================
     DESTINATION
  ======================================================= */

  const handleDestinationChange = () => {
    setDestinationType("telegram");

    setValidationMessage("");

    setSaveStatus("idle");
  };

  /* =======================================================
     TARGET
  ======================================================= */

  const handleDestinationTargetChange =
    (value: string) => {
      setDestinationTarget(value);

      /*
       * Kalau user mulai mengetik,
       * hapus pesan validasi.
       */
      setValidationMessage("");

      setSaveStatus("idle");
    };

  /* =======================================================
     SAVE CONFIGURATION
  ======================================================= */

  const handleSaveTradePlane =
    async () => {
      /*
       * ON harus login.
       */
      if (!user) {
        setIsTradePlaneOn(false);

        setPendingEnableAfterLogin(
          true
        );

        setShowLogin(true);

        return;
      }

      /*
       * Bersihkan pesan lama
       * sebelum melakukan validasi.
       */
      setValidationMessage("");

      setSaveStatus("idle");

      /*
       * ===================================================
       * VALIDASI FORM
       * ===================================================
       *
       * INI BUKAN ERROR SERVER.
       *
       * Jadi jangan menggunakan:
       *
       * setSaveStatus("error")
       *
       * untuk field kosong.
       */

      const brokerIsValid =
        Boolean(
          selectedBroker &&
            selectedBrokerCode &&
            selectedBrokerId !== null
        );

      const telegramIsValid =
        Boolean(
          destinationTarget.trim()
        );

      /*
       * Broker + Telegram sama-sama kosong.
       */
      if (
        !brokerIsValid &&
        !telegramIsValid
      ) {
        setValidationMessage(
          "Silakan lengkapi semua konfigurasi terlebih dahulu."
        );

        return;
      }

      /*
       * Broker belum dipilih.
       */
      if (!brokerIsValid) {
        setValidationMessage(
          "Pilih broker terlebih dahulu."
        );

        return;
      }

      /*
       * Telegram Chat ID belum diisi.
       */
      if (!telegramIsValid) {
        setValidationMessage(
          "Isi Telegram Chat ID terlebih dahulu."
        );

        return;
      }

      /*
       * ===================================================
       * SEMUA VALID
       * ===================================================
       *
       * Baru sekarang backend dipanggil.
       */
      await saveTradePlaneWithUser(
        user
      );
    };

  /* =======================================================
     SAVE CONFIGURATION TO SERVER
  ======================================================= */

  async function saveTradePlaneWithUser(
    currentUser: NonNullable<
      typeof user
    >
  ) {
    setSaveStatus("saving");

    setValidationMessage("");

    try {
      const idToken =
        await currentUser.getIdToken();

      const config: TradePlaneConfig =
        {
          enabled: true,

          broker_code:
            selectedBrokerCode,

          broker_id:
            selectedBrokerId,

          broker_name:
            selectedBroker
              ?.broker_name ?? "",

          destination_type:
            "telegram",

          destination_target:
            destinationTarget.trim(),

          accumulation_period:
            accumulationPeriod,
        };

      console.log(
        "[Signal] Saving configuration:",
        config
      );

      const response =
        await fetch(
          "/api/trade-plane",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body: JSON.stringify(
              config
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Gagal menyimpan konfigurasi."
        );
      }

      const savedConfig =
        data?.config ?? config;

      setIsTradePlaneOn(
        savedConfig.enabled === true
      );

      setSelectedBrokerCode(
        String(
          savedConfig.broker_code ??
            ""
        )
          .trim()
          .toUpperCase()
      );

      setSelectedBrokerId(
        typeof savedConfig.broker_id ===
          "number"
          ? savedConfig.broker_id
          : null
      );

      setDestinationType(
        "telegram"
      );

      setDestinationTarget(
        String(
          savedConfig.destination_target ??
            ""
        ).trim()
      );

      setAccumulationPeriod(
        normalizeAccumulationPeriod(
          savedConfig.accumulation_period
        )
      );

      /*
       * Validasi bersih setelah sukses.
       */
      setValidationMessage("");

      setSaveStatus("success");
    } catch (error) {
      console.error(
        "[Signal] Save error:",
        error
      );

      /*
       * Ini baru benar-benar error
       * dari backend/network.
       */
      setSaveStatus("error");
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      {/* =================================================
          LOGIN MODAL
      ================================================= */}

      {showLogin && (
        <div
          className="
            fixed
            inset-0
            z-[10000]
            flex
            items-center
            justify-center
            bg-black/70
            p-4
            backdrop-blur-sm
          "
        >
          <LoginRequired
            onClose={() => {
              setShowLogin(false);

              setPendingEnableAfterLogin(
                false
              );
            }}
          />
        </div>
      )}

      {/* =================================================
          DISABLE CONFIRMATION
      ================================================= */}

      {showDisableConfirm && (
        <div
          className="
            fixed
            inset-0
            z-[10000]
            flex
            items-center
            justify-center
            bg-black/70
            p-4
            backdrop-blur-sm
          "
        >
          <div
            className="
              w-full
              max-w-sm
              overflow-hidden
              rounded-2xl
              border
              border-zinc-200
              bg-white
              shadow-2xl
              dark:border-yellow-500/20
              dark:bg-zinc-900
            "
          >
            <div
              className="
                border-b
                border-zinc-200
                px-5
                py-4
                dark:border-zinc-800
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-red-500/10
                    text-red-500
                  "
                >
                  <Radio size={19} />
                </div>

                <div>
                  <h3
                    className="
                      text-sm
                      font-semibold
                      text-zinc-900
                      dark:text-white
                    "
                  >
                    Matikan Signal?
                  </h3>

                  <p
                    className="
                      mt-0.5
                      text-[10px]
                      text-zinc-500
                      dark:text-zinc-400
                    "
                  >
                    Pastikan kamu ingin
                    menonaktifkan fitur ini.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <p
                className="
                  text-xs
                  leading-relaxed
                  text-zinc-500
                  dark:text-zinc-400
                "
              >
                Signal akan dimatikan.
                Konfigurasi broker,
                periode akumulasi dan
                destination tetap tersimpan
                sehingga dapat digunakan
                kembali saat fitur diaktifkan.
              </p>
            </div>

            <div
              className="
                flex
                gap-2
                border-t
                border-zinc-200
                bg-zinc-50/70
                px-5
                py-4
                dark:border-zinc-800
                dark:bg-zinc-950/40
              "
            >
              <button
                type="button"
                onClick={
                  handleCancelDisable
                }
                className="
                  flex-1
                  rounded-xl
                  border
                  border-zinc-200
                  bg-white
                  px-4
                  py-2.5
                  text-xs
                  font-semibold
                  text-zinc-700
                  transition-all
                  hover:bg-zinc-100
                  dark:border-zinc-700
                  dark:bg-zinc-900
                  dark:text-zinc-300
                  dark:hover:bg-zinc-800
                "
              >
                Batal
              </button>

              <button
                type="button"
                onClick={
                  handleConfirmDisable
                }
                disabled={
                  isToggleSaving
                }
                className="
                  flex-1
                  rounded-xl
                  bg-red-500
                  px-4
                  py-2.5
                  text-xs
                  font-bold
                  text-white
                  transition-all
                  hover:bg-red-400
                  active:scale-[0.985]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {isToggleSaving ? (
                  <span
                    className="
                      flex
                      items-center
                      justify-center
                      gap-2
                    "
                  >
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
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

      {/* =================================================
          SIGNAL
      ================================================= */}

      <section
        className="
          relative
          z-30
          mt-5
          overflow-visible
          rounded-2xl
          border
          border-zinc-200
          bg-white/90
          p-5
          shadow-xl
          backdrop-blur-xl
          dark:border-yellow-500/20
          dark:bg-zinc-900/90
          sm:p-6
        "
      >
        {/* HEADER */}

        <div
          className="
            relative
            z-10
            flex
            items-center
            justify-between
            gap-4
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-yellow-500/10
                text-yellow-500
              "
            >
              <Radio size={18} />
            </div>

            <div className="min-w-0">
              <h2
                className="
                  text-base
                  font-semibold
                  text-zinc-900
                  dark:text-white
                "
              >
                Signal
              </h2>

              <p
                className="
                  mt-0.5
                  text-[11px]
                  text-zinc-500
                  dark:text-zinc-400
                "
              >
                Automatic signal delivery
              </p>
            </div>
          </div>

          {/* SWITCH */}

          <div
            className="
              flex
              shrink-0
              flex-col
              items-end
              gap-1
            "
          >
            <button
              type="button"
              role="switch"
              aria-checked={
                isTradePlaneOn
              }
              aria-label="Toggle Signal"
              disabled={
                authLoading ||
                isTradePlaneLoading ||
                isToggleSaving
              }
              onClick={
                handleTradePlaneToggle
              }
              className={`
                relative
                h-7
                w-12
                rounded-full
                transition-all
                duration-300
                ${
                  isTradePlaneOn
                    ? "bg-green-500 shadow-[0_0_16px_rgba(34,197,94,0.35)]"
                    : "bg-zinc-300 dark:bg-zinc-700"
                }
                ${
                  authLoading ||
                  isTradePlaneLoading ||
                  isToggleSaving
                    ? "cursor-wait opacity-60"
                    : ""
                }
              `}
            >
              <span
                className={`
                  absolute
                  top-1
                  h-5
                  w-5
                  rounded-full
                  bg-white
                  shadow-sm
                  transition-all
                  duration-300
                  ${
                    isTradePlaneOn
                      ? "left-6"
                      : "left-1"
                  }
                `}
              />
            </button>

            <span
              className={`
                text-[9px]
                font-semibold
                tracking-wider
                ${
                  isTradePlaneOn
                    ? "text-green-500"
                    : "text-zinc-400"
                }
              `}
            >
              {isTradePlaneOn
                ? "ON"
                : "OFF"}
            </span>
          </div>
        </div>

        {/* =================================================
            CONFIGURATION
        ================================================= */}

        <div
          className={`
            relative
            z-50
            grid
            overflow-visible
            transition-[grid-template-rows,opacity,margin]
            duration-500
            ease-[cubic-bezier(0.22,1,0.36,1)]
            ${
              isTradePlaneOn
                ? "mt-5 grid-rows-[1fr] opacity-100"
                : "mt-0 grid-rows-[0fr] opacity-0"
            }
          `}
        >
          <div
            className="
              min-h-0
              overflow-visible
            "
          >
            {/* DESTINATION */}

            <div
              className="
                relative
                z-10
                rounded-xl
                border
                border-zinc-200
                bg-zinc-50/80
                p-3.5
                dark:border-zinc-800
                dark:bg-zinc-950/50
              "
            >
              <div className="mb-3">
                <p
                  className="
                    text-xs
                    font-semibold
                    text-zinc-800
                    dark:text-zinc-200
                  "
                >
                  Destination
                </p>

                <p
                  className="
                    mt-0.5
                    text-[10px]
                    text-zinc-400
                  "
                >
                  Tentukan channel Telegram
                  untuk pengiriman signal.
                </p>
              </div>

              {/* TELEGRAM */}

              <div className="mt-3">
                <label
                  className="
                    mb-1.5
                    block
                    text-[10px]
                    font-medium
                    text-zinc-500
                    dark:text-zinc-400
                  "
                >
                  Telegram Chat ID
                </label>

                <input
                  type="text"
                  value={
                    destinationTarget
                  }
                  onChange={(event) =>
                    handleDestinationTargetChange(
                      event.target.value
                    )
                  }
                  placeholder="-1001234567890"
                  className={`
                    w-full
                    rounded-lg
                    border
                    bg-white
                    px-3
                    py-2.5
                    text-xs
                    text-zinc-900
                    outline-none
                    transition-all
                    placeholder:text-zinc-400
                    focus:border-yellow-500
                    focus:ring-2
                    focus:ring-yellow-500/10
                    dark:bg-zinc-900
                    dark:text-white
                    ${
                      validationMessage &&
                      !destinationTarget.trim()
                        ? "border-red-400 dark:border-red-500/60"
                        : "border-zinc-200 dark:border-zinc-800"
                    }
                  `}
                />
              </div>
            </div>

            {/* BROKER */}

            <div
              className="
                relative
                z-[100]
                mt-3
                rounded-xl
                border
                border-zinc-200
                bg-zinc-50/80
                p-3.5
                dark:border-zinc-800
                dark:bg-zinc-950/50
              "
            >
              <div
                className="
                  mb-3
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <div>
                  <p
                    className="
                      text-xs
                      font-semibold
                      text-zinc-800
                      dark:text-zinc-200
                    "
                  >
                    Broker
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-[10px]
                      text-zinc-400
                    "
                  >
                    Broker yang digunakan
                    untuk signal.
                  </p>
                </div>

                {selectedBroker && (
                  <span
                    className="
                      rounded-full
                      bg-green-500/10
                      px-2
                      py-1
                      text-[9px]
                      font-semibold
                      text-green-500
                    "
                  >
                    ACTIVE
                  </span>
                )}
              </div>

              <div
                ref={dropdownRef}
                className="
                  relative
                  z-[200]
                "
              >
                <button
                  type="button"
                  disabled={
                    isBrokerLoading ||
                    brokers.length === 0
                  }
                  onClick={() =>
                    setIsBrokerDropdownOpen(
                      (value) => !value
                    )
                  }
                  className={`
                    relative
                    z-[201]
                    flex
                    w-full
                    items-center
                    justify-between
                    gap-3
                    rounded-lg
                    border
                    bg-white
                    px-3
                    py-2.5
                    text-left
                    transition-all
                    hover:border-yellow-500/50
                    focus:border-yellow-500
                    focus:outline-none
                    dark:bg-zinc-900
                    ${
                      validationMessage &&
                      !selectedBroker
                        ? "border-red-400 dark:border-red-500/60"
                        : "border-zinc-200 dark:border-zinc-800"
                    }
                  `}
                >
                  {selectedBroker ? (
                    <div
                      className="
                        flex
                        min-w-0
                        items-center
                        gap-2.5
                      "
                    >
                      <span
                        className={`
                          text-sm
                          font-bold
                          tracking-wide
                          ${
                            selectedBroker.is_foreign
                              ? "text-red-500"
                              : "text-zinc-900 dark:text-white"
                          }
                        `}
                      >
                        {
                          selectedBroker.broker_code
                        }
                      </span>

                      <span
                        className="
                          truncate
                          text-xs
                          text-zinc-500
                          dark:text-zinc-400
                        "
                      >
                        {
                          selectedBroker.broker_name
                        }
                      </span>
                    </div>
                  ) : (
                    <span
                      className="
                        text-xs
                        text-zinc-400
                      "
                    >
                      {isBrokerLoading
                        ? "Memuat broker..."
                        : "Pilih broker"}
                    </span>
                  )}

                  <ChevronDown
                    size={16}
                    className={`
                      shrink-0
                      text-zinc-400
                      transition-transform
                      duration-200
                      ${
                        isBrokerDropdownOpen
                          ? "rotate-180"
                          : ""
                      }
                    `}
                  />
                </button>

                {isBrokerDropdownOpen &&
                  brokers.length > 0 && (
                    <div
                      className="
                        absolute
                        left-0
                        right-0
                        top-full
                        z-[99999]
                        mt-2
                        max-h-64
                        overflow-y-auto
                        overscroll-contain
                        rounded-xl
                        border
                        border-zinc-200
                        bg-white
                        p-1.5
                        shadow-[0_20px_50px_rgba(0,0,0,0.22)]
                        dark:border-zinc-700
                        dark:bg-zinc-900
                        dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)]
                      "
                    >
                      {brokers.map(
                        (broker) => {
                          const selected =
                            broker.broker_code ===
                            selectedBrokerCode;

                          return (
                            <button
                              key={`${broker.broker_code}-${broker.broker_id}`}
                              type="button"
                              onClick={() =>
                                handleBrokerSelect(
                                  broker
                                )
                              }
                              className={`
                                flex
                                w-full
                                items-center
                                justify-between
                                gap-3
                                rounded-lg
                                px-3
                                py-2.5
                                text-left
                                transition-colors
                                ${
                                  selected
                                    ? "bg-yellow-500/10"
                                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                }
                              `}
                            >
                              <div
                                className="
                                  flex
                                  min-w-0
                                  items-center
                                  gap-2.5
                                "
                              >
                                <span
                                  className={`
                                    text-sm
                                    font-bold
                                    ${
                                      broker.is_foreign
                                        ? "text-red-500"
                                        : "text-zinc-900 dark:text-white"
                                    }
                                  `}
                                >
                                  {
                                    broker.broker_code
                                  }
                                </span>

                                <span
                                  className="
                                    truncate
                                    text-xs
                                    text-zinc-500
                                    dark:text-zinc-400
                                  "
                                >
                                  {
                                    broker.broker_name
                                  }
                                </span>
                              </div>

                              {selected && (
                                <Check
                                  size={15}
                                  className="
                                    shrink-0
                                    text-green-500
                                  "
                                />
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>
            </div>

            {/* =================================================
                ACCUMULATION PERIOD
            ================================================= */}

            <div
              className="
                relative
                z-[90]
                mt-3
                rounded-xl
                border
                border-zinc-200
                bg-zinc-50/80
                p-3.5
                dark:border-zinc-800
                dark:bg-zinc-950/50
              "
            >
              <div className="mb-3">
                <p
                  className="
                    text-xs
                    font-semibold
                    text-zinc-800
                    dark:text-zinc-200
                  "
                >
                  Accumulation Period
                </p>

                <p
                  className="
                    mt-0.5
                    text-[10px]
                    text-zinc-400
                  "
                >
                  Periode yang digunakan
                  untuk menghitung akumulasi
                  broker.
                </p>
              </div>

              <div
                className="
                  grid
                  grid-cols-1
                  gap-2
                  sm:grid-cols-2
                "
              >
                {accumulationPeriodOptions.map(
                  (option) => {
                    const selected =
                      accumulationPeriod ===
                      option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          handleAccumulationPeriodChange(
                            option.value
                          )
                        }
                        className={`
                          flex
                          items-center
                          justify-between
                          gap-3
                          rounded-lg
                          border
                          px-3
                          py-2.5
                          text-left
                          transition-all
                          ${
                            selected
                              ? "border-yellow-500/50 bg-yellow-500/10"
                              : "border-zinc-200 bg-white hover:border-yellow-500/30 hover:bg-yellow-500/5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-yellow-500/30"
                          }
                        `}
                      >
                        <div className="min-w-0">
                          <p
                            className={`
                              text-xs
                              font-semibold
                              ${
                                selected
                                  ? "text-yellow-500"
                                  : "text-zinc-800 dark:text-zinc-200"
                              }
                            `}
                          >
                            {
                              option.label
                            }
                          </p>

                          <p
                            className="
                              mt-0.5
                              text-[9px]
                              text-zinc-400
                            "
                          >
                            {
                              option.description
                            }
                          </p>
                        </div>

                        <div
                          className={`
                            flex
                            h-5
                            w-5
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            border
                            transition-all
                            ${
                              selected
                                ? "border-yellow-500 bg-yellow-500 text-zinc-950"
                                : "border-zinc-300 dark:border-zinc-700"
                            }
                          `}
                        >
                          {selected && (
                            <Check
                              size={12}
                              strokeWidth={
                                3
                              }
                            />
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              {/* CURRENT PERIOD */}

              <div
                className="
                  mt-2.5
                  flex
                  items-center
                  justify-between
                  gap-3
                  rounded-lg
                  bg-zinc-100
                  px-3
                  py-2
                  dark:bg-zinc-900
                "
              >
                <span
                  className="
                    text-[9px]
                    text-zinc-400
                  "
                >
                  Periode aktif
                </span>

                <span
                  className="
                    text-[10px]
                    font-semibold
                    text-yellow-500
                  "
                >
                  {
                    selectedAccumulationPeriod.label
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            VALIDATION MESSAGE
        ================================================= */}

        {isTradePlaneOn &&
          validationMessage && (
            <div
              className="
                relative
                z-10
                mt-3
                flex
                items-center
                gap-2
                rounded-xl
                border
                border-yellow-500/20
                bg-yellow-500/5
                px-3.5
                py-3
                text-[10px]
                font-medium
                text-yellow-600
                dark:text-yellow-400
              "
            >
              <span
                className="
                  flex
                  h-5
                  w-5
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-yellow-500/10
                  text-[10px]
                  font-bold
                "
              >
                !
              </span>

              <span>
                {validationMessage}
              </span>
            </div>
          )}

        {/* =================================================
            SAVE BUTTON
        ================================================= */}

        {isTradePlaneOn && (
          <div className="relative z-10">
            <button
              type="button"
              onClick={
                handleSaveTradePlane
              }
              disabled={
                saveStatus ===
                  "saving" ||
                isTradePlaneLoading ||
                isToggleSaving
              }
              className="
                mt-3
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-yellow-500
                px-4
                py-3
                text-xs
                font-bold
                text-zinc-950
                shadow-[0_8px_25px_rgba(234,179,8,0.15)]
                transition-all
                duration-200
                hover:bg-yellow-400
                hover:shadow-[0_10px_30px_rgba(234,179,8,0.25)]
                active:scale-[0.985]
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {saveStatus ===
              "saving" ? (
                <>
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                  Menyimpan...
                </>
              ) : saveStatus ===
                "success" ? (
                <>
                  <Check size={15} />
                  Tersimpan
                </>
              ) : (
                <>
                  <Check size={15} />
                  Simpan Konfigurasi
                </>
              )}
            </button>
          </div>
        )}

        {/* =================================================
            SERVER ERROR
        ================================================= */}

        {saveStatus ===
          "error" && (
          <div
            className="
              relative
              z-10
              mt-2
              rounded-lg
              bg-red-500/5
              px-3
              py-2
              text-center
              text-[10px]
              text-red-500
            "
          >
            Terjadi kesalahan. Silakan
            coba lagi.
          </div>
        )}

        {/* =================================================
            SUCCESS
        ================================================= */}

        {saveStatus ===
          "success" &&
          isTradePlaneOn && (
            <div
              className="
                relative
                z-10
                mt-2
                flex
                items-center
                justify-center
                gap-1.5
                rounded-lg
                bg-green-500/5
                px-3
                py-2
                text-[10px]
                text-green-500
              "
            >
              <Check size={12} />
              Konfigurasi berhasil disimpan.
            </div>
          )}

        {/* =================================================
            CURRENT STATUS
        ================================================= */}

        <div
          className={`
            relative
            z-10
            mt-3
            flex
            items-center
            gap-2
            rounded-lg
            border
            px-3
            py-2.5
            ${
              isTradePlaneOn
                ? "border-green-500/15 bg-green-500/5"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40"
            }
          `}
        >
          <span
            className={`
              h-1.5
              w-1.5
              rounded-full
              ${
                isTradePlaneOn
                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]"
                  : "bg-zinc-400"
              }
            `}
          />

          <span
            className={`
              text-[10px]
              ${
                isTradePlaneOn
                  ? "text-green-500"
                  : "text-zinc-500"
              }
            `}
          >
            {isTradePlaneOn
              ? `Signal aktif${
                  selectedBroker
                    ? ` • ${selectedBroker.broker_code}`
                    : ""
                }`
              : "Signal tidak aktif"}
          </span>
        </div>

        {/* =================================================
            NOTES
        ================================================= */}

        <div
          className="
            relative
            z-10
            mt-5
            rounded-xl
            border
            border-yellow-500/15
            bg-zinc-50/70
            px-4
            py-3.5
            dark:bg-zinc-950/40
          "
        >
          <div
            className="
              border-l-2
              border-yellow-500
              pl-3
            "
          >
            <p
              className="
                mb-2
                text-xs
                font-semibold
                text-yellow-500
              "
            >
              Notes
            </p>

            <ul
              className="
                space-y-1.5
                text-[10px]
                leading-relaxed
                text-zinc-500
                dark:text-zinc-400
              "
            >
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="
                    flex
                    items-start
                    gap-2
                  "
                >
                  <span
                    className="
                      mt-[5px]
                      h-1
                      w-1
                      shrink-0
                      rounded-full
                      bg-zinc-400
                    "
                  />

                  <span>
                    {note.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}