import { BuilderThreadPage } from "@/components/builder/BuilderThreadPage";

export default function BuilderThread({
  params,
}: { params: { threadId: string } }) {
  return <BuilderThreadPage threadId={params.threadId} />;
}
