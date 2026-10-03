import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { paths } from "@/app/router/paths";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { clearClientState } from "@/features/auth/lib/clearClientState";
import { profileService } from "@/services/profileService";
import { useSessionStore } from "@/stores/sessionStore";

/** LGPD right to erasure (PLAN.md §31). */
export function DeleteAccountButton() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const remove = useMutation({
    mutationFn: () => profileService.deleteAccount(),
    onSuccess: () => {
      queryClient.clear();
      clearClientState();
      setSession(null);
      navigate(paths.welcome(), { replace: true });
    },
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full text-destructive">
          {t("settings.accountSection.deleteAccount")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("settings.accountSection.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("settings.accountSection.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => remove.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("settings.accountSection.deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
