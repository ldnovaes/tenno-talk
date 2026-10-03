import { SessionGate } from "@/features/auth/components/SessionGate";

import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "./router/AppRoutes";
import { ShellRoute } from "./router/ShellRoute";

export function App() {
  return (
    <AppProviders>
      <SessionGate>
        <AppRoutes shell={<ShellRoute />} />
      </SessionGate>
    </AppProviders>
  );
}
