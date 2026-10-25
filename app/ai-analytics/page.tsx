"use client";

import { useCallback, useState } from "react";
import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, CircleHelp, LoaderCircle, Radar, RefreshCw, ShieldAlert } from "lucide-react";

type Result = {
  symbol: string; name: string | null; status: "watch" | "setup" | "insufficient-data" | "avoid"; score: number | null; scoreLabel: string;
  lastPrice: number | null; priceDate: string | null; entryLow: number | null; entryHigh: number | null; stopLoss: number | null; takeProfit: number | null; riskReward: number | null;
  indicators: { rsi14: number | null; ma20: number | null; ma50: number | null; volumeRatio: number | null; support: number | null; resistance: number | null };
  scoreBreakdown: { technical: number | null; fundamental: number | null; catalyst: number | null };
  reasons: string[]; risks: string[]; missingData: string[];
  catalysts: Array<{ title: string; type: string; date: string | null; sourceName: string | null; sourceUrl: string | null; verified: boolean }>;
};
type ScanResponse = { ok: boolean; scannedAt: string; universeCount: number; limitedUniverse: boolean; summary: { scanned: number; setups: number; watch: number; insufficientData: number; avoid: number }; noCandidates: boolean; notice: string | null; dataCoverage: { note: string; fundamentalsAvailable: number; verifiedCatalystAvailable: number }; results: Result[]; error?: string; message?: string };
const money = (n: number | null) => n === null ? "—" : `Rp${Math.round(n).toLocaleString("id-ID")}`;
const fixed = (n: number | null, suffix = "") => n === null ? "—" : `${n.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${suffix}`;
const dateLabel = (s: string | null) => s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function AIAnalyticsPage() {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [symbolInput, setSymbolInput] = useState("");
  const [filter, setFilter] = useState("all");

  const runScan = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Lu harus login terlebih dahulu.");
      const token = await getIdToken(user, true);
      const symbols = symbolInput.trim() ? symbolInput.split(/[ ,;\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean) : undefined;
      const response = await fetch("/api/ai-analytics/scan", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(symbols?.length ? { symbols } : {}) , cache: "no-store" });
      const json = await response.json() as ScanResponse;
      if (!response.ok || !json.ok) throw new Error(json.message || "Scan gagal dijalankan.");
      setData(json);
    } catch (e) { setError(e instanceof Error ? e.message : "Terjadi kesalahan yang tidak diketahui."); }
    finally { setLoading(false); }
  }, [symbolInput]);

  const visible = (data?.results ?? []).filter(item => filter === "all" || item.status === filter);
  return <main className="min-h-screen bg-[var(--kt-bg,#080d18)] px-4 py-6 text-[var(--kt-text,#e8edf7)] sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300"><Radar size={14}/> MARKET INTELLIGENCE</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--kt-muted,#91a0b8)]">Analisis swing trading berbasis candle, momentum, volume, fundamental, dan katalis yang tersedia. Setiap alasan ditampilkan agar bisa diperiksa.</p>
        </div>
        <button onClick={runScan} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? <LoaderCircle size={17} className="animate-spin"/> : <RefreshCw size={17}/>} {loading ? "Menganalisis..." : "Scan peluang saham"}
        </button>
      </header>

      <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--kt-muted,#91a0b8)]">Universe saham (opsional)</span><input value={symbolInput} onChange={e => setSymbolInput(e.target.value)} placeholder="Kosongkan untuk scan database · contoh: BBCA, ANTM, AUTO" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"/><span className="mt-2 block text-xs text-[var(--kt-muted,#91a0b8)]">Batasi ke ticker tertentu dengan memisahkan kode menggunakan koma atau spasi.</span></label>
        <div className="flex items-center gap-2 text-xs text-[var(--kt-muted,#91a0b8)]"><Activity size={15}/> Horizon: swing trading</div>
      </section>

      {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"><AlertTriangle className="mt-0.5 shrink-0" size={18}/><div><b>Scan gagal</b><p className="mt-1">{error}</p></div></div>}
      {data && <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[{label:"Saham dipindai",value:data.summary.scanned,icon:<Radar size={17}/>},{label:"Setup awal",value:data.summary.setups,icon:<CheckCircle2 size={17}/>},{label:"Pantau",value:data.summary.watch,icon:<Activity size={17}/>},{label:"Data kurang",value:data.summary.insufficientData,icon:<CircleHelp size={17}/>},{label:"Risiko / invalid",value:data.summary.avoid,icon:<ShieldAlert size={17}/>}].map(card => <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center justify-between text-[var(--kt-muted,#91a0b8)]"><span className="text-xs">{card.label}</span>{card.icon}</div><div className="mt-3 text-3xl font-bold tabular-nums">{card.value}</div></div>)}
        </section>
        {data.noCandidates && <div className="flex gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm"><AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-300"/><div><b className="text-amber-200">Scan selesai — belum ada setup yang lolos</b><p className="mt-1 text-[var(--kt-muted,#c0c8d6)]">{data.notice} Bukan otomatis error; buka filter Pantau atau Data Kurang untuk melihat alasannya.</p></div></div>}
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold">Hasil analisis</h2><p className="mt-1 text-xs text-[var(--kt-muted,#91a0b8)]">Diperbarui {dateLabel(data.scannedAt)} · {data.universeCount} ticker dalam universe scan{data.limitedUniverse ? " (dibatasi 500 dokumen pertama)" : ""}</p></div><select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-white/10 bg-[#101827] px-3 py-2 text-sm"><option value="all">Semua status</option><option value="setup">Setup awal</option><option value="watch">Pantau</option><option value="insufficient-data">Data kurang</option><option value="avoid">Hindari / risiko</option></select></div>
          <div className="mt-4 space-y-3">{visible.map(item => <article key={item.symbol} className="rounded-xl border border-white/10 bg-black/10 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{item.symbol}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === "setup" ? "bg-emerald-400/10 text-emerald-300" : item.status === "avoid" ? "bg-rose-400/10 text-rose-300" : item.status === "watch" ? "bg-amber-400/10 text-amber-300" : "bg-slate-400/10 text-slate-300"}`}>{item.scoreLabel}</span></div><p className="mt-1 text-xs text-[var(--kt-muted,#91a0b8)]">{item.name || "Nama emiten belum tersedia"} · Candle terakhir: {item.priceDate || "tanggal tidak tersedia"}</p></div><div className="flex items-center gap-4"><div><p className="text-xs text-[var(--kt-muted,#91a0b8)]">Harga terakhir</p><p className="mt-1 text-lg font-bold tabular-nums">{money(item.lastPrice)}</p></div><div><p className="text-xs text-[var(--kt-muted,#91a0b8)]">Skor setup</p><p className="mt-1 text-lg font-bold tabular-nums">{item.score === null ? "—" : `${item.score}/100`}</p></div></div></div>
            {item.lastPrice !== null && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Area entry indikatif" value={`${money(item.entryLow)} – ${money(item.entryHigh)}`}/><Metric label="Stop loss" value={money(item.stopLoss)} danger/><Metric label="Target indikatif" value={money(item.takeProfit)} positive/><Metric label="Risk / reward" value={item.riskReward === null ? "—" : `1 : ${fixed(item.riskReward)}`}/></div>}
            <div className="mt-4 grid gap-4 lg:grid-cols-2"><div><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-300">Alasan yang mendukung</h4>{item.reasons.length ? <ul className="space-y-2">{item.reasons.map((r,i)=><li key={i} className="flex gap-2 text-sm leading-5 text-slate-200"><ArrowUpRight size={15} className="mt-0.5 shrink-0 text-emerald-300"/>{r}</li>)}</ul> : <p className="text-sm text-[var(--kt-muted,#91a0b8)]">Belum ada bukti pendukung yang cukup.</p>}</div><div><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-300">Risiko / alasan belum entry</h4>{item.risks.length ? <ul className="space-y-2">{item.risks.map((r,i)=><li key={i} className="flex gap-2 text-sm leading-5 text-slate-300"><ArrowDownRight size={15} className="mt-0.5 shrink-0 text-rose-300"/>{r}</li>)}</ul> : <p className="text-sm text-[var(--kt-muted,#91a0b8)]">Tidak ada risiko tambahan yang terdeteksi oleh aturan ini.</p>}</div></div>
            <div className="mt-4 flex flex-wrap gap-2">{[["RSI14",fixed(item.indicators.rsi14)],["MA20",money(item.indicators.ma20)],["MA50",money(item.indicators.ma50)],["Volume",fixed(item.indicators.volumeRatio,"x")],["Support",money(item.indicators.support)],["Resistance",money(item.indicators.resistance)]].map(([k,v])=><span key={k} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[var(--kt-muted,#b4bfd1)]">{k}: <b className="text-slate-200">{v}</b></span>)}</div>
            {(item.missingData.length > 0 || item.catalysts.length > 0) && <details className="mt-4 rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-xs font-semibold text-[var(--kt-muted,#b4bfd1)]">Data yang belum tersedia & katalis ({item.missingData.length} / {item.catalysts.length})</summary>{item.missingData.length > 0 && <div className="mt-3"><p className="mb-1 text-xs font-bold">Data yang belum tersedia</p><ul className="list-inside list-disc space-y-1 text-xs text-[var(--kt-muted,#91a0b8)]">{item.missingData.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}{item.catalysts.length > 0 && <div className="mt-3 space-y-2">{item.catalysts.map((c,i)=><div key={i} className="rounded-lg bg-white/[0.03] p-3 text-xs"><p className="font-semibold">{c.title}</p><p className="mt-1 text-[var(--kt-muted,#91a0b8)]">{c.type} · {c.date || "Tanggal tidak tersedia"} · {c.verified ? "Terverifikasi menurut data tersimpan" : "Belum terverifikasi"}</p>{c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-cyan-300 underline">Buka sumber {c.sourceName ? `(${c.sourceName})` : ""}</a>}</div>)}</div>}</details>}
          </article>)}{visible.length === 0 && <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-[var(--kt-muted,#91a0b8)]">Tidak ada hasil pada filter ini.</div>}</div>
        </section>
        <section className="flex gap-3 rounded-xl border border-white/10 p-4 text-xs leading-5 text-[var(--kt-muted,#91a0b8)]"><CalendarDays size={17} className="mt-0.5 shrink-0"/><div><b className="text-slate-300">Cakupan dan batas data</b><p className="mt-1">{data.dataCoverage.note}</p><p className="mt-1">Fundamental tersedia untuk {data.dataCoverage.fundamentalsAvailable} saham; katalis terverifikasi tersedia untuk {data.dataCoverage.verifiedCatalystAvailable} saham. Skor setup bukan probabilitas profit. Entry/SL/TP adalah estimasi aturan teknikal, bukan order otomatis atau jaminan hasil.</p></div></section>
      </>}
      {!data && !loading && !error && <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Radar size={27}/></div><h2 className="mt-4 text-lg font-bold">Siap menganalisis pasar</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--kt-muted,#91a0b8)]">Jalankan scan untuk membaca candle yang tersimpan di database. Hasil akan menampilkan alasan, risiko, skor setup, area entry, stop loss, dan target indikatif.</p><button onClick={runScan} className="mt-5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-400/15">Mulai scan pertama</button></div>}
    </div>
  </main>;
}

function Metric({ label, value, danger, positive }: { label: string; value: string; danger?: boolean; positive?: boolean }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3"><p className="text-[11px] text-[var(--kt-muted,#91a0b8)]">{label}</p><p className={`mt-1 break-words text-sm font-bold tabular-nums ${danger ? "text-rose-300" : positive ? "text-emerald-300" : "text-slate-100"}`}>{value}</p></div>;
}
