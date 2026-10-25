export type CandleInput = {
  date?: unknown; open?: unknown; high?: unknown; low?: unknown; close?: unknown; volume?: unknown;
};

export type FundamentalInput = {
  revenueGrowthPct?: unknown;
  profitGrowthPct?: unknown;
  roePct?: unknown;
  debtToEquity?: unknown;
  per?: unknown;
  pbv?: unknown;
  reportDate?: unknown;
  sourceUrl?: unknown;
};

export type CatalystInput = {
  title?: unknown;
  type?: unknown;
  publishedAt?: unknown;
  eventDate?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  verified?: unknown;
  summary?: unknown;
};

export type AnalyticsStock = {
  symbol: string;
  name?: string;
  candles: CandleInput[];
  fundamentals?: FundamentalInput | null;
  catalysts?: CatalystInput[];
  specialBoard?: boolean;
  suspended?: boolean;
};

export type AnalyticsResult = {
  symbol: string;
  name: string | null;
  status: "watch" | "setup" | "insufficient-data" | "avoid";
  score: number | null;
  scoreLabel: string;
  lastPrice: number | null;
  priceDate: string | null;
  entryLow: number | null;
  entryHigh: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  indicators: { rsi14: number | null; ma20: number | null; ma50: number | null; volumeRatio: number | null; support: number | null; resistance: number | null };
  scoreBreakdown: { technical: number | null; fundamental: number | null; catalyst: number | null };
  reasons: string[];
  risks: string[];
  missingData: string[];
  catalysts: Array<{ title: string; type: string; date: string | null; sourceName: string | null; sourceUrl: string | null; verified: boolean }>;
};

type Candle = { date: string; open: number; high: number; low: number; close: number; volume: number };
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") { const n = Number(v.replace(/,/g, "")); if (Number.isFinite(n)) return n; }
  return null;
};
const str = (v: unknown): string | null => typeof v === "string" && v.trim() ? v.trim() : null;
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
function sma(xs: number[], period: number) { return xs.length >= period ? mean(xs.slice(-period)) : null; }
function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gain += delta; else loss -= delta;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + (gain / period) / (loss / period));
}
function validCandles(input: CandleInput[]): Candle[] {
  return input.map((x) => ({ date: String(x.date ?? ""), open: num(x.open) ?? 0, high: num(x.high) ?? 0, low: num(x.low) ?? 0, close: num(x.close) ?? 0, volume: num(x.volume) ?? 0 }))
    .filter((x) => x.close > 0 && x.open > 0 && x.high >= Math.max(x.open, x.close) && x.low > 0 && x.low <= Math.min(x.open, x.close) && x.volume >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
function scoreFundamentals(f?: FundamentalInput | null) {
  if (!f) return { score: null as number | null, reasons: [] as string[], missing: ["Data fundamental belum tersedia"] };
  const reasons: string[] = [], missing: string[] = [];
  let points = 0, available = 0;
  const rev = num(f.revenueGrowthPct), profit = num(f.profitGrowthPct), roe = num(f.roePct), de = num(f.debtToEquity), per = num(f.per);
  if (rev !== null) { available++; if (rev > 0) { points += 1; reasons.push(`Pertumbuhan pendapatan ${rev.toFixed(1)}% (data tersimpan).`); } else reasons.push(`Pertumbuhan pendapatan ${rev.toFixed(1)}% belum positif.`); } else missing.push("Pertumbuhan pendapatan");
  if (profit !== null) { available++; if (profit > 0) { points += 1; reasons.push(`Pertumbuhan laba ${profit.toFixed(1)}% (data tersimpan).`); } else reasons.push(`Pertumbuhan laba ${profit.toFixed(1)}% belum positif.`); } else missing.push("Pertumbuhan laba");
  if (roe !== null) { available++; if (roe >= 10) { points += 1; reasons.push(`ROE ${roe.toFixed(1)}% memenuhi ambang awal 10%.`); } else reasons.push(`ROE ${roe.toFixed(1)}% di bawah ambang awal 10%.`); } else missing.push("ROE");
  if (de !== null) { available++; if (de <= 1) { points += 1; reasons.push(`DER ${de.toFixed(2)}x tidak lebih dari 1x.`); } else reasons.push(`DER ${de.toFixed(2)}x relatif tinggi menurut ambang umum; cek karakter sektor.`); } else missing.push("DER");
  if (per !== null) { available++; if (per > 0 && per <= 20) { points += 1; reasons.push(`PER ${per.toFixed(2)}x berada di bawah ambang screening 20x, bukan nilai wajar pasti.`); } else reasons.push(`PER ${per.toFixed(2)}x perlu dibandingkan dengan sektor dan kualitas laba.`); } else missing.push("PER");
  return { score: available ? Math.round(points / available * 20) : null, reasons, missing };
}
function cleanCatalysts(input: CatalystInput[] = []) {
  return input.map((x) => ({ title: str(x.title), type: str(x.type) ?? "Tidak diklasifikasikan", date: str(x.eventDate) ?? str(x.publishedAt), sourceName: str(x.sourceName), sourceUrl: str(x.sourceUrl), verified: x.verified === true }))
    .filter((x) => x.title)
    .map((x) => ({ title: x.title!, type: x.type, date: x.date, sourceName: x.sourceName, sourceUrl: x.sourceUrl, verified: x.verified }));
}

export function analyzeStock(stock: AnalyticsStock): AnalyticsResult {
  const candles = validCandles(stock.candles ?? []);
  const base = {
    symbol: stock.symbol.toUpperCase(), name: stock.name ?? null,
    indicators: { rsi14: null as number | null, ma20: null as number | null, ma50: null as number | null, volumeRatio: null as number | null, support: null as number | null, resistance: null as number | null },
    scoreBreakdown: { technical: null as number | null, fundamental: null as number | null, catalyst: null as number | null },
    lastPrice: null as number | null, priceDate: null as string | null, entryLow: null as number | null, entryHigh: null as number | null, stopLoss: null as number | null, takeProfit: null as number | null, riskReward: null as number | null,
    reasons: [] as string[], risks: [] as string[], missingData: [] as string[], catalysts: cleanCatalysts(stock.catalysts),
  };
  if (candles.length < 25) return { ...base, status: "insufficient-data", score: null, scoreLabel: "Data tidak cukup", missingData: [`Hanya ${candles.length} candle valid; minimal 25 dibutuhkan.`], reasons: [], risks: ["Jangan mengambil keputusan dari data harga yang tidak cukup."] };
  const closes = candles.map(x => x.close), last = candles[candles.length - 1], prev = candles[candles.length - 2];
  const ma20 = sma(closes, 20), ma50 = sma(closes, 50), rsi14 = rsi(closes);
  const volAvg = mean(candles.slice(-21, -1).map(x => x.volume).filter(x => x > 0));
  const volumeRatio = volAvg && volAvg > 0 ? last.volume / volAvg : null;
  const recent = candles.slice(-20), support = Math.min(...recent.map(x => x.low)), resistance = Math.max(...recent.slice(0, -1).map(x => x.high));
  const nearSupport = last.close <= support * 1.04;
  const nearMA20 = ma20 !== null && Math.abs(last.close - ma20) / ma20 <= 0.035;
  const bullishEngulfing = last.close > last.open && prev.close < prev.open && last.open <= prev.close && last.close >= prev.open;
  const hammer = (Math.min(last.open, last.close) - last.low) >= Math.abs(last.close - last.open) * 1.8 && (last.high - Math.max(last.open, last.close)) <= (last.high - last.low) * 0.3;
  const reversal = bullishEngulfing || hammer;
  const breakout = last.close > resistance && volumeRatio !== null && volumeRatio >= 1.3;
  const uptrend = ma50 !== null ? last.close > ma20! && ma20! > ma50 : last.close > ma20!;
  let technical = 0;
  const reasons: string[] = [], risks: string[] = [], missingData: string[] = [];
  if (uptrend) { technical += 15; reasons.push(ma50 !== null ? "Harga di atas MA20 dan MA20 di atas MA50; struktur tren mendukung." : "Harga di atas MA20; MA50 belum tersedia karena riwayat terbatas."); }
  else { risks.push("Tren belum terkonfirmasi positif berdasarkan MA20/MA50."); }
  if (nearSupport || nearMA20) { technical += 12; reasons.push(`Harga dekat ${nearSupport && nearMA20 ? "support 20 candle dan MA20" : nearSupport ? "support 20 candle" : "MA20"}; berpotensi menjadi area pullback, bukan jaminan pantulan.`); }
  if (reversal) { technical += 10; reasons.push(`Candle terakhir menunjukkan ${bullishEngulfing ? "bullish engulfing" : "pola menyerupai hammer"}.`); }
  if (volumeRatio !== null && volumeRatio >= 1.2) { technical += 10; reasons.push(`Volume ${volumeRatio.toFixed(2)}x rata-rata 20 candle sebelumnya, mendukung konfirmasi aktivitas.`); }
  else if (volumeRatio !== null && volumeRatio >= 1) { technical += 5; reasons.push(`Volume ${volumeRatio.toFixed(2)}x rata-rata; meningkat tipis, belum menjadi konfirmasi kuat.`); }
  else risks.push("Volume belum meningkat dibandingkan rata-rata 20 candle.");
  if (rsi14 !== null && rsi14 >= 45 && rsi14 <= 68) { technical += 8; reasons.push(`RSI14 ${rsi14.toFixed(1)} berada pada rentang momentum yang relatif sehat.`); }
  else if (rsi14 !== null && rsi14 < 35) { technical += 4; reasons.push(`RSI14 ${rsi14.toFixed(1)} oversold; perlu konfirmasi karena tren turun bisa berlanjut.`); }
  else if (rsi14 !== null && rsi14 > 70) risks.push(`RSI14 ${rsi14.toFixed(1)} tinggi; risiko mengejar harga meningkat.`);
  if (breakout) { technical = Math.min(60, technical + 5); reasons.push("Close menembus high 19 candle sebelumnya dengan volume minimal 1,3x; sinyal breakout perlu validasi lanjutan."); }
  const fundamental = scoreFundamentals(stock.fundamentals);
  const catalystList = base.catalysts;
  const verifiedCatalysts = catalystList.filter(x => x.verified && x.sourceUrl && x.date);
  const catalystScore = verifiedCatalysts.length ? Math.min(20, verifiedCatalysts.length * 10) : null;
  if (verifiedCatalysts.length) reasons.push(`Ada ${verifiedCatalysts.length} katalis bertanda terverifikasi dengan tanggal dan tautan sumber; dampak ekonominya tetap perlu dibaca.`);
  else missingData.push("Katalis/event terverifikasi dengan sumber dan tanggal");
  reasons.push(...fundamental.reasons);
  missingData.push(...fundamental.missing);
  if (!str(stock.fundamentals?.reportDate)) missingData.push("Tanggal laporan fundamental");
  if (stock.specialBoard) risks.push("Emiten ditandai berada di papan pemantauan khusus; periksa notasi dan mekanisme perdagangan BEI.");
  if (stock.suspended) risks.push("Status saham ditandai suspensi; jangan gunakan setup entry otomatis.");
  const available: Array<{ score: number; weight: number }> = [{ score: technical, weight: 60 }];
  if (fundamental.score !== null) available.push({ score: fundamental.score, weight: 20 });
  if (catalystScore !== null) available.push({ score: catalystScore, weight: 20 });
  const weightSum = available.reduce((a, x) => a + x.weight, 0);
  const score = Math.round(available.reduce((a, x) => a + x.score / (x.weight === 60 ? 60 : 20) * x.weight, 0) / weightSum * 100);
  // The normalized score is a setup-strength score, not a success probability.
  const entryLow = Math.floor(Math.min(last.close, ma20 ?? last.close) * 0.99);
  const entryHigh = Math.ceil(Math.max(last.close, ma20 ?? last.close) * 1.005);
  const stopLoss = Math.floor(Math.min(support, last.low) * 0.99);
  const risk = entryHigh - stopLoss;
  let takeProfit = resistance > entryHigh ? resistance : entryHigh + 2 * risk;
  takeProfit = Math.ceil(takeProfit);
  const riskReward = risk > 0 ? (takeProfit - entryHigh) / risk : null;
  const invalidRisk = stock.suspended === true || stopLoss <= 0 || stopLoss >= entryHigh || !Number.isFinite(takeProfit) || takeProfit <= entryHigh || riskReward === null || riskReward < 1.5;
  if (invalidRisk) risks.push("Rencana entry/SL/TP belum memenuhi validasi risk/reward minimal 1,5; tidak diberi status setup.");
  if (candles.length < 50) missingData.push("Riwayat 50 candle untuk validasi tren MA50");
  const status: AnalyticsResult["status"] = invalidRisk ? "avoid" : score >= 70 && (uptrend || breakout) && (reversal || breakout) ? "setup" : "watch";
  if (status === "setup") reasons.push("Setup memenuhi aturan screening awal; tetap tunggu eksekusi sesuai harga dan rencana risiko.");
  else if (status === "watch") reasons.push("Belum cukup konfirmasi untuk menyebutnya setup entry; masukkan watchlist dan tunggu konfirmasi.");
  if (!stock.fundamentals) risks.push("Data fundamental tidak ditemukan; skor tidak boleh dianggap penilaian fundamental lengkap.");
  if (!verifiedCatalysts.length) risks.push("Tidak ada katalis terverifikasi pada data yang tersedia; bukan berarti tidak ada berita/event di luar database.");
  return { ...base, status, score, scoreLabel: status === "setup" ? "Setup terkonfirmasi awal" : status === "avoid" ? "Hindari / validasi risiko gagal" : "Pantau, belum entry", lastPrice: last.close, priceDate: last.date || null, entryLow, entryHigh, stopLoss, takeProfit, riskReward: riskReward === null ? null : Number(riskReward.toFixed(2)), indicators: { rsi14: rsi14 === null ? null : Number(rsi14.toFixed(2)), ma20, ma50, volumeRatio: volumeRatio === null ? null : Number(volumeRatio.toFixed(2)), support, resistance }, scoreBreakdown: { technical, fundamental: fundamental.score, catalyst: catalystScore }, reasons, risks, missingData: [...new Set(missingData)], catalysts: catalystList };
}
