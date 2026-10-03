import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonRow } from "@/features/profile/components/PersonRow";

import { useCreateGroup } from "../../hooks/useMessageMutations";
import { usePeopleSearch } from "../../hooks/usePeopleSearch";

export function NewGroupForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const nameId = useId();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const people = usePeopleSearch(query);
  const create = useCreateGroup();

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ title, memberIds: selected }, { onSuccess: onCreated });
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="space-y-1.5 px-5">
        <Label htmlFor={nameId}>{t("groups.name")}</Label>
        <Input
          id={nameId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("groups.namePlaceholder")}
        />
      </div>
      <div className="px-5">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("chat.newChatDialog.search")}
          aria-label={t("chat.newChatDialog.search")}
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-3" aria-label={t("groups.members")}>
        {people.data?.map((profile) => {
          const id = `group-member-${profile.id}`;
          return (
            <li key={profile.id}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-muted"
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(profile.id)}
                  aria-label={profile.displayName}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked === true
                        ? [...current, profile.id]
                        : current.filter((value) => value !== profile.id),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <PersonRow profile={profile} />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
        <span className="text-sm text-muted-foreground">
          {t("groups.selected", { count: selected.length })}
        </span>
        <Button type="submit" disabled={!title.trim() || selected.length < 2 || create.isPending}>
          {t("groups.create")}
        </Button>
      </div>
    </form>
  );
}
