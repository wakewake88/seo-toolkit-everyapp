const whole = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function count(value: number | null | undefined): string {
  return value == null ? "–" : whole.format(Math.round(value));
}

export function money(value: number | null | undefined): string {
  return value == null ? "–" : dollars.format(value);
}

export function when(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** A server error as one sentence: a validation error's first message, or the message. */
export function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "");
  try {
    const parsed = JSON.parse(text) as { message?: string }[];
    if (Array.isArray(parsed) && parsed[0]?.message) return parsed[0].message;
  } catch {
    // Not a validation error.
  }
  return text || "Something went wrong";
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
