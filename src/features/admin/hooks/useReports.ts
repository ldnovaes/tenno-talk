import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminService } from "@/services/adminService";
import type { ReportStatus } from "@/types/moderation";

import { adminKeys } from "../lib/queryKeys";

export function useReports(status: ReportStatus) {
  return useQuery({
    queryKey: adminKeys.reports(status),
    queryFn: () => adminService.listReports(status),
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "reviewed" | "dismissed" }) =>
      adminService.resolveReport(id, status),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "reports"] }),
  });
}
