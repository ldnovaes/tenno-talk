import { useSyncExternalStore } from "react";

import { realtimeClient } from "@/services/realtime/realtimeClient";

export function useRealtimeStatus() {
  return useSyncExternalStore(
    (onChange) => realtimeClient.onStatusChange(onChange),
    () => realtimeClient.getStatus(),
  );
}
