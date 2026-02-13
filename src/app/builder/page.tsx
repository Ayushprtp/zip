import { BuilderPage } from "@/components/builder";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";

export default async function Builder() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // We effectively disable the auto-redirect to the last project.
  // Users should land on the "Create New / Select Template" page by default
  // unless they specifically navigate to a thread ID.

  // Show the new builder page with template selection
  return <BuilderPage />;
}
