export interface KeywordListView {
  id: string;
  name: string;
  keywords: {
    id: string;
    keyword: string;
    volume: number | null;
    difficulty: number | null;
    cpc: number | null;
    intent: string | null;
  }[];
}

/** The list as CSV, one row per keyword. */
export function toCsv(list: KeywordListView): string {
  const cell = (v: string | number | null) => {
    const text = v === null ? "" : String(v);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    "keyword,volume,difficulty,cpc,intent",
    ...list.keywords.map((k) =>
      [k.keyword, k.volume, k.difficulty, k.cpc, k.intent].map(cell).join(","),
    ),
  ].join("\n") + "\n";
}
