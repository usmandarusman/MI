/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

"use client";

import { createPortal } from "react-dom";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  Database,
  Eraser,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import Input from "../components/fragments/ui/input";
import { BrokerPopup } from "../components/fragments/popup/brokerPopup";

type BrokerData = {
  id: string;
  broker: string;
  emiten: string;
  freeFloat: string;
  cso: string;
  netBuy: string;
  accumulation: number;
};

type Security = {
  code: string;
  name: string;
};

type BrokerOption = {
  broker_code: string;
  broker_name: string;
  is_foreign: boolean | null;
  is_bumn?: boolean;
  category?: string;
  type?: string;
  [key: string]: unknown;
};

type OwnershipResponse = {
  code: string;
  shares: string | number | null;
  freeFloatPercent: string | number | null;
  error?: string;
};

const STORAGE_KEY = "broker-accumulation-data";

const SECURITIES_CACHE_KEY =
  "idx-securities-cache-v1";

const BROKERS_CACHE_KEY =
  "idx-brokers-cache-v1";

// Form hanya membutuhkan broker, emiten, dan net buy.
const initialForm = {
  broker: "",
  emiten: "",
  netBuy: "",
};

function normalizeSecurities(
  payload: unknown
): Security[] {
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
      obj.data &&
      typeof obj.data === "object" &&
      Array.isArray(
        (obj.data as Record<string, unknown>)
          .data
      )
    ) {
      rows = (
        obj.data as Record<string, unknown>
      ).data as unknown[];
    } else if (
      Array.isArray(obj.securities)
    ) {
      rows = obj.securities;
    }
  }

  const mapped = rows
    .map((item): Security | null => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      const row =
        item as Record<string, unknown>;

      const code = String(
        row.Code ??
          row.code ??
          row.ticker ??
          row.symbol ??
          ""
      )
        .trim()
        .toUpperCase();

      const name = String(
        row.Name ??
          row.name ??
          row.CompanyName ??
          row.companyName ??
          row.company_name ??
          ""
      ).trim();

      if (!code) return null;

      return {
        code,
        name,
      };
    })
    .filter(
      (
        item
      ): item is Security =>
        item !== null
    );

  return Array.from(
    new Map(
      mapped.map((item) => [
        item.code,
        item,
      ])
    ).values()
  ).sort((a, b) =>
    a.code.localeCompare(b.code)
  );
}

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
      typeof obj.data === "object" &&
      Array.isArray(
        (obj.data as Record<string, unknown>)
          .data
      )
    ) {
      rows = (
        obj.data as Record<string, unknown>
      ).data as unknown[];
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

        const code = String(
          row.broker_code ??
            row.code ??
            ""
        )
          .trim()
          .toUpperCase();

        if (!code) return null;

        const name = String(
          row.broker_name ??
            row.name ??
            code
        ).trim();

        const rawForeign =
          row.is_foreign;

        let isForeign:
          | boolean
          | null = null;

        if (
          rawForeign === 1 ||
          rawForeign === "1" ||
          rawForeign === true
        ) {
          isForeign = true;
        } else if (
          rawForeign === 0 ||
          rawForeign === "0" ||
          rawForeign === false
        ) {
          isForeign = false;
        }

        return {
          ...row,
          broker_code: code,
          broker_name:
            name || code,
          is_foreign: isForeign,
        } as BrokerOption;
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
      mapped.map((item) => [
        item.broker_code,
        item,
      ])
    ).values()
  ).sort((a, b) =>
    a.broker_code.localeCompare(
      b.broker_code
    )
  );
}

const parseValue = (
  value: string
): number => {
  const clean = value
    .trim()
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  if (!clean) return 0;

  const multiplier = clean.endsWith("B")
    ? 1_000_000_000
    : clean.endsWith("M")
      ? 1_000_000
      : clean.endsWith("K")
        ? 1_000
        : 1;

  const number = parseFloat(
    clean.replace(/[KMB]$/, "")
  );

  return Number.isNaN(number)
    ? 0
    : number * multiplier;
};

const formatInput = (
  field: keyof typeof initialForm,
  value: string
): string => {
  if (field === "broker") {
    return value
      .toUpperCase()
      .replace(/[^A-Z\s]/g, "")
      .slice(0, 50);
  }

  if (field === "emiten") {
    return value
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
  }

  if (field === "netBuy") {
    return value
      .toUpperCase()
      .replace(
        /[^0-9.,BKM-]/g,
        ""
      )
      .replace(/,/g, ".");
  }

  return value;
};

function getBrokerColor(
  broker: BrokerOption
) {
  const row =
    broker as Record<
      string,
      unknown
    >;

  const isBumn =
    row.is_bumn === true ||
    row.is_bumn === 1 ||
    row.is_bumn === "1" ||
    String(
      row.category ??
        row.type ??
        ""
    )
      .toLowerCase()
      .includes("bumn");

  if (isBumn) {
    return "text-green-600 dark:text-green-400";
  }

  if (broker.is_foreign === true) {
    return "text-red-500 dark:text-red-400";
  }

  return "text-zinc-900 dark:text-zinc-100";
}

function formatNumberForInput(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  return String(value).trim();
}

function formatPercentForInput(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const text = String(value).trim();

  return text.endsWith("%")
    ? text
    : `${text}%`;
}

export default function BrokerAccumulation() {
  const [form, setForm] =
    useState(initialForm);

  const [data, setData] =
    useState<BrokerData[]>([]);

  const [isStorageLoaded, setIsStorageLoaded] =
    useState(false);

  const [securities, setSecurities] =
    useState<Security[]>([]);

  const [
    isSecuritiesLoading,
    setIsSecuritiesLoading,
  ] = useState(false);

  const [
    securitiesError,
    setSecuritiesError,
  ] = useState("");

  const [brokers, setBrokers] =
    useState<BrokerOption[]>([]);

  const [
    isBrokersLoading,
    setIsBrokersLoading,
  ] = useState(false);

  const [
    brokersError,
    setBrokersError,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    ownershipError,
    setOwnershipError,
  ] = useState("");

  const [
    isEmitenDropdownOpen,
    setIsEmitenDropdownOpen,
  ] = useState(false);

  const [
    isBrokerDropdownOpen,
    setIsBrokerDropdownOpen,
  ] = useState(false);

 const emitenWrapperRef = useRef<HTMLDivElement>(null);
const emitenDropdownRef = useRef<HTMLDivElement>(null);

const [emitenDropdownPosition, setEmitenDropdownPosition] =
  useState({
    top: 0,
    left: 0,
    width: 0,
    ready: false,
  });

  const brokerWrapperRef =
    useRef<HTMLDivElement>(null);
  const brokerDropdownRef = useRef<HTMLDivElement>(null);

  const [brokerDropdownPosition, setBrokerDropdownPosition] =
    useState({
      top: 0,
      left: 0,
      width: 0,
      ready: false,
    });

  const [popupData, setPopupData] =
    useState<{
      emiten: string;
      freeFloat: string;
      cso: string;
      netBuy: string;
      broker: string;
      accumulation: number;
    } | null>(null);

  const [
    missingFields,
    setMissingFields,
  ] = useState<string[]>([]);

  const [showPopup, setShowPopup] =
    useState(false);

  const [sortBy, setSortBy] =
    useState<
      "accumulation" | "emiten"
    >("accumulation");

  const [
    sortDirection,
    setSortDirection,
  ] = useState<
    "asc" | "desc"
  >("desc");

  /*
   * ============================================================
   * LOAD LOCAL STORAGE DATA
   * ============================================================
   */
  

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (saved) {
        const parsed: unknown =
          JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setData(
            parsed.filter(
              (item) =>
                item &&
                typeof item.id ===
                  "string" &&
                typeof item.broker ===
                  "string" &&
                typeof item.emiten ===
                  "string" &&
                typeof item.accumulation ===
                  "number"
            )
          );
        }
      }
    } catch (error) {
      console.error(
        "Gagal memuat data broker:",
        error
      );
    } finally {
      setIsStorageLoaded(true);
    }
  }, []);

  /*
   * ============================================================
   * SAVE TABLE DATA
   * ============================================================
   */

  useEffect(() => {
    if (!isStorageLoaded) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error(
        "Gagal menyimpan data broker:",
        error
      );
    }
  }, [
    data,
    isStorageLoaded,
  ]);

  /*
   * ============================================================
   * LOAD EMITEN
   * ============================================================
   */


  useEffect(() => {
    let cancelled = false;

    const loadSecurities = async () => {
      try {
        const cached =
          localStorage.getItem(
            SECURITIES_CACHE_KEY
          );

        if (cached) {
          const normalized =
            normalizeSecurities(
              JSON.parse(cached)
            );

          if (
            normalized.length > 0
          ) {
            setSecurities(
              normalized
            );

            return;
          }
        }
      } catch (error) {
        console.error(
          "Cache emiten rusak:",
          error
        );
      }

      setIsSecuritiesLoading(true);
      setSecuritiesError("");

      try {
        const response =
          await fetch(
            "/api/securities"
          );

        if (!response.ok) {
          throw new Error(
            `Gagal mengambil emiten (${response.status})`
          );
        }

        const result: unknown =
          await response.json();

        const normalized =
          normalizeSecurities(
            result
          );

        if (
          normalized.length === 0
        ) {
          throw new Error(
            "Data emiten kosong atau format API tidak sesuai."
          );
        }

        if (cancelled) return;

        setSecurities(
          normalized
        );

        localStorage.setItem(
          SECURITIES_CACHE_KEY,
          JSON.stringify(
            normalized
          )
        );
      } catch (error) {
        if (cancelled) return;

        setSecuritiesError(
          error instanceof Error
            ? error.message
            : "Gagal memuat emiten."
        );
      } finally {
        if (!cancelled) {
          setIsSecuritiesLoading(
            false
          );
        }
      }
    };

    loadSecurities();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * ============================================================
   * LOAD BROKERS: LOCAL STORAGE -> API / FIRESTORE
   * ============================================================
   * Gunakan cache lokal jika valid. Jika belum ada, kosong,
   * atau rusak, ambil data dari /api/brokers lalu simpan cache.
   */

  useEffect(() => {
    let cancelled = false;

    const loadBrokers = async () => {
      setIsBrokersLoading(true);
      setBrokersError("");

      // 1. Cek cache lokal terlebih dahulu.
      try {
        const cached = localStorage.getItem(BROKERS_CACHE_KEY);

        if (cached) {
          const normalized = normalizeBrokers(
            JSON.parse(cached) as unknown
          );

          if (normalized.length > 0) {
            if (!cancelled) {
              setBrokers(normalized);
              setBrokersError("");
              setIsBrokersLoading(false);
            }

            console.info(
              `[BrokerAccumulation] ${normalized.length} broker dimuat dari cache lokal`
            );
            return;
          }
        }
      } catch (error) {
        console.warn(
          "[BrokerAccumulation] Cache broker tidak valid; mengambil data dari API:",
          error
        );
      }

      // 2. Cache tidak ada/tidak valid: ambil dari API Firestore.
      try {
        const response = await fetch("/api/brokers", {
          method: "GET",
          cache: "no-store",
        });

        const result: unknown = await response.json();

        if (!response.ok) {
          const message =
            result &&
            typeof result === "object" &&
            "message" in result &&
            typeof result.message === "string"
              ? result.message
              : `Gagal mengambil data broker (${response.status})`;

          throw new Error(message);
        }

        if (
          !result ||
          typeof result !== "object" ||
          !("success" in result) ||
          result.success !== true
        ) {
          const message =
            result &&
            typeof result === "object" &&
            "message" in result &&
            typeof result.message === "string"
              ? result.message
              : "API tidak berhasil mengambil data broker.";

          throw new Error(message);
        }

        // API berbentuk { success: true, data: [...] }.
        const normalized = normalizeBrokers(result);

        if (normalized.length === 0) {
          throw new Error(
            "Data broker dari database kosong atau format datanya tidak sesuai."
          );
        }

        if (cancelled) return;

        // 3. Tampilkan data yang didapat dari API.
        setBrokers(normalized);
        setBrokersError("");

        // 4. Simpan data yang sudah dinormalisasi ke cache lokal.
        try {
          localStorage.setItem(
            BROKERS_CACHE_KEY,
            JSON.stringify(normalized)
          );
        } catch (storageError) {
          console.warn(
            "[BrokerAccumulation] Gagal menyimpan cache broker:",
            storageError
          );
        }

        console.info(
          `[BrokerAccumulation] ${normalized.length} broker berhasil diambil dari API`
        );
      } catch (error) {
        if (cancelled) return;

        console.error(
          "[BrokerAccumulation] Gagal memuat broker:",
          error
        );

        setBrokers([]);
        setBrokersError(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memuat data broker."
        );
      } finally {
        if (!cancelled) {
          setIsBrokersLoading(false);
        }
      }
    };

    void loadBrokers();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * ============================================================
   * CLOSE DROPDOWNS ON OUTSIDE CLICK
   * ============================================================
   */
  useEffect(() => {
  if (!isEmitenDropdownOpen) {
    setEmitenDropdownPosition((prev) => ({
      ...prev,
      ready: false,
    }));
    return;
  }

  const updatePosition = () => {
    const input = emitenWrapperRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 12;

    const width = Math.min(
      Math.max(rect.width, 260),
      viewportWidth - margin * 2,
      360
    );

    const left = Math.max(
      margin,
      Math.min(
        rect.left,
        viewportWidth - width - margin
      )
    );

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const maxHeight = Math.min(
      320,
      Math.max(160, window.innerHeight - 32)
    );

    const openAbove =
      spaceBelow < Math.min(300, maxHeight) &&
      spaceAbove > spaceBelow;

    const top = openAbove
      ? Math.max(
          8,
          rect.top - Math.min(maxHeight, spaceAbove - 8) - 8
        )
      : rect.bottom + 8;

    setEmitenDropdownPosition({
      top,
      left,
      width,
      ready: true,
    });
  };

  updatePosition();

  window.addEventListener("resize", updatePosition);
  window.addEventListener("scroll", updatePosition, true);

  return () => {
    window.removeEventListener("resize", updatePosition);
    window.removeEventListener("scroll", updatePosition, true);
  };
}, [isEmitenDropdownOpen, form.emiten, securities.length]);
  useEffect(() => {
  if (!isBrokerDropdownOpen) {
    setBrokerDropdownPosition((prev) => ({
      ...prev,
      ready: false,
    }));
    return;
  }

  const updatePosition = () => {
    const input = brokerWrapperRef.current;

    if (!input) return;

    const rect = input.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const margin = 12;
    const width = Math.min(
      Math.max(rect.width, 280),
      viewportWidth - margin * 2,
      360
    );

    const left = Math.max(
      margin,
      Math.min(
        rect.left,
        viewportWidth - width - margin
      )
    );

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const dropdownMaxHeight = Math.min(
      320,
      Math.max(160, window.innerHeight - 32)
    );

    const openAbove =
      spaceBelow < Math.min(300, dropdownMaxHeight) &&
      spaceAbove > spaceBelow;

    const top = openAbove
      ? Math.max(
          8,
          rect.top - Math.min(dropdownMaxHeight, spaceAbove - 8) - 8
        )
      : rect.bottom + 8;

    setBrokerDropdownPosition({
      top,
      left,
      width,
      ready: true,
    });
  };

  updatePosition();

  window.addEventListener("resize", updatePosition);
  window.addEventListener("scroll", updatePosition, true);

  return () => {
    window.removeEventListener("resize", updatePosition);
    window.removeEventListener("scroll", updatePosition, true);
  };
}, [isBrokerDropdownOpen, form.broker, brokers.length]);

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target;

    if (!(target instanceof Node)) return;

    // EMITEN: cek input dan dropdown portal
    const clickedEmitenInput =
      emitenWrapperRef.current?.contains(target) ?? false;

    const clickedEmitenDropdown =
      emitenDropdownRef.current?.contains(target) ?? false;

    if (!clickedEmitenInput && !clickedEmitenDropdown) {
      setIsEmitenDropdownOpen(false);
    }

    // BROKER: cek input dan dropdown portal
    const clickedBrokerInput =
      brokerWrapperRef.current?.contains(target) ?? false;

    const clickedBrokerDropdown =
      brokerDropdownRef.current?.contains(target) ?? false;

    if (!clickedBrokerInput && !clickedBrokerDropdown) {
      setIsBrokerDropdownOpen(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);


  /*
   * ============================================================
   * FILTER EMITEN
   * ============================================================
   */

  const filteredSecurities =
    useMemo(() => {
      const query =
        form.emiten
          .trim()
          .toUpperCase();

      return securities
        .filter(
          (item) =>
            !query ||
            item.code.startsWith(
              query
            )
        )
        .slice(0, 50);
    }, [
      securities,
      form.emiten,
    ]);

  /*
   * ============================================================
   * FILTER BROKER
   * ============================================================
   */

  const filteredBrokers =
    useMemo(() => {
      const query =
        form.broker
          .trim()
          .toUpperCase();

      return brokers
        .filter((broker) => {
          if (!query) return true;

          return (
            broker.broker_code
              .toUpperCase()
              .includes(query) ||
            broker.broker_name
              .toUpperCase()
              .includes(query)
          );
        })
        .slice(0, 50);
    }, [
      brokers,
      form.broker,
    ]);

  /*
   * ============================================================
   * HANDLE INPUT
   * ============================================================
   */

  const handleChange = (
    field: keyof typeof initialForm,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: formatInput(
        field,
        value
      ),
    }));
  };

  /*
   * ============================================================
   * PILIH EMITEN
   * ============================================================
   */

  const handleSelectEmiten = (
    security: Security
  ) => {
    setForm((prev) => ({
      ...prev,
      emiten: security.code,
    }));

    setOwnershipError("");
    setIsEmitenDropdownOpen(
      false
    );
  };

  /*
   * ============================================================
   * PILIH BROKER
   * ============================================================
   */

  const handleSelectBroker = (
    broker: BrokerOption
  ) => {
    setForm((prev) => ({
      ...prev,
      broker:
        broker.broker_code,
    }));

    setIsBrokerDropdownOpen(
      false
    );
  };

  /*
   * ============================================================
   * DELETE
   * ============================================================
   */

  const handleDelete = (
    id: string
  ) => {
    setData((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  };

  const handleClearAll = () =>
    setData([]);

  /*
   * ============================================================
   * SORT
   * ============================================================
   */

  const sortedData = [...data].sort(
    (a, b) => {
      const comparison =
        sortBy === "accumulation"
          ? a.accumulation -
            b.accumulation
          : a.emiten.localeCompare(
              b.emiten
            );

      return sortDirection ===
        "asc"
        ? comparison
        : -comparison;
    }
  );

  /*
   * ============================================================
   * SUBMIT
   * ============================================================
   *
   * CSO & FREE FLOAT hanya diambil ketika
   * tombol Tampilkan diklik.
   */

  const handleSubmit =
    async () => {
      if (isSubmitting) return;

      const missing: string[] =
        [];

      if (!form.broker.trim()) {
        missing.push(
          "Kode Broker"
        );
      } else if (
        !/^[A-Z]{2}$/.test(
          form.broker
        )
      ) {
        missing.push(
          "Pilih broker dari dropdown"
        );
      }

      if (!form.emiten.trim()) {
        missing.push(
          "Kode Emiten"
        );
      } else if (
        !/^[A-Z]{4}$/.test(
          form.emiten
        )
      ) {
        missing.push(
          "Kode Emiten harus 4 huruf"
        );
      }

      if (!form.netBuy.trim()) {
        missing.push(
          "Net Buy"
        );
      }

      if (
        missing.length > 0
      ) {
        setMissingFields(
          missing
        );

        setShowPopup(true);

        return;
      }

      setIsSubmitting(true);
      setOwnershipError("");

      try {
        const ticker =
          form.emiten
            .trim()
            .toUpperCase();

        /*
         * Fetch database hanya saat
         * tombol Tampilkan diklik.
         */

        const response =
          await fetch(
            `/api/securities/${encodeURIComponent(
              ticker
            )}/ownership`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const result: OwnershipResponse =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              `Gagal mengambil data ${ticker}`
          );
        }

        if (
          result.shares ===
            null ||
          result.shares ===
            undefined ||
          result.freeFloatPercent ===
            null ||
          result.freeFloatPercent ===
            undefined
        ) {
          throw new Error(
            `Data CSO atau Free Float ${ticker} belum tersedia`
          );
        }

        /*
         * CSO asli untuk perhitungan.
         */

        const cso =
          Number(
            result.shares
          );

        /*
         * CSO ringkas untuk tampilan.
         */

        const csoValue =
          formatShares(
            result.shares
          );

        const freeFloatValue =
          formatPercentForInput(
            result.freeFloatPercent
          );

        const freeFloatPercent =
          parseFloat(
            String(
              result.freeFloatPercent
            )
              .replace("%", "")
              .replace(",", ".")
          );

        const netBuyLot =
          parseValue(
            form.netBuy
          );

        if (
          !Number.isFinite(
            cso
          ) ||
          cso <= 0 ||
          !Number.isFinite(
            freeFloatPercent
          ) ||
          freeFloatPercent <=
            0 ||
          freeFloatPercent >
            100
        ) {
          throw new Error(
            `Data CSO atau Free Float ${ticker} tidak valid`
          );
        }

        if (
          !Number.isFinite(
            netBuyLot
          )
        ) {
          throw new Error(
            "Nilai Net Buy tidak valid"
          );
        }

        /*
         * CSO = jumlah saham.
         *
         * Free float shares =
         * CSO × free float percentage.
         *
         * Net Buy diinput dalam lot.
         *
         * 1 lot = 100 saham.
         */

        const freeFloatShares =
          cso *
          (freeFloatPercent /
            100);

        const netBuyShares =
          netBuyLot * 100;

        const accumulation =
          freeFloatShares > 0
            ? (netBuyShares /
                freeFloatShares) *
              100
            : 0;

        /*
         * Simpan hasil ke tabel
         * dan localStorage.
         */

        setData((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            broker:
              form.broker.toUpperCase(),
            emiten: ticker,
            freeFloat:
              freeFloatValue,
            cso: csoValue,
            netBuy:
              form.netBuy.toUpperCase(),
            accumulation,
          },
        ]);

        setForm(
          initialForm
        );

        setIsEmitenDropdownOpen(
          false
        );

        setIsBrokerDropdownOpen(
          false
        );
      } catch (error) {
        setOwnershipError(
          error instanceof Error
            ? error.message
            : "Gagal mengambil data CSO dan Free Float"
        );
      } finally {
        setIsSubmitting(
          false
        );
      }
    };

  return (
    <div className="relative min-h-full w-full overflow-x-clip bg-[#f7f7f5] px-3 py-4 text-zinc-900 dark:bg-[#050505] dark:text-zinc-100 sm:px-5 sm:py-6">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-yellow-400/[0.035] blur-[140px] dark:bg-yellow-400/[0.05]" />
        <div className="absolute -left-24 top-[35%] h-72 w-72 rounded-full bg-amber-300/[0.025] blur-[120px] dark:bg-yellow-500/[0.018]" />
        <div className="absolute -right-24 bottom-[12%] h-80 w-80 rounded-full bg-yellow-400/[0.02] blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.018] dark:opacity-[0.028] [background-image:linear-gradient(rgba(100,100,100,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(100,100,100,0.45)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-5">

      {/* TITLE */}

      <header className="relative overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-white/75 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.045)] backdrop-blur-2xl dark:border-white/[0.065] dark:bg-white/[0.025] dark:shadow-[0_25px_80px_rgba(0,0,0,0.28)] sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute inset-x-[15%] top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
        <div className="relative flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/15 bg-yellow-400/[0.07] text-yellow-600 shadow-[0_0_30px_rgba(234,179,8,0.07)] dark:text-yellow-400">
            <BarChart3 size={21} strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-[-0.025em] text-zinc-950 dark:text-white sm:text-2xl">
                Broker Accumulation
              </h1>
              <span className="rounded-full border border-yellow-500/15 bg-yellow-400/[0.06] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
                Intelligence
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500 sm:text-xs">
              Analisis akumulasi broker berdasarkan Net Buy, CSO, dan Free Float.
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-yellow-400/25 to-transparent" />
          <Sparkles size={12} className="text-yellow-500/70" />
          <div className="h-px flex-1 bg-gradient-to-l from-yellow-400/25 to-transparent" />
        </div>
      </header>

      {/* FORM INPUT */}

      <section className="relative overflow-visible rounded-[1.5rem] border border-zinc-200/80 bg-white/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/[0.065] dark:bg-[#0a0a0a]/80 dark:shadow-[0_25px_80px_rgba(0,0,0,0.3)] sm:p-4">
        <div className="pointer-events-none absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/45 to-transparent" />
        <div className="mb-3 flex items-center justify-between gap-3 px-1 sm:px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-zinc-400">
              <SlidersHorizontal size={14} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-300">Analysis Input</p>
              <p className="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-600">Tentukan broker, emiten, dan Net Buy</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 text-[8px] uppercase tracking-[0.16em] text-zinc-400 sm:flex">
            <ShieldCheck size={11} className="text-yellow-500" />
            Local cache
          </div>
        </div>
        <div className="grid gap-2.5 md:grid-cols-3">

        {/* EMITEN */}

        <div
          ref={emitenWrapperRef}
          className="relative min-w-0"
        >
          <input
            type="text"
            placeholder={
              isSecuritiesLoading
                ? "Memuat emiten..."
                : "Emiten"
            }
            value={form.emiten}
            maxLength={4}
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 text-sm font-medium uppercase text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-yellow-500/50 focus:bg-white focus:ring-4 focus:ring-yellow-400/[0.06] dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-yellow-400/40 dark:focus:bg-white/[0.035]"
            onFocus={() =>
              setIsEmitenDropdownOpen(
                true
              )
            }
            onChange={(e) => {
              handleChange(
                "emiten",
                e.target.value
              );

              setIsEmitenDropdownOpen(
                true
              );
            }}
          />

          {isEmitenDropdownOpen &&
  typeof document !== "undefined" &&
  createPortal(
    <div
      ref={emitenDropdownRef}
      style={{
        position: "fixed",
        top: emitenDropdownPosition.top,
        left: emitenDropdownPosition.left,
        width: emitenDropdownPosition.width || 300,
        maxHeight: "min(320px, calc(100dvh - 24px))",
        visibility: emitenDropdownPosition.ready
          ? "visible"
          : "hidden",
      }}
      className="
        z-[99999] flex flex-col overflow-hidden
        rounded-2xl border border-zinc-200/90
        bg-white/95 shadow-[0_24px_70px_rgba(0,0,0,0.16)]
        ring-1 ring-black/[0.03] backdrop-blur-2xl
        dark:border-white/[0.10]
        dark:bg-[#0b0d12]/[0.98]
        dark:shadow-[0_24px_80px_rgba(0,0,0,0.65)]
      "
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/70 px-3.5 py-3 dark:border-white/[0.07]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-400/[0.10] text-yellow-600 dark:text-yellow-400">
            <Search size={16} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              Emiten Directory
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              Pilih kode saham
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-lg border border-yellow-500/20 bg-yellow-400/[0.08] px-2 py-1 text-[10px] font-bold text-yellow-700 dark:text-yellow-400">
          {securities.length} EMITEN
        </span>
      </div>

      {/* Content */}
      {isSecuritiesLoading ? (
        <div className="flex items-center justify-center gap-2.5 px-4 py-8">
          <Loader2
            size={17}
            className="animate-spin text-yellow-500"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Memuat data emiten...
          </span>
        </div>
      ) : securitiesError ? (
        <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
          <AlertCircle size={20} className="text-red-500" />
          <p className="text-xs font-medium text-red-500">
            Gagal memuat emiten
          </p>
          <p className="break-words text-[11px] text-zinc-500 dark:text-zinc-400">
            {securitiesError}
          </p>
        </div>
      ) : filteredSecurities.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 [scrollbar-color:#71717a_transparent] [scrollbar-width:thin]">
          {filteredSecurities.map((security) => (
            <button
              key={security.code}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelectEmiten(security)}
              className="
                group flex w-full items-center justify-between gap-3
                rounded-xl border border-transparent px-3 py-2.5
                text-left transition-all duration-200
                hover:border-yellow-500/15
                hover:bg-yellow-400/[0.07]
                active:scale-[0.99]
                focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-yellow-500/40
              "
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-yellow-600 transition-colors group-hover:text-yellow-700 dark:text-yellow-400 dark:group-hover:text-yellow-300">
                  {security.code}
                </p>

                {security.name && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {security.name}
                  </p>
                )}
              </div>

              <ChevronDown
                size={15}
                className="-rotate-90 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-yellow-500 dark:text-zinc-600"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
          <Search
            size={20}
            className="mb-3 text-zinc-400 dark:text-zinc-500"
          />
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            Emiten tidak ditemukan
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Coba kode saham yang berbeda.
          </p>
        </div>
      )}

      {/* Footer */}
      {!isSecuritiesLoading &&
        !securitiesError &&
        filteredSecurities.length > 0 && (
          <div className="shrink-0 border-t border-zinc-200/70 px-3.5 py-2 dark:border-white/[0.07]">
            <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
              Menampilkan {filteredSecurities.length} dari{" "}
              {securities.length} emiten
            </p>
          </div>
        )}
    </div>,
    document.body
  )}
        </div>

        {/* BROKER */}

        <div
          ref={brokerWrapperRef}
          className="relative min-w-0"
        >
          <input
            type="text"
            placeholder={
              isBrokersLoading
                ? "Memuat broker..."
                : "Broker"
            }
            value={form.broker}
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 text-sm font-medium uppercase text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-yellow-500/50 focus:bg-white focus:ring-4 focus:ring-yellow-400/[0.06] dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-yellow-400/40 dark:focus:bg-white/[0.035]"
            onFocus={() =>
              setIsBrokerDropdownOpen(
                true
              )
            }
            onChange={(e) => {
              handleChange(
                "broker",
                e.target.value
              );

              setIsBrokerDropdownOpen(
                true
              );
            }}
          />

         {isBrokerDropdownOpen &&
  typeof document !== "undefined" &&
  createPortal(
    <div
      ref={brokerDropdownRef}
      style={{
        position: "fixed",
        top: brokerDropdownPosition.top,
        left: brokerDropdownPosition.left,
        width: brokerDropdownPosition.width || 300,
        maxHeight: "min(320px, calc(100dvh - 24px))",
        visibility: brokerDropdownPosition.ready
          ? "visible"
          : "hidden",
      }}
      className="
        z-[99999] flex flex-col
        overflow-hidden rounded-2xl
        border border-zinc-200/90
        bg-white/95
        shadow-[0_24px_70px_rgba(0,0,0,0.16)]
        ring-1 ring-black/[0.03]
        backdrop-blur-2xl
        dark:border-white/[0.10]
        dark:bg-[#0b0d12]/[0.98]
        dark:shadow-[0_24px_80px_rgba(0,0,0,0.65)]
        dark:ring-white/[0.025]
      "
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/70 px-3.5 py-3 dark:border-white/[0.07]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-400/[0.10] text-yellow-600 dark:text-yellow-400">
            <Search size={16} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-zinc-800 dark:text-zinc-100">
              Broker Directory
            </p>

            <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              Pilih broker yang ingin digunakan
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-lg border border-yellow-500/20 bg-yellow-400/[0.08] px-2 py-1 text-[10px] font-bold tracking-wide text-yellow-700 dark:text-yellow-400">
          {brokers.length} BROKER
        </span>
      </div>

      {/* Loading */}
      {isBrokersLoading ? (
        <div className="flex items-center justify-center gap-2.5 px-4 py-8">
          <Loader2
            size={17}
            className="animate-spin text-yellow-500"
          />

          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Memuat data broker...
          </span>
        </div>
      ) : brokersError ? (
        /* Error */
        <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.07] text-red-500">
            <AlertCircle size={18} />
          </div>

          <p className="text-xs font-medium text-red-500">
            Gagal memuat broker
          </p>

          <p className="break-words text-[11px] text-zinc-500 dark:text-zinc-400">
            {brokersError}
          </p>
        </div>
      ) : filteredBrokers.length > 0 ? (
        /* Broker list */
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 [scrollbar-color:#71717a_transparent] [scrollbar-width:thin]">
          {filteredBrokers.map((broker) => (
            <button
              key={broker.broker_code}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelectBroker(broker)}
              className="
                group flex w-full items-center
                justify-between gap-3
                rounded-xl border border-transparent
                px-3 py-2.5 text-left
                transition-all duration-200
                hover:border-yellow-500/15
                hover:bg-yellow-400/[0.07]
                active:scale-[0.99]
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-yellow-500/40
              "
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`
                    flex h-10 w-11 shrink-0
                    items-center justify-center
                    rounded-xl border
                    border-zinc-200 bg-zinc-50
                    text-xs font-bold tracking-wide
                    transition-colors
                    group-hover:border-yellow-500/30
                    group-hover:bg-yellow-400/[0.08]
                    dark:border-white/[0.08]
                    dark:bg-white/[0.035]
                    ${getBrokerColor(broker)}
                  `}
                >
                  {broker.broker_code}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-800 transition-colors group-hover:text-yellow-700 dark:text-zinc-200 dark:group-hover:text-yellow-400">
                    {broker.broker_name}
                  </p>

                  <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                    {broker.is_foreign === true
                      ? "Foreign Broker"
                      : "Broker Anggota Bursa"}
                  </p>
                </div>
              </div>

              <ChevronDown
                size={15}
                className="
                  -rotate-90 shrink-0
                  text-zinc-300
                  transition-all duration-200
                  group-hover:translate-x-0.5
                  group-hover:text-yellow-500
                  dark:text-zinc-600
                "
              />
            </button>
          ))}
        </div>
      ) : (
        /* Empty search result */
        <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-500">
            <Search size={18} />
          </div>

          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            Broker tidak ditemukan
          </p>

          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Coba periksa kembali kode atau nama broker.
          </p>
        </div>
      )}

      {/* Footer */}
      {!isBrokersLoading &&
        !brokersError &&
        filteredBrokers.length > 0 && (
          <div className="shrink-0 border-t border-zinc-200/70 px-3.5 py-2 dark:border-white/[0.07]">
            <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
              Menampilkan {filteredBrokers.length} dari {brokers.length} broker
            </p>
          </div>
        )}
    </div>,
    document.body
  )}
        </div>

        {/* NET BUY */}

        <Input
          placeholder="Net Buy"
          type="text"
          value={form.netBuy}
          onChange={(e) =>
            handleChange(
              "netBuy",
              e.target.value
            )
          }
        />
      </div>

      {/* ERROR OWNERSHIP */}

      {ownershipError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.05] px-3.5 py-2.5 text-xs text-red-500">
          {ownershipError}
        </div>
      )}

      {/* TAMPILKAN */}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="group relative flex h-11 items-center justify-center w-full  gap-2 overflow-hidden rounded-xl border border-yellow-500/25 bg-yellow-400/[0.09] px-5 text-xs font-semibold text-yellow-700 transition-all duration-300 hover:border-yellow-400/50 hover:bg-yellow-400/[0.14] hover:shadow-[0_0_30px_rgba(234,179,8,0.1)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 dark:text-yellow-400"
      >
        {isSubmitting ? (
          <>
            <Loader2
              size={15}
              className="animate-spin"
            />

            Mengambil data...
          </>
        ) : (
          "Tampilkan"
        )}
      </button>
      </section>

      {/* TABLE */}

      {data.length > 0 && (
        <>
          <div className="flex flex-col gap-3 border-b border-zinc-200/80 bg-transparent p-3 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between sm:px-4">

            <div className="flex min-w-0 items-center gap-2">

              <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Sort by
              </span>

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "accumulation"
                      | "emiten"
                  )
                }
                className="min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none transition focus:border-yellow-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                aria-label="Urutkan berdasarkan"
              >
                <option value="accumulation">
                  Accumulation
                </option>

                <option value="emiten">
                  Name
                </option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setSortDirection(
                    (prev) =>
                      prev === "asc"
                        ? "desc"
                        : "asc"
                  )
                }
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-yellow-500 hover:text-yellow-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:text-yellow-400"
              >
                <span className="text-base leading-none">
                  {sortDirection ===
                  "asc"
                    ? "↑"
                    : "↓"}
                </span>

                <span>
                  {sortDirection ===
                  "asc"
                    ? "Asc"
                    : "Des"}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleClearAll}
              title="Hapus semua data"
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
            >
              <Eraser
                size={14}
              />
            </button>
          </div>

          <div className="overflow-hidden rounded-[1.25rem] border border-zinc-200/80 dark:border-white/[0.06]">

            <div className="overflow-x-auto">

              <table className="w-full min-w-[750px] text-sm">

                <thead>
                  <tr className="border-b border-zinc-200/80 bg-zinc-50/80 dark:border-white/[0.05] dark:bg-white/[0.018]">

                    {[
                      "Akumulasi",
                      "Kode Broker",
                      "Kode Emiten",
                      "Free Float",
                      "CSO",
                      "Net Buy",
                      "",
                    ].map(
                      (
                        heading,
                        index
                      ) => (
                        <th
                          key={`${heading}-${index}`}
                          className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400"
                        >
                          {
                            heading
                          }
                        </th>
                      )
                    )}

                  </tr>
                </thead>

                <tbody>

                  {sortedData.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="group border-b border-zinc-100/90 transition-colors hover:bg-yellow-400/[0.025] dark:border-white/[0.045] dark:hover:bg-yellow-400/[0.02]"
                      >

                        {/* AKUMULASI */}

                        <td
                          className={`px-4 py-3 text-center font-semibold ${
                            item.accumulation <
                            0
                              ? "text-red-500 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {item.accumulation.toFixed(
                            2
                          )}
                          %
                        </td>

                        {/* BROKER */}

                        <td className="px-4 py-3 text-center">

                          {(() => {
                            const brokerInfo =
                              brokers.find(
                                (
                                  broker
                                ) =>
                                  broker.broker_code.toUpperCase() ===
                                  item.broker.toUpperCase()
                              );

                            return (
                              <span
                                className={`font-semibold ${
                                  brokerInfo
                                    ? getBrokerColor(
                                        brokerInfo
                                      )
                                    : "text-zinc-900 dark:text-zinc-100"
                                }`}
                              >
                                {
                                  item.broker
                                }
                              </span>
                            );
                          })()}

                        </td>

                        {/* EMITEN POPUP */}

                        <td className="px-4 py-3 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              setPopupData(
                                {
                                  emiten:
                                    item.emiten,
                                  freeFloat:
                                    item.freeFloat,
                                  cso:
                                    item.cso,
                                  netBuy:
                                    item.netBuy,
                                  broker:
                                    item.broker,
                                  accumulation:
                                    item.accumulation,
                                }
                              )
                            }
                            className="cursor-pointer font-semibold transition hover:text-blue-500 hover:underline dark:hover:text-blue-300"
                          >
                            {
                              item.emiten
                            }
                          </button>

                        </td>

                        {/* FREE FLOAT */}

                        <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                          {
                            item.freeFloat
                          }
                        </td>

                        {/* CSO */}

                        <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                          {
                            item.cso
                          }
                        </td>

                        {/* NET BUY */}

                        <td
                          className={`px-4 py-3 text-center font-semibold ${
                            item.netBuy.startsWith(
                              "-"
                            )
                              ? "text-red-500 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {
                            item.netBuy
                          }
                        </td>

                        {/* DELETE */}

                        <td className="px-4 py-3 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                item.id
                              )
                            }
                            className="cursor-pointer px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
                            aria-label={`Hapus ${item.broker} - ${item.emiten}`}
                          >
                            <X
                              size={14}
                            />
                          </button>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>
              </table>

            </div>
          </div>
        </>
      )}

      {/* EMPTY */}

      {data.length === 0 && (
        <div className="relative flex min-h-44 flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border border-dashed border-zinc-200 bg-white/45 px-5 text-center backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.012]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-400 dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-zinc-600">
            <BarChart3 size={20} strokeWidth={1.5} />
          </div>
          <p className="mt-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Belum ada data broker
          </p>
        </div>
      )}

      {/* VALIDATION POPUP */}

      {showPopup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4 backdrop-blur-md"
          onClick={() =>
            setShowPopup(false)
          }
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            className="relative w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-[0_30px_100px_rgba(0,0,0,0.2)] dark:border-white/[0.08] dark:bg-[#0b0b0b] dark:shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
          >

            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-500/15 bg-yellow-400/[0.06] text-yellow-600 dark:text-yellow-400">
                <SlidersHorizontal size={16} />
              </div>
              <div>

              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Data belum lengkap
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Silakan isi bagian berikut:
              </p>

              </div>
            </div>

            <div className="space-y-2">

              {missingFields.map(
                (field) => (
                  <div
                    key={field}
                    className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />

                    {field}
                  </div>
                )
              )}

            </div>

            <button
              type="button"
              onClick={() =>
                setShowPopup(false)
              }
              className="mt-5 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Mengerti
            </button>

          </div>
        </div>
      )}

      {/* BROKER POPUP */}

      {popupData && (
        <BrokerPopup
          {...popupData}
          onClose={() =>
            setPopupData(null)
          }
        />
      )}

      <footer className="flex items-center justify-center gap-3 pb-2 pt-1">
        <div className="h-px w-10 bg-gradient-to-r from-transparent to-zinc-300 dark:to-white/[0.08]" />
        <span className="text-[8px] font-medium uppercase tracking-[0.3em] text-zinc-400/70 dark:text-zinc-600">MI • Broker Intelligence</span>
        <div className="h-px w-10 bg-gradient-to-l from-transparent to-zinc-300 dark:to-white/[0.08]" />
      </footer>
    </div>
  </div>
  );
}

function formatShares(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  const abs = Math.abs(number);

  if (
    abs >= 1_000_000_000
  ) {
    return `${(
      number / 1_000_000_000
    ).toFixed(2)}B`;
  }

  if (
    abs >= 1_000_000
  ) {
    return `${(
      number / 1_000_000
    ).toFixed(2)}M`;
  }

  if (
    abs >= 1_000
  ) {
    return `${(
      number / 1_000
    ).toFixed(2)}K`;
  }

  return number.toLocaleString(
    "en-US"
  );
}