import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { listPending, updatePending } from "@/services/outbox/store";

export function usePendingSends() {
  const me = useCurrentUser();
  const client = useQueryClient();
  const key = ["outbox", me.id];
  const pending = useQuery({
    queryKey: key,
    queryFn: () => listPending(me.id),
    enabled: __USE_HTTP__,
    refetchInterval: 2000,
  });
  const action = useMutation({
    mutationFn: ({ id, discard }: { id: string; discard: boolean }) =>
      updatePending(id, (entry) => {
        if (entry?.userId !== me.id) return entry;
        return discard ? undefined : { ...entry, blocked: false, nextAttempt: 0 };
      }),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  return { pending, action };
}
