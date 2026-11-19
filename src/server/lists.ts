import type { EveryAppUser } from "@every-app/sdk/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chunks } from "@/db/chunks";
import { keywordLists, savedKeywords } from "@/db/schema";
import { projectFor } from "@/server/projects";
import { UserFacingError } from "@/server/errors";
import type { KeywordListView } from "@/shared/csv";

export const saveKeywordsInput = z
  .object({
    projectId: z.string().min(1),
    listName: z.string().trim().min(1, "Name the list").max(80),
    keywords: z
      .array(
        z
          .object({
            keyword: z.string().trim().min(1).max(200),
            volume: z.number().int().nullable(),
            difficulty: z.number().int().min(0).max(100).nullable(),
            cpc: z.number().nullable(),
            intent: z.string().max(40).nullable(),
          })
          .strict(),
      )
      .min(1, "Pick at least one keyword")
      .max(500),
  })
  .strict();
export const deleteSavedInput = z
  .object({ projectId: z.string().min(1), id: z.string().min(1) })
  .strict();
export const deleteListInput = z
  .object({ projectId: z.string().min(1), listId: z.string().min(1) })
  .strict();

/** Saves keywords into the named list, creating it; a keyword already there is skipped. */
export async function saveKeywords(
  user: EveryAppUser,
  input: z.infer<typeof saveKeywordsInput>,
): Promise<{ added: number; skipped: number; listName: string }> {
  const project = await projectFor(user, input.projectId);
  await db
    .insert(keywordLists)
    .values({ id: crypto.randomUUID(), projectId: project.id, name: input.listName })
    .onConflictDoNothing();
  const [list] = await db
    .select()
    .from(keywordLists)
    .where(
      and(eq(keywordLists.projectId, project.id), eq(keywordLists.name, input.listName)),
    );
  if (!list) throw new UserFacingError("The list couldn't be created");
  const unique = [...new Map(input.keywords.map((k) => [k.keyword.toLowerCase(), k])).values()];
  const values = unique.map((k) => ({
    id: crypto.randomUUID(),
    projectId: project.id,
    listId: list.id,
    ...k,
    keyword: k.keyword.toLowerCase(),
  }));
  const [first, ...rest] = chunks(values, 9).map((rows) =>
    db
      .insert(savedKeywords)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: savedKeywords.id }),
  );
  const results = await db.batch([first!, ...rest]);
  const added = results.flat();
  return { added: added.length, skipped: unique.length - added.length, listName: list.name };
}

export async function listKeywordLists(
  user: EveryAppUser,
  projectId: string,
): Promise<KeywordListView[]> {
  const project = await projectFor(user, projectId);
  const lists = await db
    .select()
    .from(keywordLists)
    .where(eq(keywordLists.projectId, project.id))
    .orderBy(keywordLists.name);
  if (lists.length === 0) return [];
  const rows = await db
    .select()
    .from(savedKeywords)
    .where(
      and(
        eq(savedKeywords.projectId, project.id),
        inArray(savedKeywords.listId, lists.map((l) => l.id)),
      ),
    )
    .orderBy(savedKeywords.keyword);
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    keywords: rows
      .filter((r) => r.listId === l.id)
      .map(({ id, keyword, volume, difficulty, cpc, intent }) => ({
        id,
        keyword,
        volume,
        difficulty,
        cpc,
        intent,
      })),
  }));
}

export async function deleteSavedKeyword(
  user: EveryAppUser,
  input: z.infer<typeof deleteSavedInput>,
): Promise<void> {
  const project = await projectFor(user, input.projectId);
  await db
    .delete(savedKeywords)
    .where(and(eq(savedKeywords.id, input.id), eq(savedKeywords.projectId, project.id)));
}

export async function deleteList(
  user: EveryAppUser,
  input: z.infer<typeof deleteListInput>,
): Promise<void> {
  const project = await projectFor(user, input.projectId);
  await db.batch([
    db
      .delete(savedKeywords)
      .where(
        and(eq(savedKeywords.listId, input.listId), eq(savedKeywords.projectId, project.id)),
      ),
    db
      .delete(keywordLists)
      .where(and(eq(keywordLists.id, input.listId), eq(keywordLists.projectId, project.id))),
  ]);
}

