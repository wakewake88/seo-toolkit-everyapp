import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as audits from "@/server/audit/audits";

export const getAudit = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => audits.auditViewInput.parse(data))
  .handler(({ data, context: { user } }) => audits.auditView(user, data));

export const startAudit = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => audits.startAuditInput.parse(data))
  .handler(({ data, context: { user } }) => audits.startAudit(user, data));
