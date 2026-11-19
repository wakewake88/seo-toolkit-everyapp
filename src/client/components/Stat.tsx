import type { ReactNode } from "react";
import { Card, CardContent } from "@/client/components/ui/card";

export function Stat({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums" data-testid={testId}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
