import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation } from "react-router";

import { ErrorState } from "./ErrorState";

/** Per-route boundary: a failing screen never takes the whole app down. PLAN.md §19. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={[location.pathname]}
          fallbackRender={({ resetErrorBoundary }) => (
            <ErrorState onRetry={resetErrorBoundary} className="h-full" />
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
