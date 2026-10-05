import { useUserStories } from "@/features/stories/hooks/useStories";
import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { useTranslation } from "react-i18next";

import { CountryFlag } from "@/components/common/CountryFlag";
import { LanguageLabel } from "@/components/common/LanguageLabel";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import { getCountryName } from "@/lib/countries";
import type { UserProfile } from "@/types/user";

import { FollowButton } from "./FollowButton";

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwn: boolean;
  onMessage?: (() => void) | undefined;
  onEdit?: (() => void) | undefined;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** Social profile header (PLAN.md §9.6). */
export function ProfileHeader({ profile, isOwn, onMessage, onEdit }: ProfileHeaderProps) {
  const { t } = useTranslation();
  const stories = useUserStories(profile.id);
  const navigate = useOverlayNavigate();
  // Someone who blocked the viewer appears only by name (PLAN.md §31.1); any block removes the actions.
  const minimal = profile.blockStatus === "blocked_me";
  const blocked = profile.blockStatus !== "none";
  return (
    <section className="flex flex-col items-center gap-4 px-5 pb-4 pt-6 text-center">
      {stories.data?.length ? (
        <button
          type="button"
          onClick={() => navigate(paths.story(profile.id))}
          aria-label={t("stories.open", { name: profile.displayName })}
        >
          <UserAvatar
            user={profile}
            size="xl"
            storyRing={stories.data.some((story) => !story.viewedByMe) ? "unseen" : "seen"}
          />
        </button>
      ) : (
        <UserAvatar user={profile} size="xl" online={!isOwn && profile.isOnline} />
      )}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">{profile.displayName}</h2>
        <p className="text-sm text-muted-foreground">@{profile.username}</p>
        {profile.country && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <CountryFlag code={profile.country} decorative />
            {getCountryName(profile.country)}
          </p>
        )}
      </div>
      {profile.bio && (
        <p
          className="max-w-sm whitespace-pre-wrap text-[15px]"
          dir="auto"
          lang={profile.nativeLanguage}
        >
          {profile.bio}
        </p>
      )}
      {!minimal && (
        <dl className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-accent-foreground">
            <dt className="font-medium">{t("profile.native")}</dt>
            <dd>
              <LanguageLabel code={profile.nativeLanguage} />
            </dd>
          </div>
          {profile.learningLanguages.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <dt className="font-medium">{t("profile.learning")}</dt>
              <dd className="flex gap-1.5">
                {profile.learningLanguages.map((code, index) => (
                  <span key={code}>
                    <LanguageLabel code={code} />
                    {index < profile.learningLanguages.length - 1 && ","}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
      {!minimal && (
        <div className="flex gap-8">
          <Stat value={profile.postsCount} label={t("profile.posts")} />
          <Stat value={profile.followersCount} label={t("profile.followers")} />
          <Stat value={profile.followingCount} label={t("profile.following")} />
        </div>
      )}
      {(isOwn || !blocked) && (
        <div className="flex w-full max-w-xs gap-2">
          {isOwn ? (
            <Button variant="secondary" className="flex-1" onClick={onEdit}>
              {t("profile.editProfile")}
            </Button>
          ) : (
            <>
              <FollowButton profile={profile} size="default" className="flex-1" />
              <Button variant="secondary" className="flex-1" onClick={onMessage}>
                {t("profile.message")}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
