import { db } from "@/lib/firebase-admin";
import {
  calculateAccumulationPct,
  calculateAccumulationRate,
  isQualifiedAccumulation,
  ACCUMULATION_RATE_MIN,
} from "@/lib/accumulation";

const AXENTRAZ_BASE_URL = "https://api.axentraz.id";

export type AxentrazSymbol = {
  symbol_id: number;
  symbol: string;

  buy_lot: string | number;
  sell_lot: string | number;

  buy_val: string | number;
  sell_val: string | number;

  net_lot: string | number;
  net_val: string | number;

  active_day: string | number;
  active_buy_day: string | number;
  active_sell_day: string | number;

  peak_buy: string | number;
  peak_sell: string | number;
  avg_net: string | number;

  last_close: string | number;
  change_pct: string | number;
  ma20: string | number;
  dist_ma20: string | number;
};

type SecuritiesDocument = {
  shares?: string | number | null;
  Shares?: string | number | null;

  ownership?: {
    freeFloatPercent?: string | number | null;
    freefloatPercent?: string | number | null;
  } | null;
};

export type AxentrazResult = {
  symbol: string;
  symbol_id: number;

  buy_lot: number;
  sell_lot: number;

  buy_val: number;
  sell_val: number;

  net_lot: number;
  net_val: number;

  active_day: number;
  active_buy_day: number;
  active_sell_day: number;

  peak_buy: number;
  peak_sell: number;
  avg_net: number;

  last_close: number;
  change_pct: number;
  ma20: number;
  dist_ma20: number;

  shares: number;
  free_float: number;

  accumulation: number;
  accumulation_rate: number;
};

export type AxentrazAccumulationResponse = {
  broker_id: number;
  from: string;
  to: string;

  accumulation_target: number;
  minimum_rate: number;

  fetched: number;
  qualified: number;

  skipped_ownership: number;
  skipped_invalid: number;

  data: AxentrazResult[];
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/,/g, "");

    const number = Number(normalized);

    return Number.isFinite(number) ? number : 0;
  }

  return 0;
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object"
  ) {
    const level1 = payload as {
      data?: unknown;
    };

    if (Array.isArray(level1.data)) {
      return level1.data;
    }

    if (
      level1.data &&
      typeof level1.data === "object"
    ) {
      const level2 = level1.data as {
        data?: unknown;
      };

      if (Array.isArray(level2.data)) {
        return level2.data;
      }
    }
  }

  return [];
}

async function fetchAxentrazSymbols(
  brokerId: number,
  from: string,
  to: string
): Promise<AxentrazSymbol[]> {
  const token =
    process.env.AXENTRAZ_TOKEN;

  if (!token) {
    throw new Error(
      "AXENTRAZ_TOKEN belum dikonfigurasi."
    );
  }

  const url =
    `${AXENTRAZ_BASE_URL}` +
    `/broker-activity/${encodeURIComponent(
      brokerId
    )}` +
    `/symbols?from=${from}&to=${to}`;

  console.log(
    "[AXENTRAZ] Request:",
    url
  );

  const response = await fetch(
    url,
    {
      method: "GET",

      headers: {
        Accept:
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      cache: "no-store",
    }
  );

  const rawText =
    await response.text();

  console.log(
    "[AXENTRAZ] HTTP Status:",
    response.status
  );

  if (!response.ok) {
    console.error(
      "[AXENTRAZ] Error response:",
      rawText
    );

    throw new Error(
      `Axentraz HTTP ${response.status}: ${rawText}`
    );
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(rawText);
  } catch {
    throw new Error(
      "Response Axentraz bukan JSON."
    );
  }

  return extractArray(
    parsed
  ) as AxentrazSymbol[];
}

async function getOwnershipMap(
  symbols: string[]
) {
  const uniqueSymbols = [
    ...new Set(symbols),
  ];

  if (
    uniqueSymbols.length === 0
  ) {
    return new Map<
      string,
      {
        shares: number;
        freeFloat: number;
      }
    >();
  }

  const refs =
    uniqueSymbols.map(
      (symbol) =>
        db
          .collection("securities")
          .doc(symbol)
    );

  const snapshots =
    await db.getAll(...refs);

  const ownershipMap =
    new Map<
      string,
      {
        shares: number;
        freeFloat: number;
      }
    >();

  snapshots.forEach(
    (snapshot, index) => {
      if (!snapshot.exists) {
        return;
      }

      const symbol =
        uniqueSymbols[index];

      const doc =
        snapshot.data() as SecuritiesDocument;

      const shares =
        toNumber(
          doc.shares ??
            doc.Shares
        );

      const freeFloat =
        toNumber(
          doc.ownership
            ?.freeFloatPercent ??
            doc.ownership
              ?.freefloatPercent
        );

      if (
        shares <= 0 ||
        freeFloat <= 0
      ) {
        return;
      }

      ownershipMap.set(
        symbol,
        {
          shares,
          freeFloat,
        }
      );
    }
  );

  return ownershipMap;
}

export async function getAxentrazAccumulation(
  {
    brokerId,
    from,
    to,
  }: {
    brokerId: number;
    from: string;
    to: string;
  }
): Promise<AxentrazAccumulationResponse> {
  const rows =
    await fetchAxentrazSymbols(
      brokerId,
      from,
      to
    );

  console.log(
    "[AXENTRAZ] Symbols:",
    rows.length
  );

  const symbols =
    rows
      .map((row) =>
        String(
          row.symbol ?? ""
        )
          .trim()
          .toUpperCase()
      )
      .filter(Boolean);

  const ownershipMap =
    await getOwnershipMap(
      symbols
    );

  const results: AxentrazResult[] =
    [];

  let skippedOwnership = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
    const symbol =
      String(
        row.symbol ?? ""
      )
        .trim()
        .toUpperCase();

    if (!symbol) {
      skippedInvalid++;
      continue;
    }

    const netLots =
      toNumber(
        row.net_lot
      );

    if (
      !Number.isFinite(netLots)
    ) {
      skippedInvalid++;
      continue;
    }

    const ownership =
      ownershipMap.get(
        symbol
      );

    if (!ownership) {
      skippedOwnership++;
      continue;
    }

    const accumulation =
      calculateAccumulationPct({
        netLots,
        shares:
          ownership.shares,
        freeFloat:
          ownership.freeFloat,
      });

    const accumulationRate =
      calculateAccumulationRate(
        accumulation
      );

    if (
      !isQualifiedAccumulation(
        accumulation
      )
    ) {
      continue;
    }

    results.push({
      symbol,

      symbol_id:
        toNumber(
          row.symbol_id
        ),

      buy_lot:
        toNumber(
          row.buy_lot
        ),

      sell_lot:
        toNumber(
          row.sell_lot
        ),

      buy_val:
        toNumber(
          row.buy_val
        ),

      sell_val:
        toNumber(
          row.sell_val
        ),

      net_lot:
        netLots,

      net_val:
        toNumber(
          row.net_val
        ),

      active_day:
        toNumber(
          row.active_day
        ),

      active_buy_day:
        toNumber(
          row.active_buy_day
        ),

      active_sell_day:
        toNumber(
          row.active_sell_day
        ),

      peak_buy:
        toNumber(
          row.peak_buy
        ),

      peak_sell:
        toNumber(
          row.peak_sell
        ),

      avg_net:
        toNumber(
          row.avg_net
        ),

      last_close:
        toNumber(
          row.last_close
        ),

      change_pct:
        toNumber(
          row.change_pct
        ),

      ma20:
        toNumber(
          row.ma20
        ),

      dist_ma20:
        toNumber(
          row.dist_ma20
        ),

      shares:
        ownership.shares,

      free_float:
        ownership.freeFloat,

      accumulation,

      accumulation_rate:
        Number(
          accumulationRate.toFixed(
            2
          )
        ),
    });
  }

  results.sort(
    (a, b) => {
      if (
        b.accumulation_rate !==
        a.accumulation_rate
      ) {
        return (
          b.accumulation_rate -
          a.accumulation_rate
        );
      }

      return (
        b.accumulation -
        a.accumulation
      );
    }
  );

  return {
    broker_id:
      brokerId,

    from,
    to,

    accumulation_target: 5,

    minimum_rate:
      ACCUMULATION_RATE_MIN,

    fetched:
      rows.length,

    qualified:
      results.length,

    skipped_ownership:
      skippedOwnership,

    skipped_invalid:
      skippedInvalid,

    data:
      results,
  };
}