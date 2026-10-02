/* eslint-disable prefer-const */

export type SRHistory = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SRZone = {
  low: number;
  high: number;
  center: number;
  strength: number;
  touches: number;
  rejectionScore: number;
  volumeScore: number;
  recencyScore: number;
  type: "support" | "resistance";
  firstDate: string;
  lastDate: string;
  sourcePoints: number[];
};

export type EntryZone = {
  low: number;
  high: number;
  center: number;
  supportStrength: number;
  distancePercent: number;
  riskReward: number | null;
  support: SRZone;
  resistance: SRZone | null;

  // Optional fields: aman untuk consumer lama, tetapi siap dipakai UI nanti.
  status?: "inside" | "above" | "below";
  stopLoss?: number;
  target?: number | null;
  entryQuality?: number;
};

export type SRAnalysis = {
  currentPrice: number;
  atr: number;
  atrPercent: number;
  supports: SRZone[];
  resistances: SRZone[];
  nearestSupport: SRZone | null;
  nearestResistance: SRZone | null;
  entryZone: EntryZone | null;
};

type Pivot = {
  index: number;
  price: number;
  date: string;
  kind: "low" | "high";
  rejection: number;
  volumeRatio: number;
  prominence: number;
};

type Reaction = {
  rejection: number;
  volumeRatio: number;
  strength: number;
};

type TouchAnalysis = {
  touches: number;
  rejectionScore: number;
  volumeScore: number;
};

const MIN_DATA = 20;
const ATR_PERIOD = 14;
const VOLUME_PERIOD = 20;

function clamp(
  value: number,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value)) return min;

  return Math.min(
    max,
    Math.max(min, value)
  );
}

function safe(
  value: number,
  fallback = 0
): number {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function average(
  values: number[]
): number {
  const valid =
    values.filter(
      Number.isFinite
    );

  return valid.length
    ? valid.reduce(
        (a, b) => a + b,
        0
      ) / valid.length
    : 0;
}

function weightedAverage(
  values: Array<{
    value: number;
    weight: number;
  }>
): number {
  const valid =
    values.filter(
      (x) =>
        Number.isFinite(
          x.value
        ) &&
        Number.isFinite(
          x.weight
        ) &&
        x.weight > 0
    );

  if (!valid.length) return 0;

  const weight =
    valid.reduce(
      (sum, x) =>
        sum + x.weight,
      0
    );

  return valid.reduce(
    (sum, x) =>
      sum +
      x.value *
        x.weight,
    0
  ) / weight;
}

function normalizeDate(
  value: string
): string {
  const v =
    String(
      value ?? ""
    ).trim();

  if (
    /^\d{8}$/.test(v)
  ) {
    return (
      `${v.slice(0, 4)}-` +
      `${v.slice(4, 6)}-` +
      `${v.slice(6, 8)}`
    );
  }

  return v;
}

function cleanData(
  input: SRHistory[]
): SRHistory[] {
  const map =
    new Map<
      string,
      SRHistory
    >();

  for (
    const raw of input
  ) {
    const date =
      normalizeDate(
        raw.date
      );

    const open =
      safe(
        Number(
          raw.open
        )
      );

    const high =
      safe(
        Number(
          raw.high
        )
      );

    const low =
      safe(
        Number(
          raw.low
        )
      );

    const close =
      safe(
        Number(
          raw.close
        )
      );

    const volume =
      Math.max(
        0,
        safe(
          Number(
            raw.volume
          )
        )
      );

    if (
      !date ||
      ![
        open,
        high,
        low,
        close,
      ].every(
        Number.isFinite
      )
    ) {
      continue;
    }

    if (
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0
    ) {
      continue;
    }

    if (
      high < low ||
      high < open ||
      high < close ||
      low > open ||
      low > close
    ) {
      continue;
    }

    map.set(
      date,
      {
        date,
        open,
        high,
        low,
        close,
        volume,
      }
    );
  }

  return [
    ...map.values(),
  ].sort(
    (a, b) =>
      a.date.localeCompare(
        b.date
      )
  );
}

function priceDistancePercent(
  price: number,
  level: number
): number {
  if (
    price <= 0 ||
    !Number.isFinite(
      price
    ) ||
    !Number.isFinite(
      level
    )
  ) {
    return 100;
  }

  return (
    (Math.abs(
      level - price
    ) /
      price) *
    100
  );
}

function trueRange(
  current: SRHistory,
  previous?: SRHistory
): number {
  const range =
    current.high -
    current.low;

  if (!previous) {
    return Math.max(
      0,
      range
    );
  }

  return Math.max(
    range,
    Math.abs(
      current.high -
        previous.close
    ),
    Math.abs(
      current.low -
        previous.close
    )
  );
}

/**
 * Wilder/RMA ATR.
 * Lebih stabil daripada SMA ATR ketika volatilitas berubah cepat.
 */
function calculateATR(
  data: SRHistory[],
  period = ATR_PERIOD
): number {
  if (!data.length) return 0;

  const tr =
    data.map(
      (item, i) =>
        trueRange(
          item,
          data[i - 1]
        )
    );

  const seed =
    average(
      tr.slice(
        0,
        Math.min(
          period,
          tr.length
        )
      )
    );

  if (!seed) return 0;

  let atr = seed;

  const start =
    Math.min(
      period,
      tr.length
    );

  for (
    let i = start;
    i < tr.length;
    i++
  ) {
    atr =
      (atr *
        (period - 1) +
        tr[i]) /
      period;
  }

  return atr;
}

function averageVolume(
  data: SRHistory[],
  index: number,
  period = VOLUME_PERIOD
): number {
  const start =
    Math.max(
      0,
      index - period
    );

  return average(
    data
      .slice(
        start,
        index
      )
      .map((x) =>
        Math.max(
          0,
          x.volume
        )
      )
      .filter(
        (x) => x > 0
      )
  );
}

function volumeRatio(
  data: SRHistory[],
  index: number
): number {
  if (
    index < 0 ||
    index >= data.length
  ) {
    return 1;
  }

  const current =
    Math.max(
      0,
      data[index]
        .volume
    );

  const avg =
    averageVolume(
      data,
      index
    );

  if (
    !current ||
    !avg
  ) {
    return 1;
  }

  return clamp(
    current / avg,
    0.25,
    6
  );
}

function volumeScore(
  ratio: number
): number {
  if (
    !Number.isFinite(
      ratio
    )
  ) {
    return 45;
  }

  if (ratio >= 3)
    return 100;

  if (ratio >= 2) {
    return (
      82 +
      (ratio - 2) *
        18
    );
  }

  if (ratio >= 1) {
    return (
      52 +
      (ratio - 1) *
        30
    );
  }

  return clamp(
    52 -
      (1 - ratio) *
        30,
    15,
    52
  );
}

function rejectionScore(
  candle: SRHistory,
  kind: "low" | "high"
): number {
  const range =
    candle.high -
    candle.low;

  if (range <= 0)
    return 0;

  const body =
    Math.abs(
      candle.close -
        candle.open
    );

  const upperWick =
    Math.max(
      0,
      candle.high -
        Math.max(
          candle.open,
          candle.close
        )
    );

  const lowerWick =
    Math.max(
      0,
      Math.min(
        candle.open,
        candle.close
      ) -
        candle.low
    );

  const bodyRatio =
    clamp(
      body / range,
      0,
      1
    );

  if (kind === "low") {
    const wick =
      lowerWick / range;

    const close =
      clamp(
        (candle.close -
          candle.low) /
          range,
        0,
        1
      );

    return clamp(
      wick * 58 +
        close * 32 +
        bodyRatio * 10,
      0,
      100
    );
  }

  const wick =
    upperWick / range;

  const close =
    clamp(
      (candle.high -
        candle.close) /
        range,
      0,
      1
    );

  return clamp(
    wick * 58 +
      close * 32 +
      bodyRatio * 10,
    0,
    100
  );
}

function adaptiveRadius(
  length: number
): number {
  if (length >= 250)
    return 6;

  if (length >= 180)
    return 5;

  if (length >= 100)
    return 4;

  if (length >= 50)
    return 3;

  return 2;
}

function localRange(
  data: SRHistory[],
  index: number,
  radius: number
): number {
  const start =
    Math.max(
      0,
      index - radius
    );

  const end =
    Math.min(
      data.length,
      index +
        radius +
        1
    );

  return average(
    data
      .slice(
        start,
        end
      )
      .map(
        (x) =>
          x.high -
          x.low
      )
      .filter(
        (x) => x > 0
      )
  );
}

function pivotProminence(
  data: SRHistory[],
  index: number,
  kind: "low" | "high",
  radius: number,
  atr: number
): number {
  const candle =
    data[index];

  const surrounding = [
    ...data.slice(
      Math.max(
        0,
        index - radius
      ),
      index
    ),
    ...data.slice(
      index + 1,
      Math.min(
        data.length,
        index +
          radius +
          1
      )
    ),
  ];

  if (
    !surrounding.length
  ) {
    return 20;
  }

  const reference =
    kind === "low"
      ? Math.max(
          ...surrounding.map(
            (x) =>
              x.high
          )
        ) -
        candle.low
      : candle.high -
        Math.min(
          ...surrounding.map(
            (x) =>
              x.low
          )
        );

  return clamp(
    (reference /
      Math.max(
        atr,
        candle.close *
          0.003,
        0.01
      )) *
      12,
    10,
    100
  );
}

function findPivots(
  data: SRHistory[],
  atr: number
): Pivot[] {
  const result: Pivot[] =
    [];

  if (
    data.length <
    MIN_DATA
  ) {
    return result;
  }

  const radius =
    adaptiveRadius(
      data.length
    );

  for (
    let i = radius;
    i <
    data.length -
      radius;
    i++
  ) {
    const candle =
      data[i];

    let isLow = true;
    let isHigh = true;

    for (
      let j =
        i - radius;
      j <=
      i + radius;
      j++
    ) {
      if (j === i)
        continue;

      if (
        data[j].low <
        candle.low
      ) {
        isLow = false;
      }

      if (
        data[j].high >
        candle.high
      ) {
        isHigh = false;
      }

      if (
        !isLow &&
        !isHigh
      ) {
        break;
      }
    }

    const vr =
      volumeRatio(
        data,
        i
      );

    const range =
      localRange(
        data,
        i,
        radius
      );

    const significant =
      Math.max(
        atr * 0.18,
        range * 0.5,
        candle.close *
          0.0015
      );

    if (isLow) {
      const prominence =
        pivotProminence(
          data,
          i,
          "low",
          radius,
          atr
        );

      const previous =
        data
          .slice(
            Math.max(
              0,
              i - radius
            ),
            i
          )
          .map(
            (x) =>
              x.low
          );

      const newLow =
        previous.length
          ? candle.low <=
            Math.min(
              ...previous
            ) -
              significant
          : false;

      if (
        prominence >=
          18 ||
        newLow
      ) {
        result.push({
          index: i,
          price:
            candle.low,
          date:
            candle.date,
          kind: "low",
          rejection:
            rejectionScore(
              candle,
              "low"
            ),
          volumeRatio:
            vr,
          prominence,
        });
      }
    }

    if (isHigh) {
      const prominence =
        pivotProminence(
          data,
          i,
          "high",
          radius,
          atr
        );

      const previous =
        data
          .slice(
            Math.max(
              0,
              i - radius
            ),
            i
          )
          .map(
            (x) =>
              x.high
          );

      const newHigh =
        previous.length
          ? candle.high >=
            Math.max(
              ...previous
            ) +
              significant
          : false;

      if (
        prominence >=
          18 ||
        newHigh
      ) {
        result.push({
          index: i,
          price:
            candle.high,
          date:
            candle.date,
          kind: "high",
          rejection:
            rejectionScore(
              candle,
              "high"
            ),
          volumeRatio:
            vr,
          prominence,
        });
      }
    }
  }

  return result;
}

/**
 * Fallback penting untuk data pendek / saham baru turun tajam.
 *
 * Kalau pivot klasik belum punya support di bawah harga,
 * recent swing low tetap boleh menjadi kandidat,
 * tetapi strength-nya sengaja dibatasi.
 */
function addRecentExtremes(
  data: SRHistory[],
  pivots: Pivot[],
  atr: number
): Pivot[] {
  const result = [
    ...pivots,
  ];

  const lookback =
    Math.min(
      data.length,
      data.length >= 60
        ? 30
        : 18
    );

  const start =
    Math.max(
      0,
      data.length -
        lookback
    );

  const recent =
    data.slice(start);

  if (!recent.length)
    return result;

  const lowIndexLocal =
    recent.reduce(
      (
        best,
        item,
        i
      ) =>
        item.low <
        recent[best].low
          ? i
          : best,
      0
    );

  const highIndexLocal =
    recent.reduce(
      (
        best,
        item,
        i
      ) =>
        item.high >
        recent[best].high
          ? i
          : best,
      0
    );

  const lowIndex =
    start +
    lowIndexLocal;

  const highIndex =
    start +
    highIndexLocal;

  const add = (
    index: number,
    kind:
      | "low"
      | "high"
  ) => {
    if (
      index < 0 ||
      index >=
        data.length
    ) {
      return;
    }

    if (
      result.some(
        (p) =>
          p.index ===
            index &&
          p.kind ===
            kind
      )
    ) {
      return;
    }

    const candle =
      data[index];

    const price =
      kind === "low"
        ? candle.low
        : candle.high;

    const prom =
      pivotProminence(
        data,
        index,
        kind,
        Math.min(
          3,
          adaptiveRadius(
            data.length
          )
        ),
        atr
      );

    result.push({
      index,
      price,
      date:
        candle.date,
      kind,
      rejection:
        rejectionScore(
          candle,
          kind
        ),
      volumeRatio:
        volumeRatio(
          data,
          index
        ),
      prominence:
        clamp(
          prom * 0.72,
          12,
          72
        ),
    });
  };

  add(
    lowIndex,
    "low"
  );

  add(
    highIndex,
    "high"
  );

  return result;
}

function analyzeReaction(
  data: SRHistory[],
  pivot: Pivot,
  atr: number,
  type:
    | "support"
    | "resistance"
): Reaction {
  const end =
    Math.min(
      data.length,
      pivot.index + 8
    );

  if (
    pivot.index + 1 >=
    end
  ) {
    return {
      rejection:
        pivot.rejection,
      volumeRatio:
        pivot.volumeRatio,
      strength:
        pivot.rejection,
    };
  }

  let bestMove = 0;
  let bestVolume =
    pivot.volumeRatio;

  for (
    let i =
      pivot.index + 1;
    i < end;
    i++
  ) {
    const candle =
      data[i];

    const move =
      type === "support"
        ? (candle.high -
            pivot.price) /
          Math.max(
            atr,
            pivot.price *
              0.001,
            0.01
          )
        : (pivot.price -
            candle.low) /
          Math.max(
            atr,
            pivot.price *
              0.001,
            0.01
          );

    bestMove =
      Math.max(
        bestMove,
        move
      );

    bestVolume =
      Math.max(
        bestVolume,
        volumeRatio(
          data,
          i
        )
      );
  }

  const moveScore =
    clamp(
      bestMove * 18,
      0,
      100
    );

  const volScore =
    volumeScore(
      bestVolume
    );

  const strength =
    clamp(
      pivot.rejection *
        0.30 +
        moveScore *
          0.30 +
        volScore *
          0.20 +
        pivot.prominence *
          0.20,
      0,
      100
    );

  return {
    rejection:
      pivot.rejection,
    volumeRatio:
      bestVolume,
    strength,
  };
}

function clusterTolerance(
  center: number,
  atr: number
): number {
  return Math.max(
    atr * 0.55,
    Math.abs(center) *
      0.009,
    0.5
  );
}

function levelsClose(
  a: number,
  b: number,
  atr: number
): boolean {
  return (
    Math.abs(a - b) <=
    clusterTolerance(
      (a + b) / 2,
      atr
    )
  );
}

function findZoneTouches(
  data: SRHistory[],
  center: number,
  atr: number,
  type:
    | "support"
    | "resistance"
): TouchAnalysis {
  const tolerance =
    Math.max(
      atr * 0.32,
      center * 0.006,
      0.5
    );

  const gap =
    data.length >= 100
      ? 3
      : 2;

  const rejections: number[] =
    [];

  const volumes: number[] =
    [];

  let lastTouch =
    -Infinity;

  for (
    let i = 0;
    i < data.length;
    i++
  ) {
    const c = data[i];

    const touched =
      type === "support"
        ? c.low <=
            center +
              tolerance &&
          c.high >=
            center -
              tolerance
        : c.high >=
            center -
              tolerance &&
          c.low <=
            center +
              tolerance;

    if (!touched)
      continue;

    const edge =
      type === "support"
        ? c.low
        : c.high;

    if (
      Math.abs(
        edge - center
      ) >
      tolerance * 1.4
    ) {
      continue;
    }

    if (
      i - lastTouch <
      gap
    ) {
      continue;
    }

    lastTouch = i;

    rejections.push(
      rejectionScore(
        c,
        type ===
          "support"
          ? "low"
          : "high"
      )
    );

    volumes.push(
      volumeScore(
        volumeRatio(
          data,
          i
        )
      )
    );
  }

  return {
    touches:
      rejections.length,
    rejectionScore:
      average(
        rejections
      ),
    volumeScore:
      average(
        volumes
      ),
  };
}

function clusterPivots(
  pivots: Pivot[],
  data: SRHistory[],
  atr: number,
  type:
    | "support"
    | "resistance"
): SRZone[] {
  const relevant =
    pivots
      .filter(
        (p) =>
          type ===
          "support"
            ? p.kind ===
              "low"
            : p.kind ===
              "high"
      )
      .sort(
        (a, b) =>
          a.price -
          b.price
      );

  const clusters: Pivot[][] =
    [];

  for (
    const pivot of relevant
  ) {
    let target:
      | Pivot[]
      | null = null;

    let bestDistance =
      Infinity;

    for (
      const cluster of clusters
    ) {
      const center =
        weightedAverage(
          cluster.map(
            (p) => ({
              value:
                p.price,
              weight:
                1 +
                p.prominence /
                  100,
            })
          )
        );

      if (
        !levelsClose(
          pivot.price,
          center,
          atr
        )
      ) {
        continue;
      }

      const distance =
        Math.abs(
          pivot.price -
            center
        );

      if (
        distance <
        bestDistance
      ) {
        bestDistance =
          distance;

        target =
          cluster;
      }
    }

    if (target) {
      target.push(
        pivot
      );
    } else {
      clusters.push([
        pivot,
      ]);
    }
  }

  return clusters.map(
    (cluster) => {
      const prices =
        cluster.map(
          (p) =>
            p.price
        );

      const center =
        weightedAverage(
          cluster.map(
            (p) => ({
              value:
                p.price,
              weight:
                1 +
                p.prominence /
                  100,
            })
          )
        );

      const firstIndex =
        Math.min(
          ...cluster.map(
            (p) =>
              p.index
          )
        );

      const lastIndex =
        Math.max(
          ...cluster.map(
            (p) =>
              p.index
          )
        );

      const reactions =
        cluster.map(
          (p) =>
            analyzeReaction(
              data,
              p,
              atr,
              type
            )
        );

      const candle =
        findZoneTouches(
          data,
          center,
          atr,
          type
        );

      const touches =
        Math.min(
          20,
          Math.max(
            cluster.length,
            Math.min(
              candle.touches,
              8
            )
          )
        );

      const touchScore =
        clamp(
          24 +
            Math.min(
              touches,
              7
            ) *
              10.5,
          24,
          100
        );

      const pivotRejection =
        weightedAverage(
          cluster.map(
            (p, i) => ({
              value:
                reactions[i]
                  ?.rejection ??
                p.rejection,
              weight:
                1 +
                p.prominence /
                  100,
            })
          )
        );

      const rejection =
        clamp(
          weightedAverage([
            {
              value:
                pivotRejection,
              weight:
                0.65,
            },
            {
              value:
                candle.rejectionScore,
              weight:
                0.35,
            },
          ]),
          0,
          100
        );

      const pivotVolume =
        average(
          reactions.map(
            (r) =>
              volumeScore(
                r.volumeRatio
              )
          )
        );

      const volume =
        clamp(
          weightedAverage([
            {
              value:
                pivotVolume,
              weight:
                0.60,
            },
            {
              value:
                candle.volumeScore ||
                45,
              weight:
                0.40,
            },
          ]),
          10,
          100
        );

      const age =
        Math.max(
          data.length -
            1 -
            lastIndex,
          0
        );

      const halfLife =
        Math.max(
          20,
          Math.min(
            60,
            data.length *
              0.22
          )
        );

      const recency =
        clamp(
          20 +
            80 *
              Math.exp(
                -age /
                  halfLife
              ),
          20,
          100
        );

      const prominence =
        average(
          cluster.map(
            (p) =>
              p.prominence
          )
        );

      const reactionStrength =
        average(
          reactions.map(
            (r) =>
              r.strength
          )
        );

      const strength =
        Math.round(
          clamp(
            touchScore *
              0.28 +
              reactionStrength *
                0.22 +
              rejection *
                0.15 +
              volume *
                0.15 +
              recency *
                0.12 +
              prominence *
                0.08,
            0,
            100
          )
        );

      const halfWidth =
        Math.max(
          atr * 0.18,
          center * 0.0025,
          0.5
        );

      const low =
        Math.max(
          0,
          Math.min(
            Math.min(
              ...prices
            ),
            center -
              halfWidth
          )
        );

      const high =
        Math.max(
          Math.max(
            ...prices
          ),
          center +
            halfWidth
        );

      const dates =
        cluster
          .map(
            (p) =>
              p.date
          )
          .sort(
            (a, b) =>
              a.localeCompare(
                b
              )
          );

      return {
        low,
        high,
        center,
        strength,
        touches,
        rejectionScore:
          Math.round(
            rejection
          ),
        volumeScore:
          Math.round(
            volume
          ),
        recencyScore:
          Math.round(
            recency
          ),
        type,
        firstDate:
          dates[0] ??
          data[firstIndex]
            .date,
        lastDate:
          dates[
            dates.length - 1
          ] ??
          data[lastIndex]
            .date,
        sourcePoints:
          prices,
      };
    }
  );
}

function mergeZones(
  zones: SRZone[],
  atr: number
): SRZone[] {
  const sorted =
    [...zones].sort(
      (a, b) =>
        a.center -
        b.center
    );

  const result: SRZone[] =
    [];

  for (
    const zone of sorted
  ) {
    const prev =
      result[
        result.length - 1
      ];

    if (
      !prev ||
      !(
        zone.low <=
          prev.high ||
        levelsClose(
          zone.center,
          prev.center,
          atr * 0.8
        )
      )
    ) {
      result.push({
        ...zone,
      });

      continue;
    }

    const touchWeightA =
      Math.max(
        prev.touches,
        1
      );

    const touchWeightB =
      Math.max(
        zone.touches,
        1
      );

    const mergedCenter =
      weightedAverage([
        {
          value:
            prev.center,
          weight:
            touchWeightA,
        },
        {
          value:
            zone.center,
          weight:
            touchWeightB,
        },
      ]);

    const synergy =
      Math.min(
        8,
        Math.min(
          prev.touches,
          zone.touches
        ) * 1.5
      );

    result[
      result.length - 1
    ] = {
      ...prev,

      low: Math.min(
        prev.low,
        zone.low
      ),

      high: Math.max(
        prev.high,
        zone.high
      ),

      center:
        mergedCenter,

      strength:
        Math.round(
          clamp(
            Math.max(
              prev.strength,
              zone.strength
            ) +
              synergy,
            0,
            100
          )
        ),

      touches:
        Math.min(
          20,
          prev.touches +
            zone.touches
        ),

      rejectionScore:
        Math.round(
          weightedAverage([
            {
              value:
                prev.rejectionScore,
              weight:
                touchWeightA,
            },
            {
              value:
                zone.rejectionScore,
              weight:
                touchWeightB,
            },
          ])
        ),

      volumeScore:
        Math.round(
          weightedAverage([
            {
              value:
                prev.volumeScore,
              weight:
                touchWeightA,
            },
            {
              value:
                zone.volumeScore,
              weight:
                touchWeightB,
            },
          ])
        ),

      recencyScore:
        Math.max(
          prev.recencyScore,
          zone.recencyScore
        ),

      firstDate:
        prev.firstDate <
        zone.firstDate
          ? prev.firstDate
          : zone.firstDate,

      lastDate:
        prev.lastDate >
        zone.lastDate
          ? prev.lastDate
          : zone.lastDate,

      sourcePoints: [
        ...prev.sourcePoints,
        ...zone.sourcePoints,
      ],
    };
  }

  return result;
}

function distanceScore(
  price: number,
  zone: SRZone,
  atr: number
): number {
  const normalized =
    Math.abs(
      price -
        zone.center
    ) /
    Math.max(
      atr,
      price * 0.001,
      0.01
    );

  return clamp(
    100 -
      normalized * 16,
    25,
    100
  );
}

function zoneScore(
  zone: SRZone,
  price: number,
  atr: number
): number {
  // Strength historis tetap dominan, jarak menjadi faktor aktif.
  return (
    zone.strength *
      0.72 +
    distanceScore(
      price,
      zone,
      atr
    ) *
      0.28
  );
}

function selectSupport(
  zones: SRZone[],
  price: number,
  atr: number
): SRZone | null {
  const candidates =
    zones.filter(
      (z) =>
        z.center <=
          price ||
        (z.low <=
          price &&
          price <=
            z.high)
    );

  if (
    !candidates.length
  ) {
    return null;
  }

  return [
    ...candidates,
  ].sort(
    (a, b) => {
      const aInside =
        price >=
          a.low &&
        price <=
          a.high;

      const bInside =
        price >=
          b.low &&
        price <=
          b.high;

      if (
        aInside !==
        bInside
      ) {
        return aInside
          ? -1
          : 1;
      }

      const scoreA =
        zoneScore(
          a,
          price,
          atr
        );

      const scoreB =
        zoneScore(
          b,
          price,
          atr
        );

      if (
        Math.abs(
          scoreA -
            scoreB
        ) < 3
      ) {
        // Untuk support, jangan memilih support jauh hanya karena historical strength.
        const distA =
          Math.max(
            price -
              a.high,
            0
          );

        const distB =
          Math.max(
            price -
              b.high,
            0
          );

        return (
          distA -
          distB
        );
      }

      return (
        scoreB -
        scoreA
      );
    }
  )[0] ?? null;
}

function selectResistance(
  zones: SRZone[],
  price: number,
  atr: number
): SRZone | null {
  const candidates =
    zones.filter(
      (z) =>
        z.center >
        price
    );

  if (
    !candidates.length
  ) {
    return null;
  }

  return [
    ...candidates,
  ].sort(
    (a, b) => {
      const gapA =
        Math.max(
          a.low -
            price,
          0
        );

      const gapB =
        Math.max(
          b.low -
            price,
          0
        );

      const penaltyA =
        clamp(
          (gapA /
            Math.max(
              atr,
              0.01
            )) *
            2.5,
          0,
          20
        );

      const penaltyB =
        clamp(
          (gapB /
            Math.max(
              atr,
              0.01
            )) *
            2.5,
          0,
          20
        );

      return (
        zoneScore(
          b,
          price,
          atr
        ) -
        penaltyB -
        (zoneScore(
          a,
          price,
          atr
        ) -
          penaltyA)
      );
    }
  )[0] ?? null;
}

function nextResistance(
  zones: SRZone[],
  currentPrice: number,
  afterPrice: number
): SRZone | null {
  const candidates =
    zones.filter(
      (z) =>
        z.low >
          afterPrice &&
        z.center >
          currentPrice
    );

  if (
    !candidates.length
  ) {
    return null;
  }

  return [
    ...candidates,
  ].sort(
    (a, b) => {
      const da =
        a.low -
        afterPrice;

      const db =
        b.low -
        afterPrice;

      const tolerance =
        Math.max(
          1,
          currentPrice *
            0.005
        );

      if (
        Math.abs(
          da - db
        ) <=
        tolerance
      ) {
        return (
          b.strength -
          a.strength
        );
      }

      return da - db;
    }
  )[0] ?? null;
}

function buildEntryZone(
  support: SRZone,
  resistance: SRZone | null,
  currentPrice: number,
  atr: number
): EntryZone | null {
  if (
    support.low <= 0 ||
    support.high <= 0 ||
    currentPrice <= 0 ||
    atr <= 0
  ) {
    return null;
  }

  const distanceAboveSupport =
    Math.max(
      currentPrice -
        support.high,
      0
    );

  const maxEntryDistance =
    Math.max(
      atr * 1.35,
      currentPrice *
        0.03
    );

  if (
    distanceAboveSupport >
    maxEntryDistance
  ) {
    return null;
  }

  const padding =
    Math.max(
      atr * 0.12,
      currentPrice *
        0.0015,
      0.5
    );

  const maxWidth =
    Math.max(
      atr * 0.75,
      currentPrice *
        0.012
    );

  let low =
    support.low;

  let high =
    support.high +
    padding;

  if (
    high - low >
    maxWidth
  ) {
    high =
      low +
      maxWidth;
  }

  // Hindari entry zone menembus resistance terdekat.
  if (
    resistance &&
    resistance.low >
      low &&
    resistance.low <
      high
  ) {
    high =
      Math.max(
        low,
        resistance.low -
          Math.max(
            atr * 0.08,
            currentPrice *
              0.001
          )
      );
  }

  if (
    high <= low
  ) {
    return null;
  }

  const center =
    (low + high) /
    2;

  const stopLoss =
    Math.max(
      0,
      support.low -
        Math.max(
          atr * 0.18,
          currentPrice *
            0.003
        )
    );

  const target =
    resistance &&
    resistance.low >
      center
      ? resistance.low
      : null;

  const risk =
    center -
    stopLoss;

  const reward =
    target !== null
      ? target -
        center
      : 0;

  const rr =
    risk > 0 &&
    reward > 0
      ? reward / risk
      : null;

  const status: EntryZone["status"] =
    currentPrice < low
      ? "below"
      : currentPrice > high
        ? "above"
        : "inside";

  // Quality bukan sinyal beli; hanya kualitas teknikal zona.
  const proximity =
    clamp(
      100 -
        (distanceAboveSupport /
          Math.max(
            atr,
            0.01
          )) *
          35,
      35,
      100
    );

  const rrScore =
    rr === null
      ? 45
      : clamp(
          40 +
            Math.min(
              rr,
              4
            ) *
              15,
          40,
          100
        );

  const entryQuality =
    Math.round(
      clamp(
        support.strength *
          0.55 +
          proximity *
            0.25 +
          rrScore *
            0.20,
        0,
        100
      )
    );

  return {
    low,
    high,
    center,
    supportStrength:
      support.strength,
    distancePercent:
      priceDistancePercent(
        currentPrice,
        support.center
      ),
    riskReward: rr,
    support,
    resistance,
    status,
    stopLoss,
    target,
    entryQuality,
  };
}

function filterUsefulZones(
  zones: SRZone[],
  currentPrice: number,
  atr: number,
  type:
    | "support"
    | "resistance"
): SRZone[] {
  const maxDistance =
    Math.max(
      atr * 8,
      currentPrice *
        0.25
    );

  return zones
    .filter(
      (zone) => {
        if (
          Math.abs(
            zone.center -
              currentPrice
          ) >
          maxDistance
        ) {
          return false;
        }

        if (
          zone.strength <
          24
        ) {
          return false;
        }

        if (
          type ===
            "support" &&
          zone.low >
            currentPrice +
              atr * 0.35
        ) {
          return false;
        }

        if (
          type ===
            "resistance" &&
          zone.high <
            currentPrice -
              atr * 0.35
        ) {
          return false;
        }

        return true;
      }
    )
    .sort(
      (a, b) =>
        zoneScore(
          b,
          currentPrice,
          atr
        ) -
        zoneScore(
          a,
          currentPrice,
          atr
        )
    )
    .slice(0, 12);
}

function sortByRelevance(
  zones: SRZone[],
  price: number,
  atr: number
): SRZone[] {
  return [
    ...zones,
  ].sort(
    (a, b) =>
      zoneScore(
        b,
        price,
        atr
      ) -
      zoneScore(
        a,
        price,
        atr
      )
  );
}

export function analyzeSupportResistance(
  input: SRHistory[]
): SRAnalysis | null {
  const data =
    cleanData(input);

  if (
    data.length <
    MIN_DATA
  ) {
    return null;
  }

  const current =
    data[
      data.length - 1
    ];

  const currentPrice =
    current.close;

  if (
    !currentPrice ||
    !Number.isFinite(
      currentPrice
    )
  ) {
    return null;
  }

  const atr =
    calculateATR(
      data,
      ATR_PERIOD
    );

  if (
    !atr ||
    !Number.isFinite(
      atr
    )
  ) {
    return null;
  }

  const atrPercent =
    (atr /
      currentPrice) *
    100;

  // 1. Pivot klasik + fallback recent extreme.
  const pivots =
    addRecentExtremes(
      data,
      findPivots(
        data,
        atr
      ),
      atr
    );

  if (!pivots.length) {
    return {
      currentPrice,
      atr,
      atrPercent,
      supports: [],
      resistances: [],
      nearestSupport:
        null,
      nearestResistance:
        null,
      entryZone: null,
    };
  }

  // 2. Cluster level-level yang berdekatan menjadi zone.
  const rawSupports =
    clusterPivots(
      pivots,
      data,
      atr,
      "support"
    );

  const rawResistances =
    clusterPivots(
      pivots,
      data,
      atr,
      "resistance"
    );

  // 3. Merge zone overlap.
  const supports =
    mergeZones(
      rawSupports,
      atr
    );

  const resistances =
    mergeZones(
      rawResistances,
      atr
    );

  // 4. Filter noise tetapi jangan terlalu agresif pada data pendek.
  const filteredSupports =
    filterUsefulZones(
      supports,
      currentPrice,
      atr,
      "support"
    );

  const filteredResistances =
    filterUsefulZones(
      resistances,
      currentPrice,
      atr,
      "resistance"
    );

  // 5. Pilih support aktif + resistance target.
  const nearestSupport =
    selectSupport(
      filteredSupports,
      currentPrice,
      atr
    );

  const nearestResistance =
    selectResistance(
      filteredResistances,
      currentPrice,
      atr
    );

  let entryZone:
    | EntryZone
    | null = null;

  if (
    nearestSupport
  ) {
    entryZone =
      buildEntryZone(
        nearestSupport,
        nearestResistance,
        currentPrice,
        atr
      );
  }

  // 6. Kalau target pertama terlalu dekat,
  // cari resistance berikutnya.
  //
  // Gunakan entryZone.support agar tidak pernah
  // mengirim SRZone | null.
  if (
    entryZone?.resistance
  ) {
    const targetDistance =
      entryZone
        .resistance
        .low -
      entryZone.center;

    if (
      targetDistance <=
      atr * 0.35
    ) {
      const next =
        nextResistance(
          filteredResistances,
          currentPrice,
          entryZone.center
        );

      entryZone =
        buildEntryZone(
          entryZone.support,
          next,
          currentPrice,
          atr
        );
    }
  }

  return {
    currentPrice,
    atr,
    atrPercent,
    supports:
      sortByRelevance(
        filteredSupports,
        currentPrice,
        atr
      ),
    resistances:
      sortByRelevance(
        filteredResistances,
        currentPrice,
        atr
      ),
    nearestSupport,
    nearestResistance,
    entryZone,
  };
}