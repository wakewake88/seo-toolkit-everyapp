import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";

/** A labelled select over a short list of choices. */
export function Choice<T extends string | number>({
  id,
  label,
  value,
  onChange,
  items,
  className,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: readonly { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={[...items]}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next as T);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={String(item.value)} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
