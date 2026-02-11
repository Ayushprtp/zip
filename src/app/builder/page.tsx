import { BuilderPage } from "@/components/builder";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { pgDb } from "@/lib/db/pg/db.pg";
import { builderThreads } from "@/db/schema/builder";
import { eq, desc } from "drizzle-orm";

export default async function Builder() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user has any existing threads
  const existingThreads = await pgDb
    .select()
    .from(builderThreads)
    .where(eq(builderThreads.userId, session.user.id))
    .orderBy(desc(builderThreads.updatedAt))
    .limit(1);

  // If user has threads, redirect to the most recent one
  if (existingThreads.length > 0) {
    redirect(`/builder/${existingThreads[0].id}`);
  }

  // Otherwise, show the new builder page
  return <BuilderPage />;
}
