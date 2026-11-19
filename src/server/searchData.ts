import { env } from "cloudflare:workers";
import {
  gatewayRefusal,
  integrationFetch,
  integrationStatus,
} from "@every-app/sdk/server";
import { UserFacingError } from "@/server/errors";

const API = "https://api.dataforseo.com/v3";

export const NOT_SET_UP = "Search data isn't set up";

/** Whether the search-data feature is configured on the Gateway. */
export async function searchDataReady(background = false): Promise<boolean> {
  try {
    const status = await integrationStatus({
      env,
      provider: "dataforseo",
      ...(background ? { for: { background: true } } : {}),
    });
    return status.ready;
  } catch {
    return false;
  }
}

interface Envelope<T> {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: T[] | null;
  }[];
}

/** One live call; the first result of its one task, or null when it has none. */
export async function searchData<T>(
  path: string,
  task: Record<string, unknown>,
  background = false,
): Promise<T | null> {
  const call = integrationFetch({
    env,
    provider: "dataforseo",
    ...(background ? { for: { background: true } } : {}),
  });
  const response = await call(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([task]),
  });
  const refused = await gatewayRefusal(response);
  if (refused) throw new UserFacingError(NOT_SET_UP);
  if (!response.ok) {
    throw new UserFacingError(
      `The search-data service answered ${response.status}. Try again shortly.`,
    );
  }
  const body = (await response.json()) as Envelope<T>;
  const first = body.tasks?.[0];
  if (!first || (first.status_code ?? 20000) >= 40000) {
    throw new UserFacingError(
      `The search-data service refused the request: ${first?.status_message ?? body.status_message ?? "unknown error"}`,
    );
  }
  return first.result?.[0] ?? null;
}
