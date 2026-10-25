import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { sendTelegramMessage } from "@/lib/telegram";
import { analyzeStock, type AnalyticsStock, type CandleInput, type CatalystInput, type FundamentalInput } from "@/lib/ai-analytics/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HISTORY_LIMIT = 120;
const MAX_UNIVERSE = 500;
const CONCURRENCY = 10;

type UnknownRecord = Record<string, unknown>;
const record = (v: unknown): UnknownRecord => v && typeof v === "object" && !Array.isArray(v) ? v as UnknownRecord : {};
const asText = (v: unknown): string | undefined => typeof v === "string" && v.trim() ? v.trim() : undefined;
const asBool = (v: unknown) => v === true;

async function requireUser(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("AUTH_REQUIRED");
  return getAuth().verifyIdToken(match[1]);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return output;
}

function normalizeCandle(data: UnknownRecord, id: string): CandleInput {
  return {
    date: data.date ?? data.timestamp ?? id,
    open: data.open, high: data.high, low: data.low, close: data.close, volume: data.volume,
  };
}

function normalizeFundamentals(stock: UnknownRecord): FundamentalInput | null {
  const raw = record(stock.fundamentals ?? stock.fundamental ?? stock.financials);
  const aliases: Record<string, unknown> = {
    revenueGrowthPct: raw.revenueGrowthPct ?? raw.revenue_growth_pct ?? raw.revenueGrowth ?? raw.revenue_growth,
    profitGrowthPct: raw.profitGrowthPct ?? raw.profit_growth_pct ?? raw.netProfitGrowth ?? raw.net_profit_growth,
    roePct: raw.roePct ?? raw.roe_pct ?? raw.roe,
    debtToEquity: raw.debtToEquity ?? raw.debt_to_equity ?? raw.der,
    per: raw.per ?? raw.peRatio ?? raw.pe_ratio,
    pbv: raw.pbv ?? raw.priceToBook ?? raw.price_to_book,
    reportDate: raw.reportDate ?? raw.report_date ?? raw.periodEnd ?? raw.period_end,
    sourceUrl: raw.sourceUrl ?? raw.source_url,
  };
  return Object.values(aliases).some(v => v !== undefined && v !== null && v !== "") ? aliases as FundamentalInput : null;
}

function normalizeCatalysts(stock: UnknownRecord): CatalystInput[] {
  const raw = stock.catalysts ?? stock.events ?? stock.corporateActions ?? stock.corporate_actions;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).map((item) => {
    const x = record(item);
    return {
      title: x.title ?? x.headline ?? x.name,
      type: x.type ?? x.category,
      publishedAt: x.publishedAt ?? x.published_at ?? x.date,
      eventDate: x.eventDate ?? x.event_date ?? x.exDate ?? x.ex_date,
      sourceName: x.sourceName ?? x.source_name ?? x.source,
      sourceUrl: x.sourceUrl ?? x.source_url ?? x.url,
      verified: x.verified === true,
      summary: x.summary ?? x.description,
    };
  });
}


async function notifyNoCandidates(uid: string, summary: { scanned: number; setups: number; watch: number; insufficientData: number; avoid: number }, scannedAt: string) {
  const dateKey = scannedAt.slice(0, 10);
  const notificationRef = db.collection("ai-analytics-notifications").doc(`${uid}_${dateKey}`);
  const shouldSend = await db.runTransaction(async (tx) => {
    const snap = await tx.get(notificationRef);
    if (snap.data()?.status === "sent" || snap.data()?.status === "sending") return false;
    tx.set(notificationRef, { uid, dateKey, status: "sending", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  if (!shouldSend) return { sent: false, reason: "already-notified-today" };

  try {
    const planes = await db.collection("trade-plane").where("uid", "==", uid).where("enabled", "==", true).get();
    const targets = [...new Set(planes.docs.map(d => d.data()).filter(x => x.destination_type === "telegram" && typeof x.destination_target === "string" && x.destination_target.trim()).map(x => String(x.destination_target).trim()))];
    if (!targets.length) {
      await notificationRef.set({ status: "skipped", reason: "no-enabled-telegram-destination", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { sent: false, reason: "no-enabled-telegram-destination" };
    }
    const message = `ℹ️ <b>AI ANALYTICS — BELUM ADA SETUP</b>\n\n` +
      `Scan swing trading selesai, tetapi belum ada saham yang memenuhi kriteria setup awal. Ini bukan error dan bukan berarti tidak ada peluang di seluruh pasar.\n\n` +
      `• Saham dipindai: ${summary.scanned}\n` + `• Setup awal: ${summary.setups}\n` + `• Pantau: ${summary.watch}\n` + `• Data kurang: ${summary.insufficientData}\n` + `• Risiko/invalid: ${summary.avoid}\n\n` +
      `Buka modul AI Analytics untuk melihat alasan penolakan, data yang belum tersedia, dan kandidat watchlist. Skor setup bukan probabilitas profit.`;
    await Promise.all(targets.map(target => sendTelegramMessage(message, target, "HTML")));
    await notificationRef.set({ status: "sent", destinations: targets, sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { sent: true, count: targets.length };
  } catch (error) {
    await notificationRef.set({ status: "failed", error: error instanceof Error ? error.message : String(error), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.error("[AI ANALYTICS] No-candidate Telegram notification failed", error);
    return { sent: false, reason: "telegram-send-failed" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({})) as { symbols?: unknown };
    const requestedSymbols = Array.isArray(body.symbols)
      ? body.symbols.filter((x): x is string => typeof x === "string").map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 100)
      : null;

    const stocksSnapshot = await db.collection("stocks").limit(MAX_UNIVERSE).get();
    let stockDocs = stocksSnapshot.docs;
    if (requestedSymbols?.length) {
      const wanted = new Set(requestedSymbols);
      stockDocs = stockDocs.filter(doc => wanted.has(doc.id.toUpperCase()));
    }

    const analysed = await mapWithConcurrency(stockDocs, CONCURRENCY, async (doc) => {
      const stockData = doc.data() as UnknownRecord;
      try {
        const historySnapshot = await db.collection("stocks").doc(doc.id).collection("history").orderBy("date", "desc").limit(HISTORY_LIMIT).get();
        const candles = historySnapshot.docs.map(d => normalizeCandle(d.data() as UnknownRecord, d.id)).reverse();
        const payload: AnalyticsStock = {
          symbol: doc.id.toUpperCase(),
          name: asText(stockData.name ?? stockData.companyName ?? stockData.company_name),
          candles,
          fundamentals: normalizeFundamentals(stockData),
          catalysts: normalizeCatalysts(stockData),
          specialBoard: asBool(stockData.specialBoard ?? stockData.special_board ?? stockData.papanPemantauanKhusus),
          suspended: asBool(stockData.suspended ?? stockData.isSuspended ?? stockData.is_suspended),
        };
        return analyzeStock(payload);
      } catch (error) {
        console.error("[AI ANALYTICS] Failed to analyze", doc.id, error);
        return analyzeStock({ symbol: doc.id.toUpperCase(), candles: [] });
      }
    });

    const results = analysed.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const setups = results.filter(x => x.status === "setup");
    const watch = results.filter(x => x.status === "watch");
    const insufficient = results.filter(x => x.status === "insufficient-data");
    const avoid = results.filter(x => x.status === "avoid");
    const scannedAt = new Date().toISOString();
    const telegramNotification = setups.length === 0
      ? await notifyNoCandidates(user.uid, { scanned: results.length, setups: setups.length, watch: watch.length, insufficientData: insufficient.length, avoid: avoid.length }, scannedAt)
      : null;
    const response = {
      ok: true,
      scannedAt,
      requestedBy: user.uid,
      universeCount: stockDocs.length,
      limitedUniverse: !requestedSymbols?.length && stocksSnapshot.size >= MAX_UNIVERSE,
      summary: { scanned: results.length, setups: setups.length, watch: watch.length, insufficientData: insufficient.length, avoid: avoid.length },
      noCandidates: setups.length === 0,
      notice: setups.length === 0 ? "Scan selesai, belum ada setup yang memenuhi seluruh kriteria. Ini bukan error. Periksa tab Pantau dan Data Kurang." : null,
      telegramNotification,
      dataCoverage: {
        note: "Harga berasal dari stocks/{symbol}/history. Fundamental/event hanya dibaca jika tersedia pada dokumen stocks dengan field yang dikenali; data yang tidak tersedia tidak direka.",
        fundamentalsAvailable: results.filter(x => x.scoreBreakdown.fundamental !== null).length,
        verifiedCatalystAvailable: results.filter(x => x.scoreBreakdown.catalyst !== null).length,
      },
      results,
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "AUTH_REQUIRED" || message.includes("Firebase ID token")) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED", message: "Login ulang diperlukan untuk menjalankan AI Analytics." }, { status: 401 });
    }
    console.error("[AI ANALYTICS] Scan failed", error);
    return NextResponse.json({ ok: false, error: "SCAN_FAILED", message: "Scan AI Analytics gagal. Periksa konfigurasi Firebase Admin dan struktur koleksi stocks." }, { status: 500 });
  }
}
