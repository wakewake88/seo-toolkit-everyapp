import { createRouter } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { Shell } from "@/client/components/Shell";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: () => (
      <Shell>
        <EmptyState kind="error" title="Page not found" />
      </Shell>
    ),
  });
}
