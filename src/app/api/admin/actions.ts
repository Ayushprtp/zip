"use server";

import { validatedActionWithAdminPermission } from "lib/action-utils";
import { headers } from "next/headers";
import { auth } from "auth/server";
import {
  DEFAULT_USER_ROLE,
  userRolesInfo,
  USER_ROLES,
  UserRole,
} from "app-types/roles";
import {
  UpdateUserRoleSchema,
  UpdateUserRoleActionState,
  UpdateUserBanStatusSchema,
  UpdateUserBanStatusActionState,
} from "./validations";
import logger from "lib/logger";
import { getTranslations } from "next-intl/server";
import { getUser } from "lib/user/server";
import { pgDb } from "lib/db/pg/db.pg";
import { UserTable } from "lib/db/pg/schema.pg";
import { eq } from "drizzle-orm";

export const updateUserRolesAction = validatedActionWithAdminPermission(
  UpdateUserRoleSchema,
  async (data, _formData, userSession): Promise<UpdateUserRoleActionState> => {
    const t = await getTranslations("Admin.UserRoles");
    const tCommon = await getTranslations("User.Profile.common");
    const { userId, role: roleInput } = data;

    const role = (roleInput || DEFAULT_USER_ROLE) as UserRole;

    // Cannot update own role
    if (userSession.user.id === userId) {
      return {
        success: false,
        message: t("cannotUpdateOwnRole"),
      };
    }

    // Get current user to check owner protection
    const currentUser = await getUser(userId);
    if (!currentUser) {
      return {
        success: false,
        message: tCommon("userNotFound"),
      };
    }

    // OWNER PROTECTION: Cannot demote the system owner
    if ((currentUser as any).isOwner === true) {
      return {
        success: false,
        message: "Cannot modify the system owner's role. Owner is immutable.",
      };
    }

    // Permission check: Only super_admin can assign super_admin or admin roles
    const adminRole = (userSession.user as any).role;
    if (
      role === USER_ROLES.SUPER_ADMIN &&
      adminRole !== USER_ROLES.SUPER_ADMIN
    ) {
      return {
        success: false,
        message: "Only super_admin can assign super_admin role.",
      };
    }
    if (role === USER_ROLES.ADMIN && adminRole !== USER_ROLES.SUPER_ADMIN) {
      return {
        success: false,
        message: "Only super_admin can assign admin role.",
      };
    }

    // Update role directly in database (bypassing Better Auth's limited role options)
    await pgDb
      .update(UserTable)
      .set({
        role: role as "super_admin" | "admin" | "moderator" | "user",
        updatedAt: new Date(),
      })
      .where(eq(UserTable.id, userId));

    // Revoke sessions to force re-login with new role
    await auth.api.revokeUserSessions({
      body: { userId },
      headers: await headers(),
    });

    const user = await getUser(userId);
    if (!user) {
      return {
        success: false,
        message: tCommon("userNotFound"),
      };
    }

    return {
      success: true,
      message: t("roleUpdatedSuccessfullyTo", {
        role: userRolesInfo[role]?.label || role,
      }),
      user,
    };
  },
);

export const updateUserBanStatusAction = validatedActionWithAdminPermission(
  UpdateUserBanStatusSchema,
  async (
    data,
    _formData,
    userSession,
  ): Promise<UpdateUserBanStatusActionState> => {
    const tCommon = await getTranslations("User.Profile.common");
    const { userId, banned, banReason } = data;

    if (userSession.user.id === userId) {
      return {
        success: false,
        message: tCommon("cannotBanUnbanYourself"),
      };
    }
    try {
      if (!banned) {
        await auth.api.banUser({
          body: {
            userId,
            banReason:
              banReason ||
              (await getTranslations("User.Profile.common"))("bannedByAdmin"),
          },
          headers: await headers(),
        });
        await auth.api.revokeUserSessions({
          body: { userId },
          headers: await headers(),
        });
      } else {
        await auth.api.unbanUser({
          body: { userId },
          headers: await headers(),
        });
      }
      const user = await getUser(userId);
      if (!user) {
        return {
          success: false,
          message: tCommon("userNotFound"),
        };
      }
      return {
        success: true,
        message: user.banned
          ? tCommon("userBannedSuccessfully")
          : tCommon("userUnbannedSuccessfully"),
        user,
      };
    } catch (error) {
      logger.error(error);
      return {
        success: false,
        message: tCommon("failedToUpdateUserStatus"),
        error: error instanceof Error ? error.message : tCommon("unknownError"),
      };
    }
  },
);
