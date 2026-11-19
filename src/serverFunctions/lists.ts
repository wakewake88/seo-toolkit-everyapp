import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as lists from "@/server/lists";
import { projectIdInput } from "@/server/projects";

export const saveKeywords = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => lists.saveKeywordsInput.parse(data))
  .handler(({ data, context: { user } }) => lists.saveKeywords(user, data));

export const getKeywordLists = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projectIdInput.parse(data))
  .handler(({ data, context: { user } }) => lists.listKeywordLists(user, data.projectId));

export const deleteSavedKeyword = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => lists.deleteSavedInput.parse(data))
  .handler(({ data, context: { user } }) => lists.deleteSavedKeyword(user, data));

export const deleteKeywordList = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => lists.deleteListInput.parse(data))
  .handler(({ data, context: { user } }) => lists.deleteList(user, data));
