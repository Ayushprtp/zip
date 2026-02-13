import { requireAdminPermission } from "auth/permissions";
import { unauthorized } from "next/navigation";
import { getAdminUserCredits } from "lib/admin/billing-repository";
import { UserCreditsManager } from "@/components/admin/billing/user-credits-manager";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function UserCreditsPage({ searchParams }: PageProps) {
  try {
    await requireAdminPermission();
  } catch (_error) {
    unauthorized();
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const result = await getAdminUserCredits({
    search: params.search,
    limit,
    offset,
  });

  return (
    <UserCreditsManager
      users={result.users}
      total={result.total}
      page={page}
      limit={limit}
      search={params.search}
    />
  );
}
