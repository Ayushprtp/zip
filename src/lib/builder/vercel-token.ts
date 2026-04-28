/**
 * Vercel Token Helper
 *
 * Resolves the Vercel token from cookie → DB fallback.
 * Used by all Vercel API routes.
 */

import { cookies } from "next/headers";
import { getSession } from "auth/server";
import { userRepository } from "lib/db/repository";

/**
 * Get the Vercel token — tries cookie first, then DB.
 * If restored from DB, also sets the cookie for future requests.
 */
export async function getVercelToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("vercel_token")?.value;
  if (cookieToken) return cookieToken;

  // Fall back to DB-persisted token
  try {
    const session = await getSession();
    if (session?.user?.id) {
      const prefs = await userRepository.getPreferences(session.user.id);
      if (prefs?.vercelToken) {
        // Restore cookie from DB
        cookieStore.set("vercel_token", prefs.vercelToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
        });
        return prefs.vercelToken;
      }
    }
  } catch {
    // Session/DB not available
  }

  return null;
}
