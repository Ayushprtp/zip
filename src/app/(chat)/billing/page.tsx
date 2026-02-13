import { getSession } from "lib/auth/server";
import { redirect } from "next/navigation";
import { getActivePricingPlans } from "lib/admin/billing-repository";
import { getUserCreditsById } from "lib/admin/billing-repository";
import { BillingPage } from "@/components/billing/billing-page";

export const dynamic = "force-dynamic";

export default async function Billing() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const [plans, userBilling] = await Promise.all([
    getActivePricingPlans(),
    getUserCreditsById(session.user.id).catch(() => null),
  ]);

  return (
    <BillingPage
      plans={plans}
      currentPlan={userBilling?.subscription?.plan || "free"}
      subscription={userBilling?.subscription || null}
      credits={
        userBilling?.credits
          ? {
              balance: userBilling.credits.balance,
              totalCreditsUsed: userBilling.credits.totalCreditsUsed,
              monthlyCreditsUsed: userBilling.credits.monthlyCreditsUsed,
            }
          : null
      }
    />
  );
}
