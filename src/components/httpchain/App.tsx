import { lazy, Suspense } from "react";
import { useAppStore } from "./store";
import { ChainList } from "./features/home/components/ChainList";
import { Shell } from "./shared/components/layout/Shell";
import { BackendUrlDialog } from "./shared/components/BackendUrlDialog";
import { Skeleton } from "./components/ui/skeleton";

// Lazy load Editor (contains React Flow which is heavy)
const Editor = lazy(() => import("./features/editor/components/Editor"));

function EditorSkeleton() {
  return (
    <div className="h-full flex">
      {/* Left sidebar skeleton */}
      <div className="w-64 border-r bg-card p-4 space-y-4">
        <Skeleton className="h-8 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </div>

      {/* Canvas area skeleton */}
      <div className="flex-1 bg-canvas relative">
        {/* Fake nodes */}
        <div className="absolute top-20 left-20">
          <Skeleton className="h-16 w-48 rounded-xl" />
        </div>
        <div className="absolute top-20 left-80">
          <Skeleton className="h-16 w-56 rounded-xl" />
        </div>
        <div className="absolute top-48 left-52">
          <Skeleton className="h-14 w-44 rounded-xl" />
        </div>

        {/* Controls skeleton */}
        <div className="absolute bottom-4 left-4 flex gap-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const selectedChainId = useAppStore((s) => s.selectedChainId);
  const backendDialogDismissed = useAppStore((s) => s.backendDialogDismissed);
  const setBackendDialogDismissed = useAppStore(
    (s) => s.setBackendDialogDismissed,
  );

  return (
    <>
      {/* Initial backend dialog on page load */}
      <BackendUrlDialog
        open={!backendDialogDismissed}
        onClose={() => setBackendDialogDismissed(true)}
      />

      <Shell>
        {selectedChainId ? (
          <Suspense fallback={<EditorSkeleton />}>
            <Editor />
          </Suspense>
        ) : (
          <ChainList />
        )}
      </Shell>
    </>
  );
}
