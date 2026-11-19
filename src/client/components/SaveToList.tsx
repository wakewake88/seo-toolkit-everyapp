import { useState } from "react";
import { toast } from "sonner";
import { Choice } from "@/client/components/Choice";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { messageOf } from "@/client/lib/format";
import { saveKeywords } from "@/serverFunctions/lists";

export interface SavableKeyword {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: string | null;
}

/** Saves picked keywords into a named list in one of the member's projects. */
export function SaveToListDialog({
  projects,
  keywords,
  defaultProject,
  onClose,
}: {
  projects: { id: string; name: string }[];
  keywords: SavableKeyword[];
  defaultProject?: string;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState(defaultProject ?? projects[0]?.id ?? "");
  const [listName, setListName] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const result = await saveKeywords({ data: { projectId, listName, keywords } });
      const name = result.listName;
      if (result.added === 0) {
        toast(keywords.length === 1 ? `It was already in ${name}` : keywords.length === 2 ? `Both were already in ${name}` : `All were already in ${name}`);
      } else {
        toast.success(
          `Saved ${result.added} keyword${result.added === 1 ? "" : "s"} to ${name}` +
            (result.skipped ? `; ${result.skipped} already there` : ""),
        );
      }
      onClose();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Save {keywords.length} keyword{keywords.length === 1 ? "" : "s"}
          </DialogTitle>
        </DialogHeader>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a project first; lists live inside projects.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (listName.trim()) void save();
            }}
          >
            <Choice
              id="save-project"
              label="Project"
              value={projectId}
              onChange={setProjectId}
              items={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
            <div className="space-y-1.5">
              <Label htmlFor="list-name">List name</Label>
              <Input id="list-name" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="A topic, such as Pricing" />
            </div>
            <DialogFooter>
              <Button type="submit" pending={pending} disabled={!listName.trim()}>
                Save keywords
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
