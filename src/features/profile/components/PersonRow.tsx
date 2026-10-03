import type { ReactNode } from "react";

import { CountryFlag } from "@/components/common/CountryFlag";
import { LanguageLabel } from "@/components/common/LanguageLabel";
import { UserAvatar } from "@/components/common/UserAvatar";
import type { UserProfile } from "@/types/user";

/** Compact person entry: avatar, name, country and native language. */
export function PersonRow({ profile, actions }: { profile: UserProfile; actions?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <UserAvatar user={profile} online={profile.isOnline} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{profile.displayName}</p>
        <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
          <CountryFlag code={profile.country} />
          <LanguageLabel code={profile.nativeLanguage} />
        </p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
