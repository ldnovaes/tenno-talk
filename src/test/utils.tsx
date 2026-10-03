import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";

import { i18n } from "@/app/i18n";
import { createQueryClient } from "@/app/queryClient";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { AppRoutes } from "@/app/router/AppRoutes";
import { ShellRoute } from "@/app/router/ShellRoute";
import { SessionGate } from "@/features/auth/components/SessionGate";
import { writeMockSession } from "@/services/mock/session";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** The app's client (global error toasts, session expiry) without retries. */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retry: false, gcTime: Infinity },
    mutations: { retry: 0 },
  });
  return client;
}

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  queryClient?: QueryClient;
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { route = "/", queryClient = createTestQueryClient(), ...rest } = options;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TooltipProvider>
              <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </I18nextProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...rest }) };
}

/** Signs in on the mock backend (as if the session cookie existed). */
export function signInAs(userId: string) {
  writeMockSession(userId);
}

/** Renders the whole app (session gate + routes) at a route. */
export function renderApp(route: string, options: Omit<Options, "route"> = {}) {
  return renderWithProviders(
    <SessionGate>
      <AppRoutes shell={<ShellRoute />} />
    </SessionGate>,
    { ...options, route },
  );
}
