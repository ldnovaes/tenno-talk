import { Flag, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { ReportDialog } from "@/features/moderation/components/ReportDialog";
import type { Post } from "@/types/post";

/** Actions on someone else's post (nothing to show on your own yet: no edit/delete, PLAN.md §34). */
export function PostMenu({ post }: { post: Post }) {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const [reporting, setReporting] = useState(false);
  if (post.author.id === me.id) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={t("feed.postMenu")}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setReporting(true)}>
            <Flag className="size-4" aria-hidden />
            {t("moderation.report")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog
        target={reporting ? { kind: "post", id: post.id } : null}
        onClose={() => setReporting(false)}
      />
    </>
  );
}
