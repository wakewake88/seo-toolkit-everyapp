import type { EveryAppUser } from "@every-app/sdk/server";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Records the member on first sight, keeping the email the Gateway sent. */
export async function rememberUser(user: EveryAppUser): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}
