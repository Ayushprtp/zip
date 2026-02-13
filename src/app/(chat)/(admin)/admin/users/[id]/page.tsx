import { notFound, redirect, unauthorized } from "next/navigation";
import { getUserAccounts, getUser } from "lib/user/server";
import { UserDetail } from "@/components/user/user-detail/user-detail";
import {
  UserStatsCardLoader,
  UserStatsCardLoaderSkeleton,
} from "@/components/user/user-detail/user-stats-card-loader";

import { Suspense } from "react";
import { getSession } from "auth/server";
import { requireAdminPermission } from "auth/permissions";
import {
  getUserCreditsById,
  getActivePricingPlans,
} from "lib/admin/billing-repository";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  try {
    await requireAdminPermission();
  } catch (_error) {
    unauthorized();
  }
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const [user, userAccountInfo, userBilling, pricingPlans] = await Promise.all([
    getUser(id),
    getUserAccounts(id),
    getUserCreditsById(id),
    getActivePricingPlans(),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <UserDetail
      user={user}
      currentUserId={session.user.id}
      userAccountInfo={userAccountInfo}
      subscription={userBilling?.subscription || null}
      userCredits={
        userBilling?.credits
          ? {
              balance: userBilling.credits.balance,
              totalCreditsUsed: userBilling.credits.totalCreditsUsed,
              totalCreditsGranted: userBilling.credits.totalCreditsGranted,
              totalCreditsPurchased: userBilling.credits.totalCreditsPurchased,
              monthlyCreditsUsed: userBilling.credits.monthlyCreditsUsed,
              dailyRequestCount: userBilling.credits.dailyRequestCount,
              dailyResetAt:
                userBilling.credits.dailyResetAt?.toISOString() || null,
            }
          : null
      }
      pricingPlans={pricingPlans}
      userStatsSlot={
        <Suspense fallback={<UserStatsCardLoaderSkeleton />}>
          <UserStatsCardLoader userId={id} view="admin" />
        </Suspense>
      }
      view="admin"
    />
  );
}
