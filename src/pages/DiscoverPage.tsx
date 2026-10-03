import { Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { PageHeader } from "@/components/common/PageHeader";
import { useStartConversation } from "@/features/chat/hooks/useMessageMutations";
import { DiscoverFilters } from "@/features/discover/components/DiscoverFilters";
import { useDiscoverPeople } from "@/features/discover/hooks/useDiscoverPeople";
import { PersonCard, PersonCardSkeleton } from "@/features/profile/components/PersonCard";
import { ContentColumn } from "@/layouts/ContentColumn";
import type { LanguageCode } from "@/types/language";

export default function DiscoverPage() {
  const { t } = useTranslation();
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode | null>(null);
  const people = useDiscoverPeople({ nativeLanguage });
  const start = useStartConversation();
  const items = people.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <ContentColumn>
      <PageHeader title={t("discover.title")} />
      <p className="px-4 pb-3 pt-3 text-sm text-muted-foreground">{t("discover.subtitle")}</p>
      <DiscoverFilters nativeLanguage={nativeLanguage} onNativeLanguageChange={setNativeLanguage} />
      {people.isError && <ErrorState onRetry={() => void people.refetch()} />}
      {people.isSuccess && items.length === 0 && (
        <EmptyState
          icon={Users}
          title={t("discover.empty")}
          description={t("discover.emptyDescription")}
        />
      )}
      <div className="grid gap-3 px-4 pb-6 sm:grid-cols-2">
        {people.isPending && ["a", "b", "c", "d"].map((key) => <PersonCardSkeleton key={key} />)}
        {items.map((profile) => (
          <PersonCard
            key={profile.id}
            profile={profile}
            onMessage={(userId) => start.mutate(userId)}
          />
        ))}
      </div>
      {people.hasNextPage && (
        <InfiniteScrollTrigger
          onVisible={() => !people.isFetchingNextPage && void people.fetchNextPage()}
        />
      )}
      {people.isFetchingNextPage && (
        <p className="pb-6 text-center text-sm text-muted-foreground">{t("discover.loadMore")}</p>
      )}
    </ContentColumn>
  );
}
