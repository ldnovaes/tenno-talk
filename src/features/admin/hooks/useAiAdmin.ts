import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminService } from "@/services/adminService";

import { adminKeys } from "../lib/queryKeys";

/** Polls while the page is open: a device login completes on the server. */
export function useAiStatus() {
  return useQuery({
    queryKey: adminKeys.ai(),
    queryFn: () => adminService.getAiStatus(),
    refetchInterval: 5_000,
  });
}

export function useCheckProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => adminService.checkProvider(provider),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: adminKeys.ai() }),
  });
}

export function useStartReauth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => adminService.startReauth(provider),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: adminKeys.ai() }),
  });
}
