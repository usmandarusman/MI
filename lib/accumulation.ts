export function calculateAccumulationPct({
  netLots,
  shares,
  freeFloat,
}: {
  netLots: number;
  shares: number;
  freeFloat: number;
}) {
  const freeFloatShares = shares * (freeFloat / 100);

  if (freeFloatShares <= 0) return 0;

  const netBuyShares = netLots * 100;

  return Number(((netBuyShares / freeFloatShares) * 100).toFixed(2));
}