import { useTranslation } from "react-i18next";

import { OverlayLink } from "@/app/router/OverlayLink";
import { paths } from "@/app/router/paths";
import { CountryFlag } from "@/components/common/CountryFlag";
import { LanguageLabel } from "@/components/common/LanguageLabel";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import { getCountryName } from "@/lib/countries";
import type { UserProfile } from "@/types/user";

import { FollowButton } from "./FollowButton";

/** Discover card (PLAN.md §9.5). */
export function PersonCard({
  profile,
  onMessage,
}: {
  profile: UserProfile;
  onMessage: (userId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <OverlayLink
        to={paths.profile(profile.username)}
        className="flex items-center gap-3 rounded-xl"
      >
        <UserAvatar user={profile} size="lg" online={profile.isOnline} />
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{profile.displayName}</h2>
          <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CountryFlag code={profile.country} decorative />
            {getCountryName(profile.country)}
          </p>
        </div>
      </OverlayLink>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("profile.native")}</dt>
        <dd>
          <LanguageLabel code={profile.nativeLanguage} />
        </dd>
        {profile.learningLanguages.length > 0 && (
          <>
            <dt className="text-muted-foreground">{t("profile.learning")}</dt>
            <dd className="flex flex-wrap">
              {profile.learningLanguages.map((code, index) => (
                <span key={code}>
                  <LanguageLabel code={code} />
                  {index < profile.learningLanguages.length - 1 && (
                    <span className="me-1.5">,</span>
                  )}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
      {profile.bio && (
        <p className="line-clamp-2 text-sm" dir="auto" lang={profile.nativeLanguage}>
          {profile.bio}
        </p>
      )}
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={() => onMessage(profile.id)}>
          {t("profile.message")}
        </Button>
        <FollowButton profile={profile} />
      </div>
    </article>
  );
}

export function PersonCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="size-16 animate-pulse rounded-full bg-muted" />
        <span className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <span className="h-12 animate-pulse rounded bg-muted" />
      <span className="h-8 animate-pulse rounded bg-muted" />
    </div>
  );
}
