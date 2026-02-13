import { USER_ROLES } from "app-types/roles";

export const getUserAvatar = (user: { image?: string | null }): string => {
  const disableDefaultAvatar = process.env.DISABLE_DEFAULT_AVATAR === "true";
  return user.image || (disableDefaultAvatar ? "" : "/pf.png");
};

export const getIsUserAdmin = (user?: { role?: string | null }): boolean => {
  const roles = user?.role?.split(",") || [];
  return (
    roles.includes(USER_ROLES.ADMIN) ||
    roles.includes(USER_ROLES.SUPER_ADMIN) ||
    false
  );
};
