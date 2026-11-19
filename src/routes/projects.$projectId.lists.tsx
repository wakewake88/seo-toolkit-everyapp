import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
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
import { capitalize, count, messageOf, money } from "@/client/lib/format";
import { toCsv, type KeywordListView } from "@/shared/csv";
import { deleteKeywordList, deleteSavedKeyword, getKeywordLists } from "@/serverFunctions/lists";

export const Route = createFileRoute("/projects/$projectId/lists")({
  loader: ({ params }) => getKeywordLists({ data: { projectId: params.projectId } }),
  component: Lists,
});

function Lists() {
  const lists = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const router = useRouter();
  const [confirm, setConfirm] = useState<KeywordListView | null>(null);

  async function run(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    }
  }

  if (lists.length === 0) {
    return (
      <EmptyState
        title="No saved keywords"
        description="Save keywords from research or a keyword gap and they appear here."
        action={
          <Button variant="outline" render={<Link to="/keywords" />}>
            Research keywords
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {lists.map((list) => (
        <section key={list.id} className="space-y-3" data-testid="keyword-list">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight">
              {list.name}{" "}
              <span className="font-normal text-muted-foreground">{list.keywords.length}</span>
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => download(list)}>
                <Download aria-hidden />
                Export CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(list)}>
                Delete list
              </Button>
            </div>
          </div>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Difficulty</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.keywords.map((k) => (
                  <TableRow key={k.id} data-testid="saved-keyword-row">
                    <TableCell className="font-medium">{k.keyword}</TableCell>
                    <TableCell className="text-right tabular-nums">{count(k.volume)}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.difficulty ?? "–"}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(k.cpc)}</TableCell>
                    <TableCell>{k.intent ? <Badge variant="secondary">{capitalize(k.intent)}</Badge> : "–"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${k.keyword}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => run(() => deleteSavedKeyword({ data: { projectId, id: k.id } }))}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </section>
      ))}
      {confirm ? (
        <ConfirmDialog
          title={`Delete ${confirm.name}?`}
          confirmLabel="Delete list"
          destructive
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const listId = confirm.id;
            setConfirm(null);
            void run(() => deleteKeywordList({ data: { projectId, listId } }));
          }}
        >
          Its {confirm.keywords.length} saved keywords go with it.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function download(list: KeywordListView) {
  const blob = new Blob([toCsv(list)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${list.name.replace(/[^\w-]+/g, "-").toLowerCase()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
