import { BuilderThreadPage } from "@/components/builder/BuilderThreadPage";

export default async function BuilderThread({
  params,
}: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <BuilderThreadPage threadId={threadId} />;
}
