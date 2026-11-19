import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { messageOf } from "@/client/lib/format";
import { DOMAIN_ERROR, normalizeDomain } from "@/shared/domain";
import { deleteProject, updateProject } from "@/serverFunctions/projects";

export const Route = createFileRoute("/projects/$projectId/settings")({
  component: Settings,
});

const layout = getRouteApi("/projects/$projectId");

function Settings() {
  const project = layout.useLoaderData();
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [domain, setDomain] = useState(project.domain);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!normalizeDomain(domain)) return toast.error(DOMAIN_ERROR);
    setSaving(true);
    try {
      const saved = await updateProject({ data: { projectId: project.id, name, domain } });
      setDomain(saved.domain);
      await router.invalidate();
      toast.success("Saved");
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteProject({ data: { projectId: project.id } });
      await router.navigate({ to: "/" });
    } catch (error) {
      setConfirm(false);
      toast.error(messageOf(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="max-w-md space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Name</Label>
              <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-domain">Domain</Label>
              <Input id="settings-domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
            <Button type="submit" pending={saving}>
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delete project</CardTitle>
          <CardDescription>
            Removes its tracked keywords, ranking history, audits and keyword lists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            Delete project
          </Button>
        </CardContent>
      </Card>
      {confirm ? (
        <ConfirmDialog
          title={`Delete ${project.name}?`}
          confirmLabel="Delete project"
          destructive
          pending={deleting}
          onClose={() => setConfirm(false)}
          onConfirm={() => void remove()}
        >
          This can't be undone.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
