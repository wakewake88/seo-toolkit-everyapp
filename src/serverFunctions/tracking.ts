import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as tracking from "@/server/tracking";
import { projectIdInput } from "@/server/projects";

export const getTracking = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projectIdInput.parse(data))
  .handler(({ data, context: { user } }) => tracking.trackingView(user, data.projectId));

export const trackKeywords = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => tracking.trackInput.parse(data))
  .handler(({ data, context: { user } }) => tracking.trackKeywords(user, data));

export const stopTracking = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => tracking.removeTrackedInput.parse(data))
  .handler(({ data, context: { user } }) => tracking.stopTracking(user, data));

export const addCompetitor = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => tracking.competitorInput.parse(data))
  .handler(({ data, context: { user } }) => tracking.addCompetitor(user, data));

export const removeCompetitor = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => tracking.removeTrackedInput.parse(data))
  .handler(({ data, context: { user } }) => tracking.removeCompetitor(user, data));

export const checkRankingsNow = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projectIdInput.parse(data))
  .handler(({ data, context: { user } }) => tracking.checkNow(user, data.projectId));
