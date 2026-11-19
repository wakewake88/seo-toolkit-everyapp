import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Shell } from "@/client/components/Shell";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { messageOf } from "@/client/lib/format";
import { DOMAIN_ERROR, normalizeDomain } from "@/shared/domain";
import { createProject, getProjects } from "@/serverFunctions/projects";

export const Route = createFileRoute("/")({
  loader: () => getProjects(),
  head: () => ({ meta: [{ title: "Projects · SEO Toolkit" }] }),
  component: Projects,
});

function Projects() {
  const { projects } = Route.useLoaderData();
  const [open, setOpen] = useState(false);
  const newButton = (
    <Button onClick={() => setOpen(true)}>
      <Plus aria-hidden />
      New project
    </Button>
  );
  return (
    <Shell>
      <PageHeader title="Projects" actions={newButton} />
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create one for each site you track and audit."
        />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead className="text-right">Visibility</TableHead>
                <TableHead className="text-right">Site health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id} data-testid="project-row">
                  <TableCell>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="text-muted-foreground">{p.domain}</div>
                  </TableCell>
                  <TableCell>
                    {p.keywords} {p.keywords === 1 ? "keyword" : "keywords"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.visibility === null ? "–" : `${p.visibility}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span data-testid="project-score">
                      {p.auditScore ?? "–"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {open ? <NewProjectDialog onClose={() => setOpen(false)} /> : null}
    </Shell>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Give the project a name");
    if (!normalizeDomain(domain)) return setError(DOMAIN_ERROR);
    setPending(true);
    try {
      const { id } = await createProject({ data: { name, domain } });
      await navigate({ to: "/projects/$projectId", params: { projectId: id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-domain">Domain</Label>
            <Input
              id="project-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" pending={pending}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
