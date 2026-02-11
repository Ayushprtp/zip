"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { FullPageLoading } from "./loading-states";

import "./httpchain.css";

// Dynamically import the App component to avoid SSR issues with localStorage/window
const HttpChainApp = dynamic(() => import("../httpchain/App"), {
  ssr: false,
  loading: () => <FullPageLoading />,
});

export function HttpChainWrapper() {
  return (
    <div className="w-full h-full bg-background text-foreground httpchain-wrapper">
      <Suspense fallback={<FullPageLoading />}>
        <HttpChainApp />
      </Suspense>
    </div>
  );
}
