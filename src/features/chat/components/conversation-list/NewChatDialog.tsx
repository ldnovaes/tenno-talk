import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonRow } from "@/features/profile/components/PersonRow";

import { useStartConversation } from "../../hooks/useMessageMutations";
import { usePeopleSearch } from "../../hooks/usePeopleSearch";

export function NewChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const people = usePeopleSearch(query);
  const start = useStartConversation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-3 p-0 sm:max-w-md">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{t("chat.newChatDialog.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("chat.newChatDialog.search")}
          </DialogDescription>
        </DialogHeader>
        <div className="px-5">
          <Input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("chat.newChatDialog.search")}
            aria-label={t("chat.newChatDialog.search")}
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {people.isPending &&
            ["a", "b", "c"].map((key) => (
              <li key={key} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-12 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </li>
            ))}
          {people.data?.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">
              {t("chat.newChatDialog.empty")}
            </li>
          )}
          {people.data?.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                disabled={start.isPending}
                onClick={() => start.mutate(profile.id, { onSuccess: () => onOpenChange(false) })}
                className="w-full rounded-xl px-3 text-start transition-colors hover:bg-muted"
              >
                <PersonRow profile={profile} />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
