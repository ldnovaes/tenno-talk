import { useMutation } from "@tanstack/react-query";

import { saveJson } from "@/lib/download";
import { profileService } from "@/services/profileService";

/** LGPD right of access: downloads everything stored about the account. */
export function useExportData() {
  return useMutation({
    mutationFn: () => profileService.exportMyData(),
    onSuccess: (data) => saveJson("tenno-talk-data.json", data),
  });
}
