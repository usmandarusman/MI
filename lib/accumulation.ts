export const ACCUMULATION_TARGET = 5;
export const ACCUMULATION_RATE_MIN = 20;

type CalculateAccumulationParams = {
  netLots: number;
  shares: number;
  freeFloat: number;
};

/**
 * Menghitung persentase akumulasi terhadap
 * total saham free float.
 *
 * netLots = net buy dalam lot
 * shares  = total shares / CSO
 * freeFloat = free float dalam persen
 */
export function calculateAccumulationPct({
  netLots,
  shares,
  freeFloat,
}: CalculateAccumulationParams) {
  if (
    !Number.isFinite(netLots) ||
    !Number.isFinite(shares) ||
    !Number.isFinite(freeFloat)
  ) {
    return 0;
  }

  if (shares <= 0 || freeFloat <= 0) {
    return 0;
  }

  const freeFloatShares = shares * (freeFloat / 100);

  if (freeFloatShares <= 0) {
    return 0;
  }

  // 1 lot = 100 saham
  const netBuyShares = netLots * 100;

  return Number(
    ((netBuyShares / freeFloatShares) * 100).toFixed(2)
  );
}

/**
 * Mengubah accumulation % menjadi
 * accumulation rate berdasarkan target 5%.
 *
 * 1% accumulation  = 20% rate
 * 2% accumulation  = 40% rate
 * 5% accumulation  = 100% rate
 */
export function calculateAccumulationRate(
  accumulation: number
) {
  if (!Number.isFinite(accumulation)) {
    return 0;
  }

  return Math.min(
    (Math.abs(accumulation) / ACCUMULATION_TARGET) * 100,
    100
  );
}

/**
 * Saham dianggap memenuhi daftar akumulasi
 * apabila:
 *
 * 1. accumulation positif
 * 2. accumulation rate >= 20%
 */
export function isQualifiedAccumulation(
  accumulation: number
) {
  return (
    accumulation > 0 &&
    calculateAccumulationRate(accumulation) >=
      ACCUMULATION_RATE_MIN
  );
}