/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Radio,
} from "lucide-react";

import { InfiniteMarqueeSlider } from "./components/fungsi/infiniteSlider";
import { useAuth } from "./components/auth/AuthProvider";
import LoginRequired from "./components/auth/LoginRequired";

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

type DestinationType = "telegram" | "whatsapp";

type TradePlaneConfig = {
  enabled: boolean;
  broker_code: string;
  broker_id: number | null;
  broker_name: string;
  destination_type: DestinationType;
  destination_target: string;
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
    note: "Kadang tidak trade sama sekali adalah pilihan terbaik."
  }
];

/* =========================================================
   LINKS
========================================================= */

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
  };
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
      "[Trade Plane] Broker cache error:",
      error
    );

    return [];
  }
}

/* =========================================================
   HOME
========================================================= */

export default function Home() {
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

  /*
   * Popup ketika user ingin mematikan
   * Trade Plane.
   */
  const [
    showDisableConfirm,
    setShowDisableConfirm,
  ] = useState(false);

  /*
   * Menyimpan action setelah login.
   *
   * Hanya digunakan untuk:
   *
   * OFF -> ON -> belum login
   *
   * Setelah login, switch otomatis
   * diaktifkan.
   */
  const [
    pendingEnableAfterLogin,
    setPendingEnableAfterLogin,
  ] = useState(false);

  /*
   * User sebelumnya.
   *
   * Digunakan untuk mendeteksi logout.
   */
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
     TRADE PLANE
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

  /* =======================================================
     SAVE
  ======================================================= */

  const [
    saveStatus,
    setSaveStatus,
  ] = useState<SaveStatus>(
    "idle"
  );

  /* =======================================================
     SERVER LOADING
  ======================================================= */

  const [
    isTradePlaneLoading,
    setIsTradePlaneLoading,
  ] = useState(false);

  /*
   * Mencegah klik switch berulang
   * ketika sedang PUT.
   */
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
          `[Trade Plane] Broker loaded from localStorage: ${cached.length}`
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
            "[Trade Plane] Failed to save broker cache:",
            storageError
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[Trade Plane] Broker fetch error:",
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
     LOAD SAVED TRADE PLANE
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadTradePlane() {
      /*
       * Belum login.
       *
       * Jangan menghapus draft UI.
       */
      if (!user) {
        setIsTradePlaneLoading(false);
        return;
      }

      /*
       * Kalau user baru saja login
       * karena meminta OFF -> ON,
       * konfigurasi server tetap perlu
       * dimuat terlebih dahulu.
       */
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
              "Gagal mengambil konfigurasi Trade Plane."
          );
        }

        if (cancelled) {
          return;
        }

        const config =
          data?.config ??
          getDefaultTradePlaneConfig();

        /*
         * ENABLED
         *
         * Jika sedang menunggu enable
         * setelah login, jangan menimpa
         * state dengan false sebelum PUT.
         */
        if (!pendingEnableAfterLogin) {
          setIsTradePlaneOn(
            config.enabled === true
          );
        }

        /*
         * BROKER
         */

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

        /*
         * DESTINATION
         */

        setDestinationType(
          config.destination_type ===
            "whatsapp"
            ? "whatsapp"
            : "telegram"
        );

        setDestinationTarget(
          String(
            config.destination_target ??
              ""
          ).trim()
        );

        setSaveStatus("idle");
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[Trade Plane] Load error:",
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
        "[Trade Plane] User logout. Reset UI state."
      );

      setIsTradePlaneOn(false);

      setSelectedBrokerCode("");
      setSelectedBrokerId(null);

      setDestinationType("telegram");
      setDestinationTarget("");

      setSaveStatus("idle");

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
     * Sekarang baru benar-benar
     * aktifkan Trade Plane ke DB.
     */

    setShowLogin(false);

    setPendingEnableAfterLogin(
      false
    );

    void enableTradePlane(
      user
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
     ENABLE TRADE PLANE
  ======================================================= */

  async function enableTradePlane(
    currentUser: NonNullable<
      typeof user
    >
  ) {
    if (isToggleSaving) {
      return;
    }

    setIsToggleSaving(true);
    setSaveStatus("saving");

    try {
      const idToken =
        await currentUser.getIdToken();

      /*
       * PENTING:
       *
       * Saat ON:
       * broker + destination yang sudah
       * tersimpan tetap dikirim.
       *
       * Jadi enabled:true tidak
       * menghapus konfigurasi lama.
       */
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
            destinationType,

          destination_target:
            destinationTarget.trim(),
        };

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
            "Gagal mengaktifkan Trade Plane."
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
        savedConfig.destination_type ===
          "whatsapp"
          ? "whatsapp"
          : "telegram"
      );

      setDestinationTarget(
        String(
          savedConfig.destination_target ??
            ""
        ).trim()
      );

      setSaveStatus("success");
    } catch (error) {
      console.error(
        "[Trade Plane] Enable error:",
        error
      );

      /*
       * Kalau gagal enable,
       * switch harus kembali OFF.
       */
      setIsTradePlaneOn(false);

      setSaveStatus("error");
    } finally {
      setIsToggleSaving(false);
    }
  }

  /* =======================================================
     DISABLE TRADE PLANE
  ======================================================= */

  async function disableTradePlane() {
    if (!user || isToggleSaving) {
      return;
    }

    setIsToggleSaving(true);
    setSaveStatus("saving");

    try {
      const idToken =
        await user.getIdToken();

      /*
       * PENTING:
       *
       * Hanya enabled:false.
       *
       * Broker + destination TIDAK dihapus.
       */
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
            "Gagal mematikan Trade Plane."
        );
      }

      const savedConfig =
        data?.config;

      /*
       * Server berhasil.
       */
      setIsTradePlaneOn(false);

      /*
       * Jangan hapus broker/destination.
       *
       * Kalau API mengembalikan config,
       * sinkronkan juga data tersebut.
       */
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
          savedConfig.destination_type ===
            "whatsapp"
            ? "whatsapp"
            : destinationType
        );

        setDestinationTarget(
          String(
            savedConfig.destination_target ??
              destinationTarget
          ).trim()
        );
      }

      setSaveStatus("success");
    } catch (error) {
      console.error(
        "[Trade Plane] Disable error:",
        error
      );

      /*
       * Gagal OFF -> tetap ON.
       */
      setIsTradePlaneOn(true);

      setSaveStatus("error");
    } finally {
      setIsToggleSaving(false);
    }
  }

  /* =======================================================
     TOGGLE TRADE PLANE
  ======================================================= */

  const handleTradePlaneToggle =
    () => {
      /*
       * Jangan izinkan toggle ketika
       * authentication masih diperiksa.
       */
      if (
        authLoading ||
        isTradePlaneLoading ||
        isToggleSaving
      ) {
        return;
      }

      /* =================================================
         ON -> OFF
         
         Tampilkan popup.
      ================================================= */

      if (isTradePlaneOn) {
        setShowDisableConfirm(true);
        return;
      }

      /* =================================================
         OFF -> ON
      ================================================= */

      /*
       * Belum login.
       *
       * Jangan ON dulu.
       * Minta login.
       */
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
       * Langsung enable:true ke DB.
       */
      void enableTradePlane(user);
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

    setSaveStatus("idle");
  };

  /* =======================================================
     DESTINATION
  ======================================================= */

  const handleDestinationChange = (
    type: DestinationType
  ) => {
    setDestinationType(type);
    setSaveStatus("idle");
  };

  /* =======================================================
     TARGET
  ======================================================= */

  const handleDestinationTargetChange =
    (value: string) => {
      setDestinationTarget(value);
      setSaveStatus("idle");
    };

  /* =======================================================
     SAVE CONFIGURATION
     
     TIDAK ADA LOGIN CHECK DI SINI.
     
     Karena tombol Save hanya boleh
     digunakan ketika Trade Plane ON,
     dan ON sudah memastikan user login.
  ======================================================= */

  const handleSaveTradePlane =
    async () => {
      /*
       * ON harus login.
       */
      if (!user) {
        /*
         * Ini hanya fallback safety.
         *
         * Normalnya tidak akan pernah
         * terjadi karena switch ON
         * sudah membutuhkan login.
         */
        setIsTradePlaneOn(false);
        setPendingEnableAfterLogin(
          true
        );
        setShowLogin(true);
        return;
      }

      /*
       * Broker wajib.
       */
      if (
        !selectedBroker ||
        selectedBrokerId === null
      ) {
        setSaveStatus("error");
        return;
      }

      /*
       * Destination wajib.
       */
      if (
        !destinationTarget.trim()
      ) {
        setSaveStatus("error");
        return;
      }

      /*
       * Simpan konfigurasi.
       *
       * enabled tetap TRUE karena
       * switch sedang ON.
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
            destinationType,

          destination_target:
            destinationTarget.trim(),
        };

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
        savedConfig.destination_type ===
          "whatsapp"
          ? "whatsapp"
          : "telegram"
      );

      setDestinationTarget(
        String(
          savedConfig.destination_target ??
            ""
        ).trim()
      );

      setSaveStatus("success");
    } catch (error) {
      console.error(
        "[Trade Plane] Save error:",
        error
      );

      setSaveStatus("error");
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

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

              /*
               * Kalau login dibatalkan,
               * batalkan juga pending ON.
               */
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
                    Matikan Trade Plane?
                  </h3>

                  <p
                    className="
                      mt-0.5
                      text-[10px]
                      text-zinc-500
                      dark:text-zinc-400
                    "
                  >
                    Pastikan kamu ingin menonaktifkan
                    fitur ini.
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
                Trade Plane akan dimatikan.
                Konfigurasi broker dan
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
          PAGE TITLE
      ================================================= */}

      <h1 className="text-xl font-semibold">
        Broker Activity
      </h1>

      {/* =================================================
          MAIN
      ================================================= */}

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

        {/* =================================================
            TOOLS
        ================================================= */}

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
          </div>
        </main>

        {/* =================================================
            TRADE PLANE
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
                  Trade Plane
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
                aria-label="Toggle Trade Plane"
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
                    Tentukan platform pengiriman signal.
                  </p>
                </div>

                <div
                  className="
                    grid
                    grid-cols-2
                    gap-2
                  "
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleDestinationChange(
                        "telegram"
                      )
                    }
                    className={`
                      rounded-lg
                      border
                      px-3
                      py-2.5
                      text-xs
                      font-semibold
                      transition-all
                      duration-200
                      ${
                        destinationType ===
                        "telegram"
                          ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-500"
                          : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      }
                    `}
                  >
                    Telegram
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDestinationChange(
                        "whatsapp"
                      )
                    }
                    className={`
                      rounded-lg
                      border
                      px-3
                      py-2.5
                      text-xs
                      font-semibold
                      transition-all
                      duration-200
                      ${
                        destinationType ===
                        "whatsapp"
                          ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-500"
                          : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      }
                    `}
                  >
                    WhatsApp
                  </button>
                </div>

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
                    {destinationType ===
                    "telegram"
                      ? "Telegram Chat ID"
                      : "WhatsApp Number"}
                  </label>

                  <input
                    type={
                      destinationType ===
                      "whatsapp"
                        ? "tel"
                        : "text"
                    }
                    value={
                      destinationTarget
                    }
                    onChange={(event) =>
                      handleDestinationTargetChange(
                        event.target.value
                      )
                    }
                    placeholder={
                      destinationType ===
                      "telegram"
                        ? "-1001234567890"
                        : "628123456789"
                    }
                    className="
                      w-full
                      rounded-lg
                      border
                      border-zinc-200
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
                      dark:border-zinc-800
                      dark:bg-zinc-900
                      dark:text-white
                    "
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
                      Broker yang digunakan untuk signal.
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
                    className="
                      relative
                      z-[201]
                      flex
                      w-full
                      items-center
                      justify-between
                      gap-3
                      rounded-lg
                      border
                      border-zinc-200
                      bg-white
                      px-3
                      py-2.5
                      text-left
                      transition-all
                      hover:border-yellow-500/50
                      focus:border-yellow-500
                      focus:outline-none
                      dark:border-zinc-800
                      dark:bg-zinc-900
                    "
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
            </div>
          </div>

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
              STATUS
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
              Terjadi kesalahan. Silakan coba lagi.
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
                ? `Trade Plane aktif${
                    selectedBroker
                      ? ` • ${selectedBroker.broker_code}`
                      : ""
                  }`
                : "Trade Plane tidak aktif"}
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

        {/* =================================================
            MARQUEE
        ================================================= */}

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

