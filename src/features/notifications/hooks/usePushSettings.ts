import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { pushService } from "@/services/pushService";
import { useDevicePreferencesStore } from "@/stores/devicePreferencesStore";

import { pushOffer } from "../lib/pushOffer";

export function usePushSettings() {
  const client = useQueryClient();
  const config = useQuery({ queryKey: ["push", "config"], queryFn: () => pushService.config() });
  const status = useQuery({ queryKey: ["push", "status"], queryFn: () => pushService.status() });
  const toggle = useMutation({
    mutationFn: () =>
      status.data ? pushService.disable() : pushService.enable(config.data?.publicKey ?? ""),
    onSettled: () => client.invalidateQueries({ queryKey: ["push"] }),
  });
  return {
    config,
    status,
    toggle,
    supported: pushService.supported(),
    permission: pushService.permission(),
  };
}

/** Whether to invite this device to turn push on (Notifications page). */
export function usePushOffer() {
  const push = usePushSettings();
  const dismissedAt = useDevicePreferencesStore((state) => state.pushPromptDismissedAt);
  const dismiss = useDevicePreferencesStore((state) => state.dismissPushPrompt);
  const offer =
    push.config.isSuccess && push.status.isSuccess
      ? pushOffer({
          enabled: push.config.data.enabled,
          supported: push.supported,
          needsInstall: pushService.needsInstall(),
          permission: push.permission,
          subscribed: push.status.data,
          dismissedAt,
          now: Date.now(),
        })
      : null;
  return { offer, enable: () => push.toggle.mutate(), pending: push.toggle.isPending, dismiss };
}
