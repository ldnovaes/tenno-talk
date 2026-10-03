import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { useUpdatePreferences } from "@/features/auth/hooks/useUpdatePreferences";
import { profileKeys } from "@/features/auth/lib/queryKeys";
import { profileService } from "@/services/profileService";
import type { Audience } from "@/types/preferences";

import { SettingsGroup } from "../SettingsRow";

const AUDIENCES: Audience[] = ["everyone", "followers", "nobody"];

function AudienceSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="space-y-1.5 px-4 py-3">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AUDIENCES.map((audience) => (
            <SelectItem key={audience} value={audience}>
              {t(`settings.privacySection.${audience}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BlockedUsers() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const blocked = useQuery({
    queryKey: profileKeys.blocked(),
    queryFn: () => profileService.getBlockedUsers(),
  });
  const unblock = useMutation({
    mutationFn: (userId: string) => profileService.unblock(userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  });
  if (blocked.data?.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {t("settings.privacySection.noBlocked")}
      </p>
    );
  }
  return (
    <ul>
      {blocked.data?.map((profile) => (
        <li key={profile.id} className="flex items-center gap-3 px-4 py-2">
          <UserAvatar user={profile} size="sm" />
          <span className="min-w-0 flex-1 truncate font-medium">{profile.displayName}</span>
          <Button size="sm" variant="secondary" onClick={() => unblock.mutate(profile.id)}>
            {t("settings.privacySection.unblock")}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function PrivacySettings() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const update = useUpdatePreferences();
  const visibilityId = useId();
  const privacy = me.preferences.privacy;
  return (
    <>
      <SettingsGroup>
        <div className="space-y-1.5 px-4 py-3">
          <Label htmlFor={visibilityId}>{t("settings.privacySection.visibility")}</Label>
          <Select
            value={privacy.profileVisibility}
            onValueChange={(value) =>
              update.mutate({ privacy: { profileVisibility: value as "public" | "private" } })
            }
          >
            <SelectTrigger id={visibilityId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">{t("settings.privacySection.public")}</SelectItem>
              <SelectItem value="private">{t("settings.privacySection.private")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AudienceSelect
          label={t("settings.privacySection.whoCanMessage")}
          value={privacy.whoCanMessage}
          onChange={(value) => update.mutate({ privacy: { whoCanMessage: value as Audience } })}
        />
        <AudienceSelect
          label={t("settings.privacySection.whoCanComment")}
          value={privacy.whoCanComment}
          onChange={(value) => update.mutate({ privacy: { whoCanComment: value as Audience } })}
        />
      </SettingsGroup>
      <SettingsGroup title={t("settings.privacySection.blocked")}>
        <BlockedUsers />
      </SettingsGroup>
    </>
  );
}
