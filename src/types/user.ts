import { z } from "zod";
import { passwordSchema } from "lib/validations/password";

import { UserEntity } from "lib/db/pg/schema.pg";
import { getSession } from "auth/server";
import { UserRole, AccountType, UserPlan } from "./roles";

export type UserPreferences = {
  displayName?: string;
  profession?: string; // User's job or profession
  responseStyleExample?: string; // Example of preferred response style
  botName?: string; // Name of the bot
  openAIKey?: string; // User's personal OpenAI API Key
  googleGeminiKey?: string; // User's personal Google Gemini API Key
};

// User without password
export interface User extends Omit<UserEntity, "password" | "preferences"> {
  preferences?: UserPreferences | null;
  lastLogin?: Date | null;
  // RBAC fields
  role: UserRole;
  accountType: AccountType;
  plan: UserPlan;
  isOwner: boolean;
}

export type BasicUser = Omit<
  User,
  | "password"
  | "image"
  | "role"
  | "banned"
  | "banReason"
  | "banExpires"
  | "accountType"
  | "plan"
  | "isOwner"
> & {
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
  accountType?: string | null;
  plan?: string | null;
  isOwner?: boolean | null;
  preferences?: UserPreferences | null;
};

export interface BasicUserWithLastLogin extends BasicUser {
  lastLogin: Date | null;
}

export type UserSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export type UserSessionUser = UserSession["user"];

export type UserRepository = {
  existsByEmail: (email: string) => Promise<boolean>;
  updateUserDetails: (data: {
    userId: string;
    name?: string;
    email?: string;
    image?: string;
  }) => Promise<User>;

  updatePreferences: (
    userId: string,
    preferences: UserPreferences,
  ) => Promise<User>;
  getPreferences: (userId: string) => Promise<UserPreferences | null>;
  getUserById: (userId: string) => Promise<BasicUserWithLastLogin | null>;
  getUserCount: () => Promise<number>;
  getUserStats: (userId: string) => Promise<{
    threadCount: number;
    messageCount: number;
    modelStats: Array<{
      model: string;
      messageCount: number;
      totalTokens: number;
    }>;
    totalTokens: number;
    period: string;
  }>;
  getUserAuthMethods: (userId: string) => Promise<{
    hasPassword: boolean;
    oauthProviders: string[];
  }>;
};

export const UserZodSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema,
});

export const UserPreferencesZodSchema = z.object({
  displayName: z.string().optional(),
  profession: z.string().optional(),
  responseStyleExample: z.string().optional(),
  botName: z.string().optional(),
  openAIKey: z.string().optional(),
  googleGeminiKey: z.string().optional(),
});
