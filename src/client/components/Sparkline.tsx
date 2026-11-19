/** A small line of monthly values. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-muted-foreground">–</span>;
  const max = Math.max(...values, 1);
  const step = 60 / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(18 - (v / max) * 16).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-16 text-primary" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
