import SignIn from "@/components/auth/sign-in";
import { getAuthConfig } from "lib/auth/config";
import { getIsFirstUser, getSession } from "lib/auth/server";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }
  const isFirstUser = await getIsFirstUser();
  const {
    emailAndPasswordEnabled,
    signUpEnabled,
    socialAuthenticationProviders,
  } = getAuthConfig();
  const enabledProviders = (
    Object.keys(
      socialAuthenticationProviders,
    ) as (keyof typeof socialAuthenticationProviders)[]
  ).filter((key) => socialAuthenticationProviders[key]);
  return (
    <SignIn
      emailAndPasswordEnabled={emailAndPasswordEnabled}
      signUpEnabled={signUpEnabled}
      socialAuthenticationProviders={enabledProviders}
      isFirstUser={isFirstUser}
    />
  );
}
