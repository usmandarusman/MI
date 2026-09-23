/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LucideEraser, LucideX, Search, Loader2 } from "lucide-react";

import Input from "../components/fragments/ui/input";
import { BrokerPopup } from "../components/fragments/popup/brokerPopup";

// ======================================================
// TYPES
// ======================================================

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

const STORAGE_KEY = "broker-accumulation-data";
const SECURITIES_CACHE_KEY = "idx-securities-cache-v1";

const initialForm = {
  broker: "",
  emiten: "",
  freeFloat: "",
  cso: "",
  netBuy: "",
};

// ======================================================
// NORMALIZE DATA EMITEN DARI API
// Mendukung Code/code dan Name/name
// ======================================================

function normalizeSecurities(payload: unknown): Security[] {
  let rows: unknown[] = [];

  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;

    if (Array.isArray(obj.data)) {
      rows = obj.data;
    } else if (
      obj.data &&
      typeof obj.data === "object" &&
      Array.isArray((obj.data as Record<string, unknown>).data)
    ) {
      rows = (obj.data as Record<string, unknown>).data as unknown[];
    } else if (Array.isArray(obj.securities)) {
      rows = obj.securities;
    }
  }

  const mapped = rows
    .map((item): Security | null => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;

      const code = String(
        row.Code ?? row.code ?? row.ticker ?? row.symbol ?? ""
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

      return { code, name };
    })
    .filter((item): item is Security => item !== null);

  // Hilangkan duplikat berdasarkan kode saham
  const unique = new Map<string, Security>();

  for (const item of mapped) {
    unique.set(item.code, item);
  }

  return Array.from(unique.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );
}

// ======================================================
// PARSE VALUE
// 99,3K  -> 99.300
// 2,15M  -> 2.150.000
// 22,70B -> 22.700.000.000
// ======================================================

const parseValue = (value: string): number => {
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

  const numberPart = clean.replace(/[KMB]$/, "");
  const number = parseFloat(numberPart);

  return Number.isNaN(number) ? 0 : number * multiplier;
};

// ======================================================
// FORMAT INPUT
// ======================================================

const formatInput = (
  field: keyof typeof initialForm,
  value: string
): string => {
  if (field === "broker") {
    return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  }

  if (field === "emiten") {
    return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  }

  if (field === "freeFloat") {
    let formatted = value.replace(/[^0-9.,%]/g, "").replace(/,/g, ".");

    const hasPercent = formatted.includes("%");
    formatted = formatted.replace(/%/g, "");

    const firstDot = formatted.indexOf(".");

    if (firstDot !== -1) {
      formatted =
        formatted.slice(0, firstDot + 1) +
        formatted.slice(firstDot + 1).replace(/\./g, "");
    }

    if (hasPercent) formatted += "%";

    return formatted;
  }

  if (field === "cso") {
    return value
      .toUpperCase()
      .replace(/[^0-9.,BKM]/g, "")
      .replace(/,/g, ".");
  }

  if (field === "netBuy") {
    return value
      .toUpperCase()
      .replace(/[^0-9.,BKM-]/g, "")
      .replace(/,/g, ".");
  }

  return value;
};

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function BrokerAccumulation() {
  const [form, setForm] = useState(initialForm);
  const [data, setData] = useState<BrokerData[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Data emiten
  const [securities, setSecurities] = useState<Security[]>([]);
  const [isSecuritiesLoading, setIsSecuritiesLoading] = useState(false);
  const [securitiesError, setSecuritiesError] = useState("");

  // Dropdown emiten
  const [isEmitenDropdownOpen, setIsEmitenDropdownOpen] = useState(false);

  const emitenWrapperRef = useRef<HTMLDivElement>(null);

  const [popupData, setPopupData] = useState<{
    emiten: string;
    freeFloat: string;
    cso: string;
    netBuy: string;
    broker: string;
    accumulation: number;
  } | null>(null);

  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showPopup, setShowPopup] = useState(false);

  const [sortBy, setSortBy] = useState<"accumulation" | "emiten">(
    "accumulation"
  );

  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // ======================================================
  // LOAD TABEL BROKER DARI LOCAL STORAGE
  // ======================================================

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setData(
            parsed.filter(
              (item) =>
                item &&
                typeof item.id === "string" &&
                typeof item.broker === "string" &&
                typeof item.emiten === "string" &&
                typeof item.accumulation === "number"
            )
          );
        }
      }
    } catch (error) {
      console.error("Gagal memuat data broker:", error);
    } finally {
      setIsStorageLoaded(true);
    }
  }, []);

  // ======================================================
  // SAVE TABEL BROKER KE LOCAL STORAGE
  // ======================================================

  useEffect(() => {
    if (!isStorageLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Gagal menyimpan data broker:", error);
    }
  }, [data, isStorageLoaded]);

  // ======================================================
  // LOAD DATA EMITEN
  //
  // 1. Cek localStorage dulu.
  // 2. Kalau cache ada, langsung gunakan.
  // 3. Kalau belum ada, fetch dari Firestore API.
  // 4. Simpan hasil fetch ke localStorage.
  // ======================================================

  useEffect(() => {
    let isCancelled = false;

    const loadSecurities = async () => {
      // Gunakan cache lokal jika tersedia
      try {
        const cached = localStorage.getItem(SECURITIES_CACHE_KEY);

        if (cached) {
          const parsed: unknown = JSON.parse(cached);
          const normalized = normalizeSecurities(parsed);

          if (normalized.length > 0) {
            setSecurities(normalized);

            // Cache tersedia, jadi tidak fetch ulang
            return;
          }
        }
      } catch (error) {
        console.error("Cache emiten rusak:", error);
      }

      // Fetch hanya jika cache belum tersedia
      setIsSecuritiesLoading(true);
      setSecuritiesError("");

      try {
        const response = await fetch("/api/securities");

        if (!response.ok) {
          throw new Error(`Gagal mengambil data emiten (${response.status})`);
        }

        const result: unknown = await response.json();
        const normalized = normalizeSecurities(result);

        if (normalized.length === 0) {
          throw new Error("Data emiten kosong atau format API tidak sesuai.");
        }

        if (isCancelled) return;

        setSecurities(normalized);

        // Simpan cache emiten di browser
        try {
          localStorage.setItem(
            SECURITIES_CACHE_KEY,
            JSON.stringify(normalized)
          );
        } catch (error) {
          console.error("Gagal menyimpan cache emiten:", error);
        }
      } catch (error) {
        if (isCancelled) return;

        console.error("Gagal load emiten:", error);

        setSecuritiesError(
          error instanceof Error
            ? error.message
            : "Gagal memuat data emiten."
        );
      } finally {
        if (!isCancelled) {
          setIsSecuritiesLoading(false);
        }
      }
    };

    loadSecurities();

    return () => {
      isCancelled = true;
    };
  }, []);

  // ======================================================
  // CLOSE DROPDOWN SAAT KLIK DI LUAR
  // ======================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emitenWrapperRef.current &&
        !emitenWrapperRef.current.contains(event.target as Node)
      ) {
        setIsEmitenDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ======================================================
  // FILTER EMITEN BERDASARKAN KODE YANG DIKETIK
  // ======================================================

  const filteredSecurities = useMemo(() => {
    const query = form.emiten.trim().toUpperCase();

    if (!query) {
      return securities.slice(0, 50);
    }

    return securities
      .filter((item) => item.code.startsWith(query))
      .slice(0, 50);
  }, [securities, form.emiten]);

  // ======================================================
  // HANDLE CHANGE
  // ======================================================

  const handleChange = (field: keyof typeof form, value: string) => {
    const formattedValue = formatInput(field, value);

    setForm((prev) => ({
      ...prev,
      [field]: formattedValue,
    }));
  };

  // ======================================================
  // PILIH EMITEN DARI DROPDOWN
  // ======================================================

  const handleSelectEmiten = (security: Security) => {
    setForm((prev) => ({
      ...prev,
      emiten: security.code,
    }));

    setIsEmitenDropdownOpen(false);
  };

  // ======================================================
  // DELETE DATA
  // ======================================================

  const handleDelete = (id: string) => {
    setData((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setData([]);
  };

  // ======================================================
  // SORTING
  // ======================================================

  const sortedData = [...data].sort((a, b) => {
    const comparison =
      sortBy === "accumulation"
        ? a.accumulation - b.accumulation
        : a.emiten.localeCompare(b.emiten);

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // ======================================================
  // SUBMIT
  // ======================================================

  const handleSubmit = () => {
    const missing: string[] = [];

    if (!form.broker.trim()) {
      missing.push("Kode Broker");
    } else if (!/^[A-Z]{2}$/.test(form.broker)) {
      missing.push("Kode Broker harus 2 huruf");
    }

    if (!form.emiten.trim()) {
      missing.push("Kode Emiten");
    } else if (!/^[A-Z]{4}$/.test(form.emiten)) {
      missing.push("Kode Emiten harus 4 huruf");
    }

    if (!form.freeFloat.trim()) missing.push("Free Float");
    if (!form.cso.trim()) missing.push("CSO");
    if (!form.netBuy.trim()) missing.push("Net Buy");

    if (missing.length > 0) {
      setMissingFields(missing);
      setShowPopup(true);
      return;
    }

    // CSO dalam saham
    const cso = parseValue(form.cso);

    // Free float dalam persen
    const freeFloatPercent = parseFloat(
      form.freeFloat.replace(",", ".").replace("%", "")
    );

    // Net buy dalam lot
    const netBuyLot = parseValue(form.netBuy);

    // Jumlah saham free float
    const freeFloatShares = cso * (freeFloatPercent / 100);

    // Lot ke saham
    const netBuyShares = netBuyLot * 100;

    // Persentase akumulasi terhadap free float
    const accumulation =
      freeFloatShares > 0
        ? (netBuyShares / freeFloatShares) * 100
        : 0;

    setData((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        broker: form.broker.toUpperCase(),
        emiten: form.emiten.toUpperCase(),
        freeFloat: form.freeFloat.endsWith("%")
          ? form.freeFloat
          : `${form.freeFloat}%`,
        cso: form.cso.toUpperCase(),
        netBuy: form.netBuy.toUpperCase(),
        accumulation,
      },
    ]);

    setForm(initialForm);
    setIsEmitenDropdownOpen(false);
  };

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="relative flex h-full w-full flex-col gap-4 overflow-x-auto px-4 py-4 dark:bg-zinc-950 md:mx-auto md:w-1/2">
      {/* HEADER */}

      <div>
        <h1 className="text-center text-xl font-semibold text-zinc-900 dark:text-white">
          Broker Accumulation
        </h1>

        <p className="mt-1 text-center text-xs text-zinc-500">
          Masukkan data broker untuk melihat akumulasi
        </p>
      </div>

      {/* INPUT */}

      <div className="grid grid-cols-2 gap-2 rounded-xl border-2 border-zinc-200 p-2 dark:border-zinc-800 md:grid-cols-5">
        {/* BROKER */}

        <Input
          placeholder="Broker"
          type="text"
          value={form.broker}
          maxLength={2}
          className="text-center uppercase"
          onChange={(e) => handleChange("broker", e.target.value)}
        />

        {/* EMITEN SEARCHABLE DROPDOWN */}

        <div ref={emitenWrapperRef} className="relative min-w-0">
          <div className="relative">
            <input
              type="text"
              placeholder={
                isSecuritiesLoading ? "Memuat emiten..." : "Emiten"
              }
              value={form.emiten}
              maxLength={4}
              autoComplete="off"
              className="h-full min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-sm uppercase text-zinc-900 outline-none transition focus:border-yellow-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              onFocus={() => setIsEmitenDropdownOpen(true)}
              onChange={(e) => {
                handleChange("emiten", e.target.value);
                setIsEmitenDropdownOpen(true);
              }}
            />
          </div>

          {/* DROPDOWN */}

          {isEmitenDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 max-w-[85vw] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
              {isSecuritiesLoading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-zinc-500">
                  <Loader2 size={14} className="animate-spin" />
                  Memuat data emiten...
                </div>
              ) : securitiesError ? (
                <div className="px-3 py-3 text-xs text-red-500">
                  {securitiesError}
                </div>
              ) : filteredSecurities.length > 0 ? (
                filteredSecurities.map((security) => (
                  <button
                    key={security.code}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectEmiten(security)}
                    className={`flex w-full flex-col border-b border-zinc-100 px-3 py-2 text-left transition last:border-0 hover:bg-yellow-500/10 dark:border-zinc-800 ${
                      form.emiten === security.code
                        ? "bg-yellow-500/10"
                        : ""
                    }`}
                  >
                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                      {security.code}
                    </span>

                    {security.name && (
                      <span className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {security.name}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-xs text-zinc-500">
                  {form.emiten
                    ? `Emiten "${form.emiten}" tidak ditemukan`
                    : "Data emiten tidak tersedia"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FREE FLOAT */}

        <Input
          placeholder="FREE FLOAT"
          type="text"
          value={form.freeFloat}
          className="text-center"
          onChange={(e) => handleChange("freeFloat", e.target.value)}
        />

        {/* CSO */}

        <Input
          placeholder="CSO"
          type="text"
          value={form.cso}
          className="text-center uppercase"
          onChange={(e) => handleChange("cso", e.target.value)}
        />

        {/* NET BUY */}

        <Input
          placeholder="Net Buy"
          type="text"
          value={form.netBuy}
          className="text-center uppercase"
          onChange={(e) => handleChange("netBuy", e.target.value)}
        />
      </div>

      {/* INFO CACHE */}

      <p className="text-[11px] text-zinc-500">
        {securities.length > 0
          ? `${securities.length} emiten tersedia di cache lokal`
          : isSecuritiesLoading
            ? "Sedang mengambil data emiten..."
            : ""}
      </p>

      {/* BUTTON SUBMIT */}

      <button
        type="button"
        onClick={handleSubmit}
        className="h-11 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-sm font-medium text-yellow-600 transition-all duration-300 hover:border-yellow-500/60 hover:bg-yellow-500/15 hover:shadow-[0_0_25px_rgba(234,179,8,0.12)] active:scale-[0.98] dark:text-yellow-400"
      >
        Tampilkan
      </button>

      {/* TABLE */}

      {data.length > 0 && (
        <>
          {/* TABLE TOOLBAR */}

          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-100 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Sort by
              </span>

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as "accumulation" | "emiten"
                  )
                }
                className="min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none transition focus:border-yellow-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                aria-label="Urutkan berdasarkan"
              >
                <option value="accumulation">Accumulation</option>
                <option value="emiten">Name</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setSortDirection((prev) =>
                    prev === "asc" ? "desc" : "asc"
                  )
                }
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-yellow-500 hover:text-yellow-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:text-yellow-400"
                aria-label={
                  sortDirection === "asc"
                    ? "Ascending, klik untuk descending"
                    : "Descending, klik untuk ascending"
                }
              >
                <span className="text-base leading-none">
                  {sortDirection === "asc" ? "↑" : "↓"}
                </span>

                <span>{sortDirection === "asc" ? "Asc" : "Des"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleClearAll}
              title="Hapus semua data"
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
            >
              <LucideEraser size={14} />
            </button>
          </div>

          {/* TABLE BODY */}

          <div className="overflow-y-scroll rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                    <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                      Akumulasi
                    </th>

                    <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                      Kode Broker
                    </th>

                    <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                      Kode Emiten
                    </th>

                    <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                      Free Float
                    </th>

                    <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                      CSO
                    </th>

                    <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                      Net Buy
                    </th>

                    <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400" />
                  </tr>
                </thead>

                <tbody>
                  {sortedData.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-900/60"
                    >
                      <td
                        className={`px-4 py-3 text-center font-semibold ${
                          item.accumulation < 0
                            ? "text-red-500 dark:text-red-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {item.accumulation.toFixed(2)}%
                      </td>

                      <td className="px-4 py-3 text-center font-semibold text-yellow-600 dark:text-yellow-400">
                        {item.broker}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setPopupData({
                              emiten: item.emiten,
                              freeFloat: item.freeFloat,
                              cso: item.cso,
                              netBuy: item.netBuy,
                              broker: item.broker,
                              accumulation: item.accumulation,
                            })
                          }
                          className="cursor-pointer font-semibold transition hover:text-blue-500 hover:underline dark:hover:text-blue-300"
                        >
                          {item.emiten}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                        {item.freeFloat}
                      </td>

                      <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                        {item.cso}
                      </td>

                      <td
                        className={`px-4 py-3 text-center font-semibold ${
                          item.netBuy.startsWith("-")
                            ? "text-red-500 dark:text-red-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {item.netBuy}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="cursor-pointer px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
                          aria-label={`Hapus ${item.broker} - ${item.emiten}`}
                        >
                          <LucideX size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* EMPTY STATE */}

      {data.length === 0 && (
        <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-400">Belum ada data broker</p>
        </div>
      )}

      {/* POPUP VALIDASI */}

      {showPopup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => setShowPopup(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Data belum lengkap
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Silakan isi bagian berikut:
              </p>
            </div>

            <div className="space-y-2">
              {missingFields.map((field) => (
                <div
                  key={field}
                  className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {field}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowPopup(false)}
              className="mt-5 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* POPUP BROKER */}

      {popupData && (
        <BrokerPopup
          {...popupData}
          onClose={() => setPopupData(null)}
        />
      )}
    </div>
  );
}