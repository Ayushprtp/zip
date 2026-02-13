import { requireAdminPermission } from "auth/permissions";
import { unauthorized } from "next/navigation";
import { getAllModelPricing } from "lib/admin/billing-repository";
import { ModelPricingManager } from "@/components/admin/billing/model-pricing-manager";

export const dynamic = "force-dynamic";

export default async function ModelPricingPage() {
  try {
    await requireAdminPermission();
  } catch (_error) {
    unauthorized();
  }

  const pricing = await getAllModelPricing();

  return <ModelPricingManager initialPricing={pricing} />;
}
