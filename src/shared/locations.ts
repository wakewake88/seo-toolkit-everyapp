/** Search locations and languages, as the search-data API codes them. */
export const LOCATIONS = [
  { code: 2840, name: "United States" },
  { code: 2826, name: "United Kingdom" },
  { code: 2124, name: "Canada" },
  { code: 2036, name: "Australia" },
  { code: 2372, name: "Ireland" },
  { code: 2554, name: "New Zealand" },
  { code: 2356, name: "India" },
  { code: 2276, name: "Germany" },
  { code: 2250, name: "France" },
  { code: 2724, name: "Spain" },
  { code: 2380, name: "Italy" },
  { code: 2528, name: "Netherlands" },
  { code: 2076, name: "Brazil" },
  { code: 2484, name: "Mexico" },
] as const;

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "pt", name: "Portuguese" },
] as const;

export const DEFAULT_LOCATION = 2840;

export function locationName(code: number): string {
  return LOCATIONS.find((l) => l.code === code)?.name ?? String(code);
}

/** The language most searches in a location use. */
export function defaultLanguage(location: number): string {
  return (
    {
      2276: "de",
      2250: "fr",
      2724: "es",
      2380: "it",
      2528: "nl",
      2076: "pt",
      2484: "es",
    }[location] ?? "en"
  );
}

/** Search-result features by the API's item type. */
export const SERP_FEATURES: Record<string, string> = {
  featured_snippet: "Featured snippet",
  people_also_ask: "People also ask",
  local_pack: "Local pack",
  knowledge_graph: "Knowledge panel",
  images: "Images",
  video: "Videos",
  top_stories: "Top stories",
  shopping: "Shopping",
  ai_overview: "AI overview",
  related_searches: "Related searches",
  twitter: "Posts",
  answer_box: "Answer box",
  sitelinks: "Sitelinks",
  paid: "Ads",
};

export function featureName(type: string): string {
  return SERP_FEATURES[type] ?? type.replaceAll("_", " ");
}
