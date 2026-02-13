/**
 * FLARE.SH RBAC SYSTEM
 *
 * Three independent dimensions:
 * 1. Role → WHO the user is (authority)
 * 2. Account Type → WHY they have special access (business relationship)
 * 3. Plan → HOW MUCH they can use (limits & pricing)
 */

// ============================================================================
// 1️⃣ ROLES (AUTHORITY — WHO THE USER IS)
// ============================================================================

export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MODERATOR: "moderator",
  USER: "user",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Backward compatibility alias
export type UserRoleNames = UserRole;

/**
 * Default role for new users
 */
export const DEFAULT_USER_ROLE: UserRole = USER_ROLES.USER;

/**
 * Role hierarchy and permissions
 */
export type UserRolesInfo = Record<
  UserRole,
  {
    label: string;
    description: string;
    permissions: string[];
  }
>;

export const userRolesInfo: UserRolesInfo = {
  super_admin: {
    label: "Super Admin (Owner)",
    description:
      "System owner with absolute control. Cannot be removed or demoted.",
    permissions: [
      "full_system_control",
      "manage_admins",
      "manage_moderators",
      "create_invite_tokens",
      "manage_models",
      "manage_pricing",
      "view_all_logs",
      "emergency_shutdown",
      "manage_partners",
      "transfer_ownership", // Optional, requires explicit implementation
    ],
  },
  admin: {
    label: "Admin",
    description: "Trusted operator with system management capabilities.",
    permissions: [
      "manage_models",
      "view_system_stats",
      "manage_users",
      "handle_abuse",
      "view_audit_logs",
      "manage_moderators",
    ],
  },
  moderator: {
    label: "Moderator",
    description: "Safety and support helper with limited access.",
    permissions: [
      "view_user_activity",
      "flag_abuse",
      "restrict_users_temporarily",
      "review_content",
      "view_limited_stats",
    ],
  },
  user: {
    label: "User",
    description: "Default user role with standard platform access.",
    permissions: [
      "use_ai_models",
      "manage_own_profile",
      "view_own_history",
      "spend_credits",
    ],
  },
};

// ============================================================================
// 2️⃣ ACCOUNT TYPE (BUSINESS CONTEXT — WHY THEY HAVE SPECIAL ACCESS)
// ============================================================================

export const ACCOUNT_TYPES = {
  NORMAL: "normal",
  PARTNER: "partner",
} as const;

export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

export const DEFAULT_ACCOUNT_TYPE: AccountType = ACCOUNT_TYPES.NORMAL;

export type AccountTypeInfo = Record<
  AccountType,
  {
    label: string;
    description: string;
    benefits: string[];
  }
>;

export const accountTypeInfo: AccountTypeInfo = {
  normal: {
    label: "Normal",
    description: "Standard user account",
    benefits: ["Access to public models", "Standard features"],
  },
  partner: {
    label: "Partner",
    description: "Business partner with special access (NOT staff)",
    benefits: [
      "Access to partner-only models",
      "Custom pricing (if applicable)",
      "Beta/private features",
      "Priority support",
    ],
  },
};

// ============================================================================
// 3️⃣ PLAN (USAGE LIMITS — HOW MUCH THEY CAN USE)
// ============================================================================

export const USER_PLANS = {
  FREE: "free",
  PRO: "pro",
  PLUS: "plus",
  ENTERPRISE: "enterprise",
} as const;

export type UserPlan = (typeof USER_PLANS)[keyof typeof USER_PLANS];

export const DEFAULT_USER_PLAN: UserPlan = USER_PLANS.FREE;

/**
 * Tier hierarchy for access checks: free < pro < plus < enterprise
 */
export const TIER_HIERARCHY: Record<UserPlan, number> = {
  free: 0,
  pro: 1,
  plus: 2,
  enterprise: 3,
};

export function canAccessTier(
  userPlan: UserPlan,
  requiredPlan: UserPlan,
): boolean {
  return TIER_HIERARCHY[userPlan] >= TIER_HIERARCHY[requiredPlan];
}

export type PlanLimits = {
  creditsPerMonth: number;
  requestsPerMinute: number;
  requestsPerDay: number;
  maxConcurrentRequests: number;
  maxSessionLength: number; // in minutes
  priorityQueue: boolean;
  slaGuarantee: boolean;
};

export type UserPlanInfo = Record<
  UserPlan,
  {
    label: string;
    description: string;
    limits: PlanLimits;
  }
>;

export const userPlanInfo: UserPlanInfo = {
  free: {
    label: "Free",
    description: "Basic tier with limited usage",
    limits: {
      creditsPerMonth: 1000,
      requestsPerMinute: 5,
      requestsPerDay: 100,
      maxConcurrentRequests: 1,
      maxSessionLength: 30,
      priorityQueue: false,
      slaGuarantee: false,
    },
  },
  pro: {
    label: "Pro",
    description: "Enhanced tier with higher limits",
    limits: {
      creditsPerMonth: 10000,
      requestsPerMinute: 20,
      requestsPerDay: 1000,
      maxConcurrentRequests: 5,
      maxSessionLength: 120,
      priorityQueue: true,
      slaGuarantee: false,
    },
  },
  plus: {
    label: "Plus",
    description: "Power user tier with generous limits",
    limits: {
      creditsPerMonth: 50000,
      requestsPerMinute: 60,
      requestsPerDay: 5000,
      maxConcurrentRequests: 10,
      maxSessionLength: -1, // unlimited
      priorityQueue: true,
      slaGuarantee: false,
    },
  },
  enterprise: {
    label: "Enterprise",
    description: "Maximum tier with dedicated resources",
    limits: {
      creditsPerMonth: -1, // unlimited
      requestsPerMinute: 100,
      requestsPerDay: -1, // unlimited
      maxConcurrentRequests: 20,
      maxSessionLength: -1, // unlimited
      priorityQueue: true,
      slaGuarantee: true,
    },
  },
};

// ============================================================================
// 4️⃣ SYSTEM INVARIANTS & HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a user is the system owner
 */
export function isSystemOwner(user: {
  role: string;
  isOwner?: boolean;
}): boolean {
  return user.role === USER_ROLES.SUPER_ADMIN && user.isOwner === true;
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const roleInfo = userRolesInfo[role];
  return roleInfo?.permissions.includes(permission) || false;
}

/**
 * Check if a user can access partner-only features
 */
export function canAccessPartnerFeatures(
  role: UserRole,
  accountType: AccountType,
): boolean {
  // Super admins and admins can access everything
  if (role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.ADMIN) {
    return true;
  }
  // Partners can access partner features
  return accountType === ACCOUNT_TYPES.PARTNER;
}

/**
 * Check if a role can be assigned by another role
 */
export function canAssignRole(
  assignerRole: UserRole,
  targetRole: UserRole,
): boolean {
  // Only super_admin can create other super_admins
  if (targetRole === USER_ROLES.SUPER_ADMIN) {
    return assignerRole === USER_ROLES.SUPER_ADMIN;
  }
  // Super_admin and admin can create moderators and users
  if (targetRole === USER_ROLES.MODERATOR || targetRole === USER_ROLES.USER) {
    return (
      assignerRole === USER_ROLES.SUPER_ADMIN ||
      assignerRole === USER_ROLES.ADMIN
    );
  }
  // Only super_admin can create admins
  if (targetRole === USER_ROLES.ADMIN) {
    return assignerRole === USER_ROLES.SUPER_ADMIN;
  }
  return false;
}

/**
 * Validate that system invariants hold
 */
export function validateSystemInvariants(
  users: Array<{ role: string; isOwner?: boolean }>,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Must have at least one super_admin
  const superAdmins = users.filter((u) => u.role === USER_ROLES.SUPER_ADMIN);
  if (superAdmins.length === 0) {
    errors.push("System must have at least one super_admin");
  }

  // Must have exactly one owner
  const owners = users.filter((u) => u.isOwner === true);
  if (owners.length === 0) {
    errors.push("System must have exactly one owner (isOwner = true)");
  } else if (owners.length > 1) {
    errors.push("System must have exactly one owner, found multiple");
  }

  // Owner must be super_admin
  const owner = owners[0];
  if (owner && owner.role !== USER_ROLES.SUPER_ADMIN) {
    errors.push("Owner must have role = super_admin");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
