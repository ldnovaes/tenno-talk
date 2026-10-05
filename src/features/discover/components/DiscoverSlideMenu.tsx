import { EyeOff, Flag, MoreHorizontal, UserX } from "lucide-react";
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
import type { Post } from "@/types/post";

import { useNotInterested } from "../hooks/useNotInterested";

/** "Not interested" for the post or its author, and report (PLAN.md §37.7). */
export function DiscoverSlideMenu({ post }: { post: Post }) {
  const { t } = useTranslation();
  const hide = useNotInterested();
  const [reporting, setReporting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("discover.menu")}
            className="text-white drop-shadow hover:bg-white/10 hover:text-white"
          >
            <MoreHorizontal className="size-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => hide(post, "post")}>
            <EyeOff className="size-4" aria-hidden />
            {t("discover.notInterested")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => hide(post, "author")}>
            <UserX className="size-4" aria-hidden />
            {t("discover.hideAuthor", { username: post.author.username })}
          </DropdownMenuItem>
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
