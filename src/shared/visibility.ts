// Share of clicks a result gets at each position, roughly, for positions 1-20.
const CTR = [
  0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018, 0.012, 0.01,
  0.009, 0.008, 0.007, 0.006, 0.005, 0.004, 0.003, 0.002,
];

/**
 * Visibility in percent: the clicks the positions would earn against every
 * keyword at the top, to one decimal.
 */
export function visibilityOf(positions: (number | null)[]): number {
  if (positions.length === 0) return 0;
  const earned = positions.reduce<number>(
    (sum, p) => sum + (p && p <= CTR.length ? CTR[p - 1]! : 0),
    0,
  );
  return Math.round((earned / (positions.length * CTR[0]!)) * 1000) / 10;
}
