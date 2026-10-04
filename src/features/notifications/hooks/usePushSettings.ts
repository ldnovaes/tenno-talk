import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pushService } from "@/services/pushService";
export function usePushSettings() {
  const client = useQueryClient();
  const config = useQuery({ queryKey: ["push", "config"], queryFn: () => pushService.config() });
  const status = useQuery({ queryKey: ["push", "status"], queryFn: () => pushService.status() });
  const toggle = useMutation({
    mutationFn: () =>
      status.data ? pushService.disable() : pushService.enable(config.data?.publicKey ?? ""),
    onSettled: () => client.invalidateQueries({ queryKey: ["push"] }),
  });
  return { config, status, toggle, supported: pushService.supported() };
}
