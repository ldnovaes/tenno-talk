import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toAppError } from "@/lib/errors";
import { useSessionStore } from "@/stores/sessionStore";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { silent?: boolean };
    mutationMeta: { silent?: boolean };
  }
}

function notify(error: unknown) {
  const appError = toAppError(error);
  if (appError.code === "unauthenticated") {
    // Session expired on the server: guards send the user back to /welcome.
    useSessionStore.getState().setSession(null);
    return;
  }
  toast.error(appError.message);
}

/** Global error handling: simple errors become toasts (PLAN.md §11.3, §19). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (toAppError(error).code === "unauthenticated") return notify(error);
        // Only toast background refetch failures; first-load failures render an ErrorState.
        if (query.meta?.silent || query.state.data === undefined) return;
        notify(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return;
        notify(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => failureCount < 1 && toAppError(error).retryable,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: 0 },
    },
  });
}
