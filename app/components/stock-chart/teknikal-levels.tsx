"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Crosshair,
  Gauge,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { EntryZone, SRAnalysis, SRZone } from "./support-resistance";

type SmartAnalysis = SRAnalysis & {
  marketRegime?: "uptrend" | "downtrend" | "range" | "volatile" | "neutral";
  entryStatus?: "entry-ready" | "pullback" | "wait" | "too-far" | "support-break" | "no-setup";
  entryConfidence?: number;
  stopLoss?: number | null;
  target1?: number | null;
  target2?: number | null;
};

type SmartEntry = EntryZone & {
  status?: "inside" | "above" | "below";
  stopLoss?: number;
  target?: number | null;
  entryQuality?: number;
};

type Props = { analysis: SmartAnalysis | null; className?: string };

const price = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v);

const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

const rr = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2)}x`;

function barColor(v: number) {
  if (v >= 65) return "bg-emerald-500";
  if (v >= 50) return "bg-amber-400";
  if (v >= 35) return "bg-orange-400";
  return "bg-red-400";
}

function Score({ label, value }: { label: string; value: number }) {
  const n = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] uppercase tracking-[.14em] text-zinc-500">
        <span>{label}</span><b className="text-zinc-700 dark:text-zinc-300">{Math.round(n)}</b>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full rounded-full ${barColor(n)} transition-all duration-700`} style={{ width: `${n}%` }} />
      </div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "gold" | "green" | "red" | "blue" | "neutral" }) {
  const c = {
    gold: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
    red: "border-red-500/25 bg-red-500/10 text-red-500",
    blue: "border-sky-500/25 bg-sky-500/10 text-sky-500",
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/[.07] dark:bg-white/[.03]",
  }[tone];
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${c}`}>{children}</span>;
}

function Metric({ icon, label, value, sub, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "gold" | "green" | "red" | "blue" | "neutral" }) {
  const iconColor = { gold: "text-amber-500", green: "text-emerald-500", red: "text-red-500", blue: "text-sky-500", neutral: "text-zinc-500" }[tone];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-white/[.07] dark:bg-zinc-950/70">
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-amber-400/[.04] blur-2xl group-hover:bg-amber-400/[.08]" />
      <div className="relative">
        <div className="mb-2 flex items-center gap-2"><span className={iconColor}>{icon}</span><span className="text-[9px] font-semibold uppercase tracking-[.15em] text-zinc-500">{label}</span></div>
        <div className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</div>
        {sub && <div className="mt-1 text-[9px] text-zinc-500">{sub}</div>}
      </div>
    </div>
  );
}

function Zone({ zone, current }: { zone: SRZone | null; current: number }) {
  if (!zone) return <div className="rounded-2xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-500 dark:border-white/[.07]">Belum ada zone aktif.</div>;
  const support = zone.type === "support";
  const distance = current ? ((zone.center - current) / current) * 100 : 0;
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${support ? "border-emerald-500/15 bg-emerald-500/[.035]" : "border-red-500/15 bg-red-500/[.035]"}`}>
      <div className={`absolute left-0 top-0 h-full w-0.5 ${support ? "bg-emerald-500" : "bg-red-500"}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.16em] text-zinc-500">
            {support ? <ArrowDown size={13} className="text-emerald-500" /> : <ArrowUp size={13} className="text-red-500" />}
            {support ? "Support Zone" : "Resistance Zone"}
          </div>
          <div className={`mt-1 text-xl font-bold ${support ? "text-emerald-500" : "text-red-500"}`}>{price(zone.center)}</div>
        </div>
        <div className={`text-[11px] font-semibold ${distance <= 0 ? "text-emerald-500" : "text-red-500"}`}>{pct(distance)}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/[.025] p-2 dark:bg-white/[.025]"><div className="text-[8px] uppercase tracking-wider text-zinc-500">Zone</div><div className="mt-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{price(zone.low)} — {price(zone.high)}</div></div>
        <div className="rounded-xl bg-black/[.025] p-2 dark:bg-white/[.025]"><div className="text-[8px] uppercase tracking-wider text-zinc-500">Strength</div><div className="mt-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">{Math.round(zone.strength)}/100</div></div>
      </div>
      <div className="mt-4 space-y-2.5">
        <Score label="Rejection" value={zone.rejectionScore} />
        <Score label="Volume" value={zone.volumeScore} />
        <Score label="Recency" value={zone.recencyScore} />
        <div className="flex justify-between border-t border-zinc-200/70 pt-2 text-[9px] dark:border-white/[.06]"><span className="text-zinc-500">Touches</span><b className="text-zinc-700 dark:text-zinc-300">{zone.touches}×</b></div>
      </div>
    </div>
  );
}

function Entry({ analysis }: { analysis: SmartAnalysis }) {
  const e = analysis.entryZone as SmartEntry | null;
  if (!e) return <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[.035] p-5 text-xs leading-5 text-zinc-500">Engine belum menemukan support aktif yang cukup dekat untuk membentuk Entry Zone.</div>;
  const quality = e.entryQuality ?? e.supportStrength;
  const stop = e.stopLoss ?? analysis.stopLoss ?? null;
  const target1 = e.target ?? analysis.target1 ?? e.resistance?.low ?? null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[.10] via-white to-amber-500/[.025] p-5 dark:from-amber-500/[.10] dark:via-zinc-950 dark:to-amber-500/[.025]">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-2 text-amber-500"><Crosshair size={16} /></div><div><div className="text-[9px] font-bold uppercase tracking-[.18em] text-amber-600 dark:text-amber-400">Entry Intelligence</div><div className="mt-1 text-[10px] text-zinc-500">Support-based setup</div></div></div>
          <div className="flex gap-2"><Pill tone={e.status === "inside" ? "green" : e.status === "below" ? "red" : "gold"}>{e.status === "inside" ? "Price inside zone" : e.status === "below" ? "Below zone" : "Above zone"}</Pill><Pill tone="gold">Quality {Math.round(quality)}</Pill></div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <div><div className="text-[9px] font-bold uppercase tracking-[.17em] text-zinc-500">Entry Range</div><div className="mt-1 flex flex-wrap items-baseline gap-2"><span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{price(e.low)}</span><span className="text-zinc-400">—</span><span className="text-2xl font-bold text-amber-500">{price(e.high)}</span></div><div className="mt-2 flex gap-4 text-[9px] text-zinc-500"><span>Center <b className="text-zinc-700 dark:text-zinc-300">{price(e.center)}</b></span><span>Distance <b className="text-zinc-700 dark:text-zinc-300">{pct(e.distancePercent)}</b></span></div></div>
          <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 dark:border-white/[.06] dark:bg-white/[.025]"><div className="flex justify-between text-[9px] font-bold uppercase tracking-[.14em] text-zinc-500"><span>Setup Quality</span><Gauge size={14} className="text-amber-500" /></div><div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{Math.round(quality)}<span className="text-sm text-zinc-500">/100</span></div><div className="mt-2"><Score label="technical quality" value={quality} /></div></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-white/[.06] dark:bg-white/[.025]"><div className="flex gap-1.5 text-[8px] uppercase tracking-wider text-zinc-500"><ShieldCheck size={11} /> Stop</div><div className="mt-1 text-sm font-semibold text-red-500">{price(stop)}</div></div>
          <div className="rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-white/[.06] dark:bg-white/[.025]"><div className="flex gap-1.5 text-[8px] uppercase tracking-wider text-zinc-500"><Target size={11} /> Target 1</div><div className="mt-1 text-sm font-semibold text-emerald-500">{price(target1)}</div></div>
          <div className="rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-white/[.06] dark:bg-white/[.025]"><div className="flex gap-1.5 text-[8px] uppercase tracking-wider text-zinc-500"><Target size={11} /> Target 2</div><div className="mt-1 text-sm font-semibold text-emerald-500">{price(analysis.target2 ?? null)}</div></div>
          <div className="rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-white/[.06] dark:bg-white/[.025]"><div className="flex gap-1.5 text-[8px] uppercase tracking-wider text-zinc-500"><Activity size={11} /> R/R</div><div className="mt-1 text-sm font-semibold text-amber-500">{rr(e.riskReward)}</div></div>
        </div>
      </div>
    </div>
  );
}

function regimeTone(r?: SmartAnalysis["marketRegime"]): "gold" | "green" | "red" | "blue" | "neutral" {
  if (r === "uptrend") return "green";
  if (r === "downtrend") return "red";
  if (r === "range") return "blue";
  if (r === "volatile") return "gold";
  return "neutral";
}

function regimeText(r?: SmartAnalysis["marketRegime"]) {
  return r === "uptrend" ? "UPTREND" : r === "downtrend" ? "DOWNTREND" : r === "range" ? "RANGE" : r === "volatile" ? "VOLATILE" : "NEUTRAL";
}

function statusText(s?: SmartAnalysis["entryStatus"]) {
  return s === "entry-ready" ? "ENTRY READY" : s === "pullback" ? "PULLBACK" : s === "too-far" ? "TOO FAR" : s === "support-break" ? "SUPPORT BREAK" : s === "wait" ? "WAIT" : "NO SETUP";
}

export default function TechnicalLevels({ analysis, className = "" }: Props) {
  if (!analysis) return <section className={`rounded-3xl border border-zinc-200 bg-white p-5 dark:border-white/[.07] dark:bg-zinc-950 ${className}`}><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-500/10 p-2 text-amber-500"><Activity size={16} /></div><div><div className="text-xs font-bold uppercase tracking-[.17em] text-zinc-800 dark:text-zinc-200">Technical Intelligence</div><div className="mt-1 text-xs text-zinc-500">Data belum cukup untuk membangun level.</div></div></div></section>;

  const confidence = analysis.entryConfidence ?? (analysis.entryZone as SmartEntry | null)?.entryQuality ?? analysis.nearestSupport?.strength ?? 0;
  const regime = analysis.marketRegime ?? "neutral";
  const status = analysis.entryStatus ?? (analysis.entryZone ? "wait" : "no-setup");
  const statusTone = status === "entry-ready" ? "green" : status === "support-break" ? "red" : status === "pullback" ? "blue" : "gold";

  return (
    <section className={`relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/85 shadow-sm backdrop-blur-xl dark:border-white/[.07] dark:bg-zinc-950/80 ${className}`}>
      <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-amber-400/[.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-sky-400/[.035] blur-3xl" />
      <div className="relative p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3"><div className="relative"><div className="absolute inset-0 rounded-xl bg-amber-400/20 blur-md" /><div className="relative rounded-xl border border-amber-400/20 bg-amber-400/10 p-2.5 text-amber-500"><Zap size={17} /></div></div><div><div className="flex items-center gap-2"><h3 className="text-sm font-bold uppercase tracking-[.16em] text-zinc-900 dark:text-zinc-100">Technical Intelligence</h3><span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-zinc-500 dark:border-white/[.06] dark:bg-white/[.03]">S/R Engine</span></div><p className="mt-1 text-[10px] text-zinc-500">Structure • Volatility • Reaction • Risk</p></div></div>
          <div className="flex flex-wrap gap-2"><Pill tone={regimeTone(regime)}>{regimeText(regime)}</Pill><Pill tone={statusTone}>{statusText(status)}</Pill></div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric icon={<Crosshair size={14} />} label="Price" value={price(analysis.currentPrice)} sub="last close" tone="gold" />
          <Metric icon={<Activity size={14} />} label="ATR" value={price(analysis.atr)} sub={pct(analysis.atrPercent)} tone="blue" />
          <Metric icon={<Gauge size={14} />} label="Confidence" value={`${Math.round(confidence)}/100`} sub="technical context" tone={confidence >= 65 ? "green" : confidence >= 45 ? "gold" : "red"} />
          <Metric icon={regime === "downtrend" ? <TrendingDown size={14} /> : <TrendingUp size={14} />} label="Structure" value={regimeText(regime)} sub={`${analysis.supports.length} support · ${analysis.resistances.length} resistance`} tone={regime === "uptrend" ? "green" : regime === "downtrend" ? "red" : "neutral"} />
        </div>

        <div className="mt-4"><Entry analysis={analysis} /></div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div><div className="mb-2 flex items-center justify-between px-1"><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,.7)]" />Active Support</span><span className="text-[9px] text-zinc-500">nearest</span></div><Zone zone={analysis.nearestSupport} current={analysis.currentPrice} /></div>
          <div><div className="mb-2 flex items-center justify-between px-1"><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.7)]" />Active Resistance</span><span className="text-[9px] text-zinc-500">nearest</span></div><Zone zone={analysis.nearestResistance} current={analysis.currentPrice} /></div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/[.06] dark:bg-white/[.02]"><div className="mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-amber-500" /><span className="text-[10px] font-bold uppercase tracking-[.16em] text-zinc-500">Support Evidence</span></div>{analysis.nearestSupport ? <div className="space-y-3"><Score label="Overall strength" value={analysis.nearestSupport.strength} /><Score label="Rejection" value={analysis.nearestSupport.rejectionScore} /><Score label="Volume confirmation" value={analysis.nearestSupport.volumeScore} /><div className="grid grid-cols-2 gap-2 pt-1"><div className="rounded-xl border border-zinc-200/70 bg-white p-3 dark:border-white/[.06] dark:bg-zinc-950/60"><div className="text-[9px] uppercase tracking-wider text-zinc-500">Touches</div><div className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{analysis.nearestSupport.touches}×</div></div><div className="rounded-xl border border-zinc-200/70 bg-white p-3 dark:border-white/[.06] dark:bg-zinc-950/60"><div className="text-[9px] uppercase tracking-wider text-zinc-500">Recency</div><div className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{Math.round(analysis.nearestSupport.recencyScore)}</div></div></div></div> : <div className="text-xs text-zinc-500">Belum ada evidence support.</div>}</div>

          <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/[.06] dark:bg-white/[.02]"><div className="mb-4 flex items-center gap-2"><Target size={14} className="text-red-500" /><span className="text-[10px] font-bold uppercase tracking-[.16em] text-zinc-500">Resistance Map</span></div>{analysis.resistances.length ? <div className="space-y-2">{analysis.resistances.slice(0, 4).map((z, i) => <div key={`${z.center}-${i}`} className="flex items-center justify-between rounded-xl border border-zinc-200/70 bg-white p-3 dark:border-white/[.06] dark:bg-zinc-950/60"><div className="flex items-center gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-[9px] font-bold text-red-500">R{i + 1}</div><div><div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{price(z.center)}</div><div className="text-[9px] text-zinc-500">{price(z.low)} — {price(z.high)}</div></div></div><div className="text-right"><div className="text-[11px] font-bold text-red-500">{Math.round(z.strength)}</div><div className="text-[8px] uppercase tracking-wider text-zinc-500">strength</div></div></div>)}</div> : <div className="text-xs text-zinc-500">Belum ada resistance map.</div>}</div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200/70 pt-3 text-[9px] text-zinc-500 dark:border-white/[.06] sm:flex-row sm:justify-between"><span>S/R engine membaca struktur harga, rejection, volume, recency & ATR.</span><span className="font-medium text-zinc-400">Current {price(analysis.currentPrice)}</span></div>
      </div>
    </section>
  );
}
