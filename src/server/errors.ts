/** A message the page shows as it is. */
export class UserFacingError extends Error {}

export function notFound(): never {
  throw new UserFacingError("Project not found");
}
