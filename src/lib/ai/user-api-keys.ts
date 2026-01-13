import "server-only";
import { getSession } from "auth/server";
import { userRepository } from "lib/db/repository";

/**
 * Get user's personal API keys from their preferences
 * Returns undefined if no keys are set
 */
export async function getUserApiKeys() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { openAIKey: undefined, googleGeminiKey: undefined };
    }

    const preferences = await userRepository.getPreferences(session.user.id);

    return {
      openAIKey: preferences?.openAIKey,
      googleGeminiKey: preferences?.googleGeminiKey,
    };
  } catch (error) {
    console.error("Failed to get user API keys:", error);
    return { openAIKey: undefined, googleGeminiKey: undefined };
  }
}
