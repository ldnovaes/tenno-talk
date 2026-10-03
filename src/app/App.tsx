import { AppShell } from "@/layouts/AppShell";

import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "./router/AppRoutes";

export function App() {
  return (
    <AppProviders>
      <AppRoutes shell={<AppShell data={{ me: null, badges: {} }} />} />
    </AppProviders>
  );
}
