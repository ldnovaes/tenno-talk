import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common/PageHeader";
import { DiscoverFeed } from "@/features/discover/components/DiscoverFeed";
import { ContentColumn } from "@/layouts/ContentColumn";

export default function DiscoverPage() {
  const { t } = useTranslation();
  return (
    <ContentColumn className="h-full">
      <PageHeader title={t("discover.title")} />
      <DiscoverFeed />
    </ContentColumn>
  );
}
