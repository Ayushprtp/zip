import { requireAdminPermission } from "auth/permissions";
import { unauthorized } from "next/navigation";
import { getAdminBillingStats } from "lib/admin/billing-repository";
import { BillingOverview } from "@/components/admin/billing/billing-overview";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  try {
    await requireAdminPermission();
  } catch (_error) {
    unauthorized();
  }

  const stats = await getAdminBillingStats();

  return <BillingOverview stats={stats} />;
}
