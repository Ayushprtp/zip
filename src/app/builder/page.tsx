import { BuilderPage } from "@/components/builder";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { pgDb } from "@/lib/db/pg/db.pg";
import { builderThreads } from "@/db/schema/builder";
import { eq, desc } from "drizzle-orm";

export default async function Builder({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const isNewProject = params.new === "true";

  // If not explicitly creating a new project, redirect to most recent thread
  if (!isNewProject) {
    const existingThreads = await pgDb
      .select()
      .from(builderThreads)
      .where(eq(builderThreads.userId, session.user.id))
      .orderBy(desc(builderThreads.updatedAt))
      .limit(1);

    if (existingThreads.length > 0) {
      redirect(`/builder/${existingThreads[0].id}`);
    }
  }

  // Show the new builder page with template selection
  return <BuilderPage />;
}
