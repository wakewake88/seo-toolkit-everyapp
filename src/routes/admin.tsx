import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Shell } from "@/client/components/Shell";
import { Button } from "@/client/components/ui/button";
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
import { deleteProject, getAllProjects } from "@/serverFunctions/projects";

export const Route = createFileRoute("/admin")({
  loader: () => getAllProjects(),
  head: () => ({ meta: [{ title: "Admin · SEO Toolkit" }] }),
  component: Admin,
});

function Admin() {
  const { allowed, projects } = Route.useLoaderData();
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function remove(id: string) {
    setPending(true);
    try {
      await deleteProject({ data: { projectId: id } });
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

  return (
    <Shell>
      <PageHeader title="All projects" />
      {!allowed ? (
        <EmptyState kind="error" title="Only workspace admins can open this page." />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects in this workspace" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Keywords</TableHead>
                <TableHead className="text-right">Site health</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id} data-testid="admin-project-row">
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-muted-foreground">{p.domain}</div>
                  </TableCell>
                  <TableCell>{p.ownerEmail}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.keywords}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.auditScore ?? "–"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${p.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirm({ id: p.id, name: p.name })}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {confirm ? (
        <ConfirmDialog
          title={`Delete ${confirm.name}?`}
          confirmLabel="Delete project"
          destructive
          pending={pending}
          onClose={() => setConfirm(null)}
          onConfirm={() => void remove(confirm.id)}
        >
          Its rankings, audits and keyword lists go with it.
        </ConfirmDialog>
      ) : null}
    </Shell>
  );
}
