import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";

/** Lines over time: one per series, labelled by name. */
export function TrendChart({
  points,
  series,
  unit,
  max,
  testId,
}: {
  points: Record<string, string | number>[];
  series: { key: string; label: string }[];
  unit?: string;
  max?: number;
  testId?: string;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: `var(--chart-${(i % 5) + 1})` }]),
  );
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full" data-testid={testId}>
      <LineChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          domain={[0, max ?? "auto"]}
          tickFormatter={(v: number) => `${v}${unit ?? ""}`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot={points.length < 20}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
