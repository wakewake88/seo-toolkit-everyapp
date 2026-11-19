import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Shell } from "@/client/components/Shell";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { messageOf } from "@/client/lib/format";
import { getProject } from "@/serverFunctions/projects";

export const Route = createFileRoute("/projects/$projectId")({
  loader: ({ params }) => getProject({ data: { projectId: params.projectId } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.name} · SEO Toolkit` }] : [],
  }),
  component: ProjectLayout,
  errorComponent: ({ error }) => (
    <Shell>
      <EmptyState kind="error" title={messageOf(error)} />
    </Shell>
  ),
});

const TABS = [
  { to: "/projects/$projectId", label: "Rankings", value: "rankings" },
  { to: "/projects/$projectId/audit", label: "Site audit", value: "audit" },
  { to: "/projects/$projectId/lists", label: "Keyword lists", value: "lists" },
  { to: "/projects/$projectId/settings", label: "Settings", value: "settings" },
] as const;

function ProjectLayout() {
  const project = Route.useLoaderData();
  const matchRoute = useMatchRoute();
  const current =
    TABS.find((t) => t.value !== "rankings" && matchRoute({ to: t.to, params: { projectId: project.id } }))
      ?.value ?? "rankings";
  return (
    <Shell>
      <PageHeader
        title={project.name}
        description={<span data-testid="project-domain">{project.domain}</span>}
      />
      <div className="-mt-4 space-y-6">
        <Tabs value={current}>
          <TabsList variant="line">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                render={<Link to={tab.to} params={{ projectId: project.id }} />}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Outlet />
      </div>
    </Shell>
  );
}
