"use client";

import { BasicUser } from "app-types/user";
import { useEffect, useMemo } from "react";
import { SWRConfig, SWRConfiguration } from "swr";

export function SWRConfigProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: BasicUser;
}) {
  const config = useMemo<SWRConfiguration>(() => {
    return {
      focusThrottleInterval: 30000,
      dedupingInterval: 2000,
      errorRetryCount: 1,
      fallback: {
        "/api/user/details": user,
      },
    };
  }, [user]);

  useEffect(() => {
    console.log(
      "%c█▀▀ █   █▀▀ █▀█ █▀▀\n█▀▀ █▄▄ █▀▀ █▀▄ █▄▄\n\n%c⛓️ Just Flare.sh\nhttps://github.com/CyberZephrus/flare.sh",
      "color: #9333ea; font-weight: bold; font-family: monospace; font-size: 16px; text-shadow: 0 0 10px #9333ea;",
      "color: #888; font-size: 12px;",
    );
  }, []);
  return <SWRConfig value={config}>{children}</SWRConfig>;
}
