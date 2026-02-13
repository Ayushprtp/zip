import { requireAdminPermission } from "auth/permissions";
import { unauthorized } from "next/navigation";
import { PlansManager } from "@/components/admin/billing/plans-manager";
import { getAllPricingPlans } from "lib/admin/billing-repository";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  try {
    await requireAdminPermission();
  } catch (_error) {
    unauthorized();
  }

  const plans = await getAllPricingPlans();

  return <PlansManager initialPlans={plans} />;
}
