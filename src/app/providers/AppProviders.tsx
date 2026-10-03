import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { I18nextProvider, useTranslation } from "react-i18next";
import { BrowserRouter } from "react-router";

import { i18n } from "@/app/i18n";
import { createQueryClient } from "@/app/queryClient";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ThemeProvider } from "./ThemeProvider";
import { useResolvedTheme } from "./useResolvedTheme";

function AppErrorFallback() {
  const { t } = useTranslation();
  return (
    <div role="alert" className="grid min-h-app place-items-center bg-background p-6 text-center">
      <div className="max-w-sm space-y-3">
        <h1 className="text-lg font-semibold">{t("errors.appTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("errors.appDescription")}</p>
        <Button onClick={() => window.location.reload()}>{t("errors.reload")}</Button>
      </div>
    </div>
  );
}

function ThemedToaster() {
  const theme = useResolvedTheme();
  return <Toaster theme={theme} position="top-center" richColors closeButton />;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary FallbackComponent={AppErrorFallback}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TooltipProvider delayDuration={300}>
              <BrowserRouter>{children}</BrowserRouter>
              <ThemedToaster />
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </I18nextProvider>
  );
}
