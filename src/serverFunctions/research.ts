import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as research from "@/server/research";
import { projectFor } from "@/server/projects";
import { searchDataReady } from "@/server/searchData";

export const getSearchDataStatus = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async () => ({ ready: await searchDataReady() }));

export const findKeywordIdeas = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => research.ideasInput.parse(data))
  .handler(({ data }) => research.keywordIdeas(data));

export const getTopResults = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => research.serpInput.parse(data))
  .handler(({ data }) => research.topResults(data));

export const getDomainOverview = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => research.domainInput.parse(data))
  .handler(({ data }) => research.domainOverview(data));

export const getKeywordGap = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => research.gapInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const project = await projectFor(user, data.projectId);
    const competitors = [...new Set(data.competitors)].filter((d) => d !== project.domain);
    return {
      domain: project.domain,
      competitors,
      rows: await research.compareKeywords(project.domain, competitors, data.location),
    };
  });

export const getBacklinkSummary = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => research.domainInput.pick({ domain: true }).parse(data))
  .handler(({ data }) => research.backlinkSummary(data.domain));

export const getBacklinks = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => research.backlinksInput.parse(data))
  .handler(({ data }) => research.backlinks(data));

export const getReferringDomains = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => research.domainInput.pick({ domain: true }).parse(data))
  .handler(({ data }) => research.referringDomains(data.domain));

export const getBacklinkGap = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => research.backlinkGapInput.parse(data))
  .handler(({ data }) =>
    research.backlinkGap({ ...data, competitors: [...new Set(data.competitors)].filter((d) => d !== data.domain) }),
  );

