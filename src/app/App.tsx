import { lazy, Suspense } from "react";

import { AppSplash } from "@/features/auth/components/AppSplash";
import { SessionGate } from "@/features/auth/components/SessionGate";

import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "./router/AppRoutes";

// The signed-in shell (chat, realtime, navigation) is its own chunk: the welcome and sign-in
// pages load without it (PLAN.md §22).
const ShellRoute = lazy(() =>
  import("./router/ShellRoute").then((m) => ({ default: m.ShellRoute })),
);

export function App() {
  return (
    <AppProviders>
      <SessionGate>
        <AppRoutes
          shell={
            <Suspense fallback={<AppSplash />}>
              <ShellRoute />
            </Suspense>
          }
        />
      </SessionGate>
    </AppProviders>
  );
}
