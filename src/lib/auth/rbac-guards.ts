import "server-only";

import { getSession } from "auth/server";
import { NextResponse } from "next/server";
import {
  USER_ROLES,
  ACCOUNT_TYPES,
  USER_PLANS,
  UserRole,
  AccountType,
  UserPlan,
  hasPermission,
  canAccessPartnerFeatures,
  userPlanInfo,
} from "@/types/roles";

/**
 * FLARE.SH RBAC GUARDS
 *
 * Backend-enforced access control. Frontend restrictions are NOT trusted.
 */

// ============================================================================
// SESSION HELPERS
// ============================================================================

export interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountType: AccountType;
  plan: UserPlan;
  isOwner: boolean;
}

/**
 * Get the current user with RBAC fields
 */
export async function getCurrentUser(): Promise<ExtendedUser | null> {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name || "",
    email: session.user.email || "",
    role: (session.user as any).role || USER_ROLES.USER,
    accountType: (session.user as any).accountType || ACCOUNT_TYPES.NORMAL,
    plan: (session.user as any).plan || USER_PLANS.FREE,
    isOwner: (session.user as any).isOwner || false,
  };
}

// ============================================================================
// ROLE-BASED GUARDS
// ============================================================================

/**
 * Require user to be authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/**
 * Require user to have a specific role or higher
 */
export async function requireRole(...allowedRoles: UserRole[]) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}

/**
 * Require user to be super_admin (owner level)
 */
export async function requireSuperAdmin() {
  return requireRole(USER_ROLES.SUPER_ADMIN);
}

/**
 * Require user to be admin or super_admin
 */
export async function requireAdmin() {
  return requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN);
}

/**
 * Require user to be moderator or higher
 */
export async function requireModerator() {
  return requireRole(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.MODERATOR,
  );
}

/**
 * Require user to have a specific permission
 */
export async function requirePermission(permission: string) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user.role, permission)) {
    return NextResponse.json(
      { error: "Forbidden: Missing permission" },
      { status: 403 },
    );
  }

  return user;
}

// ============================================================================
// ACCOUNT TYPE GUARDS
// ============================================================================

/**
 * Require user to be a partner (or admin/super_admin)
 */
export async function requirePartnerAccess() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessPartnerFeatures(user.role, user.accountType)) {
    return NextResponse.json(
      { error: "Partner access required" },
      { status: 403 },
    );
  }

  return user;
}

/**
 * Check if a model/feature is accessible by the user
 */
export async function canAccessModel(modelConfig: { isPartnerOnly?: boolean }) {
  const user = await getCurrentUser();
  if (!user) {
    return false;
  }

  if (!modelConfig.isPartnerOnly) {
    return true; // Public model
  }

  return canAccessPartnerFeatures(user.role, user.accountType);
}

// ============================================================================
// PLAN-BASED GUARDS
// ============================================================================

/**
 * Get user's plan limits
 */
export async function getUserLimits() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  return userPlanInfo[user.plan].limits;
}

/**
 * Check if user has premium plan or higher
 */
export async function requirePremium() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.plan === USER_PLANS.FREE) {
    return NextResponse.json(
      { error: "Premium plan required" },
      { status: 403 },
    );
  }

  return user;
}

/**
 * Check if user has enterprise plan
 */
export async function requireEnterprise() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.plan !== USER_PLANS.ENTERPRISE) {
    return NextResponse.json(
      { error: "Enterprise plan required" },
      { status: 403 },
    );
  }

  return user;
}

// ============================================================================
// OWNER PROTECTION GUARDS (NON-NEGOTIABLE)
// ============================================================================

/**
 * Validate that an action doesn't violate owner protection rules
 *
 * @throws Error if the action would violate owner protection
 */
export function validateOwnerProtection(
  targetUser: { role: string; isOwner?: boolean },
  action: "demote" | "remove" | "delete" | "disable" | "ban",
): void {
  if (targetUser.isOwner === true) {
    throw new Error(
      `OWNER PROTECTION: Cannot ${action} the system owner. This action is prohibited.`,
    );
  }
}

/**
 * Validate role change is allowed
 *
 * @throws Error if role change violates system invariants
 */
export function validateRoleChange(
  actorUser: { role: string; isOwner?: boolean },
  targetUser: { role: string; isOwner?: boolean },
  newRole: UserRole,
): void {
  // Owner cannot be demoted
  if (targetUser.isOwner === true && newRole !== USER_ROLES.SUPER_ADMIN) {
    throw new Error("OWNER PROTECTION: Cannot demote the system owner.");
  }

  // Cannot remove last super_admin (but this requires DB check)
  // This is a preliminary check - full check requires DB query

  // Only super_admin can assign super_admin role
  if (
    newRole === USER_ROLES.SUPER_ADMIN &&
    actorUser.role !== USER_ROLES.SUPER_ADMIN
  ) {
    throw new Error("Only super_admin can assign super_admin role.");
  }

  // Only super_admin can assign admin role
  if (
    newRole === USER_ROLES.ADMIN &&
    actorUser.role !== USER_ROLES.SUPER_ADMIN
  ) {
    throw new Error("Only super_admin can assign admin role.");
  }

  // Admins can assign moderator and user roles
  if (
    (newRole === USER_ROLES.MODERATOR || newRole === USER_ROLES.USER) &&
    ![USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(
      actorUser.role as UserRole,
    )
  ) {
    throw new Error("Insufficient permissions to assign this role.");
  }
}

/**
 * Validate that at least one super_admin will remain after action
 */
export async function ensureSuperAdminExists(
  _excludeUserId?: string,
  _db?: any,
): Promise<boolean> {
  // This requires database access - implement when integrating with DB layer
  // For now, return true as a placeholder
  return true;
}
