import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";

/** Up to four competitor domains. */
export function CompetitorFields({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {values.map((value, i) => (
        <div key={i} className="space-y-1.5">
          <Label htmlFor={`competitor-${i}`}>Competitor {i + 1}</Label>
          <Input
            id={`competitor-${i}`}
            value={value}
            placeholder="competitor.com"
            onChange={(e) => onChange(values.map((v, j) => (j === i ? e.target.value : v)))}
          />
        </div>
      ))}
    </div>
  );
}
