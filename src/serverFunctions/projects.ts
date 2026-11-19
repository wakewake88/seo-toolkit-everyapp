import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { isAdmin } from "@every-app/sdk/server";
import * as projects from "@/server/projects";
import { rememberUser } from "@/server/users";

export const getProjects = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await rememberUser(user);
    return { projects: await projects.listProjects(user), isAdmin: isAdmin(user) };
  });

export const getProject = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.projectIdInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const p = await projects.projectFor(user, data.projectId);
    return { id: p.id, name: p.name, domain: p.domain, auditWeekly: p.auditWeekly };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.createProjectInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await rememberUser(user);
    const p = await projects.createProject(user, data);
    return { id: p.id };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.updateProjectInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const p = await projects.updateProject(user, data);
    return { id: p.id, name: p.name, domain: p.domain };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.projectIdInput.parse(data))
  .handler(({ data, context: { user } }) => projects.deleteProject(user, data.projectId));

export const getAllProjects = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    if (!isAdmin(user)) return { allowed: false as const, projects: [] };
    return { allowed: true as const, projects: await projects.listAllProjects(user) };
  });
