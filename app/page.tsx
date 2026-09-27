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
    note: "Fitur untuk mengirimkan signal ke channel.",
  },
  {
    id: 2,
    note: "Jangan trade dikala market sedang kacau atau ada event tertentu yang berpengaruh terhadap market.",
  },
  {
    id: 3,
    note: "Sebagus apapun analisamu akan hancur jika ada kejadian atau event tertentu, karena event diatas segalanya dalam dunia saham.",
  },
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

        /* -----------------------------------------
           FOREIGN
        ----------------------------------------- */

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

        /* -----------------------------------------
           BROKER ID
        ----------------------------------------- */

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

    const normalized =
      normalizeBrokers(parsed);

    return normalized;
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
   * TRUE ketika user klik save
   * dalam kondisi belum login.
   *
   * Setelah login berhasil,
   * konfigurasi otomatis disimpan.
   */
  const [
    pendingSaveAfterLogin,
    setPendingSaveAfterLogin,
  ] = useState(false);

  /*
   * Menyimpan user sebelumnya.
   *
   * Dipakai untuk mendeteksi perubahan:
   *
   * sebelumnya login
   *        ↓
   * sekarang logout
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

     ALUR:

     1. Cek localStorage
     2. Kalau ada dan valid -> gunakan cache
     3. Kalau tidak ada -> fetch API
     4. Simpan hasil fetch ke localStorage
======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadBrokers() {
      /*
       * -----------------------------------------------------
       * STEP 1
       * Cek localStorage terlebih dahulu.
       * -----------------------------------------------------
       */

      const cached =
        getCachedBrokers();

      /*
       * Kalau cache ADA dan berisi data,
       * JANGAN FETCH API LAGI.
       */

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

      /*
       * -----------------------------------------------------
       * STEP 2
       * Cache tidak ada / kosong.
       * Baru fetch API.
       * -----------------------------------------------------
       */

      try {
        if (!cancelled) {
          setIsBrokerLoading(true);
        }

        console.log(
          "[Trade Plane] Broker cache kosong. Fetching /api/brokers..."
        );

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

        /*
         * -----------------------------------------------------
         * STEP 3
         * Normalisasi response API.
         * -----------------------------------------------------
         */

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

        /*
         * -----------------------------------------------------
         * STEP 4
         * Simpan ke state.
         * -----------------------------------------------------
         */

        setBrokers(
          fetchedBrokers
        );

        /*
         * -----------------------------------------------------
         * STEP 5
         * Simpan hasil fetch ke localStorage.
         * -----------------------------------------------------
         */

        try {
          localStorage.setItem(
            BROKERS_CACHE_KEY,
            JSON.stringify(
              fetchedBrokers
            )
          );

          console.log(
            `[Trade Plane] Broker fetched & cached: ${fetchedBrokers.length}`
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

     HANYA USER LOGIN
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadTradePlane() {
      /*
       * Belum login.
       *
       * Jangan reset draft di sini.
       */
      if (!user) {
        setIsTradePlaneLoading(
          false
        );

        return;
      }

      /*
       * Kalau baru selesai login karena
       * sedang menunggu save, jangan ambil
       * config server terlebih dahulu.
       */
      if (pendingSaveAfterLogin) {
        return;
      }

      try {
        setIsTradePlaneLoading(
          true
        );

        const idToken =
          await user.getIdToken();

        const response =
          await fetch(
            "/api/trade-plane",
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${idToken}`,
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
         */

        setIsTradePlaneOn(
          config.enabled === true
        );

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
          setIsTradePlaneLoading(
            false
          );
        }
      }
    }

    void loadTradePlane();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    pendingSaveAfterLogin,
  ]);

  /* =======================================================
     RESET UI SAAT LOGOUT
     
     PENTING:
     HANYA STATE UI YANG DIHAPUS.
     
     FIRESTORE TIDAK DIHAPUS.
======================================================= */

  useEffect(() => {
    /*
     * Tunggu Firebase selesai menentukan
     * status authentication.
     */
    if (authLoading) {
      return;
    }

    /*
     * Kalau sebelumnya ada user lalu sekarang
     * user menjadi null, berarti user baru saja
     * logout.
     */
    if (
      previousUserRef.current &&
      !user
    ) {
      console.log(
        "[Trade Plane] User logout. Reset UI state."
      );

      /*
       * Reset Trade Plane
       */
      setIsTradePlaneOn(false);

      /*
       * Reset broker
       */
      setSelectedBrokerCode("");
      setSelectedBrokerId(null);

      /*
       * Reset destination
       */
      setDestinationType("telegram");
      setDestinationTarget("");

      /*
       * Reset status
       */
      setSaveStatus("idle");

      /*
       * Reset loading
       */
      setIsTradePlaneLoading(false);

      /*
       * Tutup dropdown
       */
      setIsBrokerDropdownOpen(false);

      /*
       * Bersihkan pending login/save
       */
      setPendingSaveAfterLogin(false);

      /*
       * Tutup login modal jika masih terbuka
       */
      setShowLogin(false);
    }

    /*
     * Simpan user saat ini untuk dibandingkan
     * dengan authentication state berikutnya.
     */
    previousUserRef.current = user;
  }, [
    user,
    authLoading,
  ]);

  /* =======================================================
     SAVE AFTER LOGIN
  ======================================================= */

  useEffect(() => {
    if (
      !user ||
      !pendingSaveAfterLogin
    ) {
      return;
    }

    setShowLogin(false);

    setPendingSaveAfterLogin(
      false
    );

    void saveTradePlaneWithUser(
      user,
      true
    );
  }, [
    user,
    pendingSaveAfterLogin,
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
     TOGGLE TRADE PLANE
  ======================================================= */

  const handleTradePlaneToggle =
    async () => {
      const nextState =
        !isTradePlaneOn;

      setIsTradePlaneOn(
        nextState
      );

      setSaveStatus("idle");

      /*
       * Kalau OFF:
       * tutup broker dropdown.
       */
      if (!nextState) {
        setIsBrokerDropdownOpen(
          false
        );

        /*
         * Kalau sudah login,
         * langsung simpan status OFF
         * ke Firestore.
         */
        if (user) {
          await saveTradePlaneWithUser(
            user,
            false
          );
        }
      }
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
     SAVE TO FIREBASE
  ======================================================= */

  async function saveTradePlaneWithUser(
    currentUser: NonNullable<
      typeof user
    >,
    enabledOverride?: boolean
  ) {
    setSaveStatus("saving");

    try {
      const idToken =
        await currentUser.getIdToken();

      const enabled =
        enabledOverride ??
        isTradePlaneOn;

      const config: TradePlaneConfig =
        {
          enabled,

          broker_code: enabled
            ? selectedBrokerCode
            : "",

          broker_id: enabled
            ? selectedBrokerId
            : null,

          broker_name: enabled
            ? selectedBroker
                ?.broker_name ?? ""
            : "",

          destination_type: enabled
            ? destinationType
            : "telegram",

          destination_target:
            enabled
              ? destinationTarget.trim()
              : "",
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

      /*
       * Sync kembali state dari server.
       */

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
     SAVE BUTTON
  ======================================================= */

  const handleSaveTradePlane =
    async () => {
      /*
       * Hanya dipanggil ketika ON.
       */

      if (
        !selectedBroker ||
        selectedBrokerId === null
      ) {
        setSaveStatus("error");
        return;
      }

      if (
        !destinationTarget.trim()
      ) {
        setSaveStatus("error");
        return;
      }

      /*
       * Belum login.
       */

      if (!user) {
        setPendingSaveAfterLogin(
          true
        );

        setShowLogin(true);

        return;
      }

      /*
       * Sudah login.
       */

      await saveTradePlaneWithUser(
        user,
        true
      );
    };

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
              setPendingSaveAfterLogin(
                false
              );
            }}
          />
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
        {/* GLOW */}

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

            {/* BROKER ACCUMULATION */}

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
                    {
                      links[0]
                        .description
                    }
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

            {/* BROKER MOVEMENT */}

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
                    {
                      links[1]
                        .description
                    }
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
                aria-checked={isTradePlaneOn}
                aria-label="Toggle Trade Plane"
                disabled={
                  authLoading ||
                  isTradePlaneLoading
                }
                onClick={handleTradePlaneToggle}
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
                    isTradePlaneLoading
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
                {isTradePlaneOn ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {/* =================================================
              CONFIGURATION PANEL
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

                {/* TYPE */}

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
                      handleDestinationChange("telegram")
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
                        destinationType === "telegram"
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
                      handleDestinationChange("whatsapp")
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
                        destinationType === "whatsapp"
                          ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-500"
                          : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      }
                    `}
                  >
                    WhatsApp
                  </button>
                </div>

                {/* TARGET */}

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
                    {destinationType === "telegram"
                      ? "Telegram Chat ID"
                      : "WhatsApp Number"}
                  </label>

                  <input
                    type={
                      destinationType === "whatsapp"
                        ? "tel"
                        : "text"
                    }
                    value={destinationTarget}
                    onChange={(event) =>
                      handleDestinationTargetChange(
                        event.target.value
                      )
                    }
                    placeholder={
                      destinationType === "telegram"
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

                {/* BROKER DROPDOWN */}

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
                          {selectedBroker.broker_code}
                        </span>

                        <span
                          className="
                            truncate
                            text-xs
                            text-zinc-500
                            dark:text-zinc-400
                          "
                        >
                          {selectedBroker.broker_name}
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

                  {/* DROPDOWN LIST */}

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
                        {brokers.map((broker) => {
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
                                  {broker.broker_code}
                                </span>

                                <span
                                  className="
                                    truncate
                                    text-xs
                                    text-zinc-500
                                    dark:text-zinc-400
                                  "
                                >
                                  {broker.broker_name}
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
                        })}
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
                onClick={handleSaveTradePlane}
                disabled={
                  saveStatus === "saving" ||
                  isTradePlaneLoading
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
                {saveStatus === "saving" ? (
                  <>
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                    Menyimpan...
                  </>
                ) : saveStatus === "success" ? (
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

          {saveStatus === "success" &&
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

          {saveStatus === "error" &&
            isTradePlaneOn && (
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
                Pastikan broker dan destination
                sudah diisi dengan benar.
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

                    <span>{note.note}</span>
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