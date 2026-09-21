"use client";

import { useEffect, useState } from "react";
import Input from "../components/fragments/ui/input";
import { LucideEraser,  LucideX } from "lucide-react";
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

const STORAGE_KEY = "broker-accumulation-data";

const initialForm = {
  broker: "",
  emiten: "",
  freeFloat: "",
  cso: "",
  netBuy: "",
};

// ======================================================
// PARSE VALUE
// ======================================================
// Contoh:
// 99,3K  → 99.300
// 2,15M  → 2.150.000
// 22,70B → 22.700.000.000
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
  // ====================================================
  // BROKER
  // Maksimal 2 huruf dan otomatis uppercase
  // Contoh:
  // cc → CC
  // bk → BK
  // ====================================================

  if (field === "broker") {
    return value
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);
  }

  // ====================================================
  // EMITEN
  // Maksimal 4 huruf dan otomatis uppercase
  // Contoh:
  // laju → LAJU
  // bbca → BBCA
  // ====================================================

  if (field === "emiten") {
    return value
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
  }

  // ====================================================
  // FREE FLOAT
  //
  // User bebas mengetik:
  //
  // 23
  // 23.
  // 23.5
  // 23.54
  // 23.54%
  //
  // Tanda % TIDAK ditambahkan otomatis ketika mengetik.
  // ====================================================

  if (field === "freeFloat") {
    let formatted = value
      .replace(/[^0-9.,%]/g, "")
      .replace(/,/g, ".");

    // --------------------------------------------
    // Pisahkan angka dari %
    // --------------------------------------------

    const hasPercent = formatted.includes("%");

    formatted = formatted.replace(/%/g, "");

    // --------------------------------------------
    // Hanya boleh satu titik desimal
    // --------------------------------------------

    const firstDot = formatted.indexOf(".");

    if (firstDot !== -1) {
      formatted =
        formatted.slice(0, firstDot + 1) +
        formatted.slice(firstDot + 1).replace(/\./g, "");
    }

    // --------------------------------------------
    // Tambahkan kembali % jika user memang mengetiknya
    // --------------------------------------------

    if (hasPercent) {
      formatted += "%";
    }

    return formatted;
  }

  // ====================================================
  // CSO
  //
  // Contoh:
  // 22,70b → 22.70B
  // 2.15b  → 2.15B
  // 500m   → 500M
  // 219.1k → 219.1K
  // ====================================================

  if (field === "cso") {
    return value
      .toUpperCase()
      .replace(/[^0-9.,BKM]/g, "")
      .replace(/,/g, ".");
  }

  // ====================================================
  // NET BUY
  //
  // Contoh:
  // 219,1k  → 219.1K
  // -219,1k → -219.1K
  // ====================================================

  if (field === "netBuy") {
    return value
      .toUpperCase()
      .replace(/[^0-9.,BKM-]/g, "")
      .replace(/,/g, ".");
  }

  return value;
};

export default function BrokerAccumulation() {
  const [form, setForm] = useState(initialForm);
  const [data, setData] = useState<BrokerData[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [popupData, setPopupData] = useState<{
  emiten: string;
  freeFloat: string;
  cso: string;
  netBuy: string;
  broker: string;
  accumulation: number;
} | null>(null);

  // Muat data tersimpan saat komponen pertama kali dibuka.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setData(parsed.filter((item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.broker === "string" &&
            typeof item.emiten === "string" &&
            typeof item.accumulation === "number"
          ));
        }
      }
    } catch (error) {
      console.error("Gagal memuat data broker dari localStorage:", error);
    } finally {
      setIsStorageLoaded(true);
    }
  }, []);

  // Simpan setiap perubahan setelah data awal selesai dimuat.
  useEffect(() => {
    if (!isStorageLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Gagal menyimpan data broker ke localStorage:", error);
    }
  }, [data, isStorageLoaded]);

  const handleDelete = (id: string) => {
    setData((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setData([]);
  };
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [sortBy, setSortBy] = useState<"accumulation" | "emiten">("accumulation");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedData = [...data].sort((a, b) => {
    const comparison =
      sortBy === "accumulation"
        ? a.accumulation - b.accumulation
        : a.emiten.localeCompare(b.emiten);

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // ======================================================
  // HANDLE INPUT
  // ======================================================

  const handleChange = (
    field: keyof typeof form,
    value: string
  ) => {
    const formattedValue = formatInput(field, value);

    setForm((prev) => ({
      ...prev,
      [field]: formattedValue,
    }));
  };

  // ======================================================
  // SUBMIT
  // ======================================================

  const handleSubmit = () => {
    const missing: string[] = [];

    // ====================================================
    // VALIDASI BROKER
    // ====================================================

    if (!form.broker.trim()) {
      missing.push("Kode Broker");
    } else if (!/^[A-Z]{2}$/.test(form.broker)) {
      missing.push("Kode Broker harus 2 huruf");
    }

    // ====================================================
    // VALIDASI EMITEN
    // ====================================================

    if (!form.emiten.trim()) {
      missing.push("Kode Emiten");
    } else if (!/^[A-Z]{4}$/.test(form.emiten)) {
      missing.push("Kode Emiten harus 4 huruf");
    }

    // ====================================================
    // VALIDASI FREE FLOAT
    // ====================================================

    if (!form.freeFloat.trim()) {
      missing.push("Free Float");
    }

    // ====================================================
    // VALIDASI CSO
    // ====================================================

    if (!form.cso.trim()) {
      missing.push("CSO");
    }

    // ====================================================
    // VALIDASI NET BUY
    // ====================================================

    if (!form.netBuy.trim()) {
      missing.push("Net Buy");
    }

    // ====================================================
    // JIKA ADA DATA YANG KURANG
    // ====================================================

    if (missing.length > 0) {
      setMissingFields(missing);
      setShowPopup(true);
      return;
    }

    // ====================================================
    // PERHITUNGAN AKUMULASI
    // ====================================================

    // CSO dalam saham
    const cso = parseValue(form.cso);

    // --------------------------------------------
    // FREE FLOAT %
    // --------------------------------------------

    const freeFloatPercent = parseFloat(
      form.freeFloat
        .replace(",", ".")
        .replace("%", "")
    );

    // --------------------------------------------
    // NET BUY dalam LOT
    // --------------------------------------------

    const netBuyLot = parseValue(form.netBuy);

    // --------------------------------------------
    // JUMLAH SAHAM FREE FLOAT
    //
    // CSO × FF%
    // --------------------------------------------

    const freeFloatShares =
      cso * (freeFloatPercent / 100);

    // --------------------------------------------
    // NET BUY LOT → SAHAM
    //
    // 1 LOT = 100 SAHAM
    // --------------------------------------------

    const netBuyShares = netBuyLot * 100;

    // --------------------------------------------
    // AKUMULASI TERHADAP FREE FLOAT
    //
    // Net Buy Saham
    // ----------------------- × 100
    // Free Float Saham
    // --------------------------------------------

    const accumulation =
      freeFloatShares > 0
        ? (netBuyShares / freeFloatShares) * 100
        : 0;

    // ====================================================
    // SIMPAN DATA
    // ====================================================

    setData((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        broker: form.broker.toUpperCase(),

        emiten: form.emiten.toUpperCase(),

        // Tambahkan % hanya pada hasil tabel
        freeFloat: form.freeFloat.endsWith("%")
          ? form.freeFloat
          : `${form.freeFloat}%`,

        cso: form.cso.toUpperCase(),

        netBuy: form.netBuy.toUpperCase(),

        accumulation,
      },
    ]);

    // Reset form
    setForm(initialForm);
  };

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="relative flex h-full w-full flex-col gap-4 overflow-x-auto px-4 py-4 dark:bg-zinc-950 md:mx-auto md:w-1/2">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div>
        <h1 className="text-center text-xl font-semibold text-zinc-900 dark:text-white">
          Broker Accumulation
        </h1>

        <p className="mt-1 text-center text-xs text-zinc-500">
          Masukkan data broker untuk melihat akumulasi
        </p>
      </div>

      {/* ==================================================
          INPUT
      ================================================== */}

      <div className="grid grid-cols-2 gap-2 rounded-xl border-2 border-zinc-200 p-2 dark:border-zinc-800 md:grid-cols-5">

        {/* BROKER */}

        <Input
          placeholder="Broker"
          type="text"
          value={form.broker}
          maxLength={2}
          className="text-center uppercase"
          onChange={(e) =>
            handleChange("broker", e.target.value)
          }
        />

        {/* EMITEN */}

        <Input
          placeholder="Emiten"
          type="text"
          value={form.emiten}
          maxLength={4}
          className="text-center uppercase"
          onChange={(e) =>
            handleChange("emiten", e.target.value)
          }
        />

        {/* FREE FLOAT */}

        <Input
          placeholder="FREE FLOAT"
          type="text"
          value={form.freeFloat}
          className="text-center"
          onChange={(e) =>
            handleChange("freeFloat", e.target.value)
          }
        />

        {/* CSO */}

        <Input
          placeholder="CSO"
          type="text"
          value={form.cso}
          className="text-center uppercase"
          onChange={(e) =>
            handleChange("cso", e.target.value)
          }
        />

        {/* NET BUY */}

        <Input
          placeholder="Net Buy"
          type="text"
          value={form.netBuy}
          className="text-center uppercase"
          onChange={(e) =>
            handleChange("netBuy", e.target.value)
          }
        />

      </div>

      {/* ==================================================
          BUTTON
      ================================================== */}

      <button
        type="button"
        onClick={handleSubmit}
        className="
          h-11
          rounded-xl
          border border-yellow-500/30
          bg-yellow-500/10
          text-sm
          font-medium
          text-yellow-600
          transition-all
          duration-300
          hover:border-yellow-500/60
          hover:bg-yellow-500/15
          hover:shadow-[0_0_25px_rgba(234,179,8,0.12)]
          active:scale-[0.98]
          dark:text-yellow-400
        "
      >
        Tampilkan
      </button>

      {/* ==================================================
          TABLE
      ================================================== */}

      {data.length > 0 && (
        <>
        {
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-100 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-4">

              {/* SORT BY + ASC/DESC BERDAMPINGAN */}
              <div className="flex min-w-0 items-center gap-2">

                <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Sort by
                </span>

                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "accumulation" | "emiten")
                  }
                  className="min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none transition focus:border-yellow-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  aria-label="Urutkan berdasarkan"
                >
                  <option value="accumulation">Accumulation</option>
                  <option value="emiten">Name</option>
                </select>

                {/* ASC / DESC */}
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
                  title={
                    sortDirection === "asc"
                      ? "Ascending (A-Z / kecil ke besar)"
                      : "Descending (Z-A / besar ke kecil)"
                  }
                >
                  <span className="text-base leading-none">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>

                  <span>
                    {sortDirection === "asc" ? "Asc" : "Des"}
                  </span>
                </button>
              </div>

              {/* DELETE DI UJUNG KANAN */}
              <button
                type="button"
                onClick={handleClearAll}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
              >
                <LucideEraser size={14} />
              </button>
            </div>

          }
        <div className="overflow-y-scroll rounded-xl border border-zinc-200 dark:border-zinc-800">
          

          <div className="overflow-x-auto">

            <table className="w-full min-w-[750px] text-sm">

              {/* TABLE HEADER */}

              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">

                  {/* AKUMULASI */}

                  <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                    Akumulasi
                  </th>

                  {/* BROKER */}

                  <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                    Kode Broker
                  </th>

                  {/* EMITEN */}

                  <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                    Kode Emiten
                  </th>

                  {/* FREE FLOAT */}

                  <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                    Free Float
                  </th>

                  {/* CSO */}

                  <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                    CSO
                  </th>

                  {/* NET BUY */}

                  <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                    Net Buy
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">
                    
                  </th>

                </tr>
              </thead>

              {/* TABLE BODY */}

              <tbody>

                {sortedData.map((item, index) => (
                  <tr
                    key={item.id}
                    className="
                      border-b
                      border-zinc-100
                      transition-colors
                      hover:bg-zinc-50
                      dark:border-zinc-800/70
                      dark:hover:bg-zinc-900/60
                    "
                  >

                    {/* AKUMULASI */}

                    <td
                      className={`px-4 py-3 text-center font-semibold ${
                        item.accumulation < 0
                          ? "text-red-500 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {item.accumulation.toFixed(2)}%
                    </td>

                    {/* BROKER */}

                    <td className="px-4 py-3 text-center font-semibold text-yellow-600 dark:text-yellow-400">
                      {item.broker}
                    </td>

                    {/* EMITEN */}
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
                        className="cursor-pointer font-semibold
                          transition hover:text-blue-500 hover:underline
                         dark:hover:text-blue-300"
                      >
                        {item.emiten}
                      </button>
                    </td>
                    {/* FREE FLOAT */}

                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                      {item.freeFloat}
                    </td>

                    {/* CSO */}

                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                      {item.cso}
                    </td>

                    {/* NET BUY */}

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
                        className="px-3 cursor-pointer py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
                        aria-label={`Hapus ${item.broker} - ${item.emiten}`}
                      >
                        <LucideX size={14}/>
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

      {/* ==================================================
          EMPTY STATE
      ================================================== */}

      {data.length === 0 && (
        <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">

          <p className="text-sm text-zinc-400">
            Belum ada data broker
          </p>

        </div>
      )}

      {/* ==================================================
          POPUP VALIDASI
      ================================================== */}

      {showPopup && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/50
            px-4
            backdrop-blur-sm
          "
          onClick={() => setShowPopup(false)}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="
              w-full
              max-w-sm
              rounded-2xl
              border
              border-zinc-200
              bg-white
              p-5
              shadow-2xl
              dark:border-zinc-800
              dark:bg-zinc-950
            "
          >

            {/* POPUP HEADER */}

            <div className="mb-4">

              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Data belum lengkap
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Silakan isi bagian berikut:
              </p>

            </div>

            {/* ERROR LIST */}

            <div className="space-y-2">

              {missingFields.map((field) => (
                <div
                  key={field}
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-red-500/20
                    bg-red-500/5
                    px-3
                    py-2
                    text-sm
                    text-red-600
                    dark:text-red-400
                  "
                >

                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />

                  {field}

                </div>
              ))}

            </div>

            {/* CLOSE */}

            <button
              type="button"
              onClick={() => setShowPopup(false)}
              className="
                mt-5
                w-full
                rounded-xl
                bg-zinc-900
                py-2.5
                text-sm
                font-medium
                text-white
                transition-all
                hover:bg-zinc-800
                dark:bg-white
                dark:text-zinc-900
                dark:hover:bg-zinc-200
              "
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