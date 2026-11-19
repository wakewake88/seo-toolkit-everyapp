import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINKS = [
  { to: "/", label: "Projects", exact: true },
  { to: "/keywords", label: "Keywords", exact: false },
  { to: "/domains", label: "Domains", exact: false },
  { to: "/backlinks", label: "Backlinks", exact: false },
] as const;
const ADMIN = { to: "/admin", label: "Admin", exact: false } as const;

/** The AppShell with the app's sections in its bar. */
export function Shell({ children }: { children: ReactNode }) {
  const isAdmin = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return Boolean(root && "isAdmin" in root && root.isAdmin);
    },
  });
  const links = isAdmin ? [...LINKS, ADMIN] : LINKS;
  return (
    <AppShell
      nav={
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.exact }}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
