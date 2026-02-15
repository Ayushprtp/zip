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
      "%c  _____  _                 _____   _____ \n |  ___|| |       /\\      |  __ \\ |  ___|\n | |__  | |      /  \\     | |__) || |__  \n |  __| | |     / /\\ \\    |  _  / |  __| \n | |    | |____/ ____ \\   | | \\ \\ | |___ \n |_|    |______/_/    \\_\\  |_|  \\_\\|_____|\n\n\n%c⛓️ FLARE\nhttps://github.com/Flare-SH",
      "color: #9333ea; font-weight: bold; font-family: monospace; font-size: 16px; text-shadow: 0 0 10px #9333ea;",
      "color: #888; font-size: 12px;",
    );
  }, []);
  return <SWRConfig value={config}>{children}</SWRConfig>;
}
