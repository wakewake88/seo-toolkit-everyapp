/**
 * The host of a site a person typed: a URL, a host or a host with a path.
 * Lowercase, without "www." or a port. Null when it isn't a public domain.
 */
export function normalizeDomain(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (!text || /\s/.test(text)) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(text) ? text : `https://${text}`)
      .hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  const labels = host.split(".");
  if (labels.length < 2 || host.length > 253) return null;
  const valid = labels.every((label) =>
    /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(label),
  );
  if (!valid || !/[a-z]/.test(labels.at(-1)!)) return null;
  return host;
}

export const DOMAIN_ERROR = "Enter a domain such as example.com";
