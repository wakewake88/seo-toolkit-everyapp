import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import { scheduledAudits } from "@/server/audit/audits";
import { scheduledRankChecks } from "@/server/tracking";

export { RankCheckWorkflow } from "@/server/rankCheck";
export { SiteAuditWorkflow } from "@/server/audit/workflow";

/** Crons, as cloudflare.config.ts lists them. */
const DAILY_RANK_CHECK = "0 6 * * *";
const WEEKLY_AUDIT = "0 4 * * 1";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401).
export default {
  ...everyApp<Env>(async (request) => tanstackEntry.fetch(request)),
  async scheduled(controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    if (controller.cron === DAILY_RANK_CHECK) ctx.waitUntil(scheduledRankChecks());
    if (controller.cron === WEEKLY_AUDIT) ctx.waitUntil(scheduledAudits());
  },
};
