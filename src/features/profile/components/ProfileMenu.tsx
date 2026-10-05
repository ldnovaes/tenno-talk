import { Flag, MoreHorizontal, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/features/moderation/components/ReportDialog";
import type { UserProfile } from "@/types/user";

import { useBlockUser, useUnblockUser } from "../hooks/useProfile";
import { BlockUserDialog } from "./BlockUserDialog";

/** Report and Block/Unblock on another person's profile; nothing to offer on a profile that blocked you. */
export function ProfileMenu({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  const block = useBlockUser();
  const unblock = useUnblockUser();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  if (profile.blockStatus === "blocked_me") return null;
  const target = { userId: profile.id, name: profile.displayName };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("profile.menu")}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setReporting(true)}>
            <Flag className="size-4" aria-hidden />
            {t("moderation.report")}
          </DropdownMenuItem>
          {profile.blockStatus === "blocked_by_me" ? (
            <DropdownMenuItem onSelect={() => unblock.mutate(target)}>
              <UserCheck className="size-4" aria-hidden />
              {t("profile.unblock", { name: profile.displayName })}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmBlock(true)}>
              <UserX className="size-4" aria-hidden />
              {t("profile.block", { name: profile.displayName })}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog
        target={reporting ? { kind: "user", id: profile.id } : null}
        onClose={() => setReporting(false)}
      />
      <BlockUserDialog
        name={profile.displayName}
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        onConfirm={() => block.mutate(target)}
      />
    </>
  );
}
