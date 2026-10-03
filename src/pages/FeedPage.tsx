import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { FeedList } from "@/features/feed/components/FeedList";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { ContentColumn } from "@/layouts/ContentColumn";

export default function FeedPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  return (
    <ContentColumn>
      <PageHeader
        title={t("feed.title")}
        actions={
          isMobile && (
            <Button asChild variant="ghost" size="icon">
              <Link to={paths.notifications()} aria-label={t("nav.notifications")}>
                <Bell className="size-5" />
              </Link>
            </Button>
          )
        }
      />
      <FeedList />
    </ContentColumn>
  );
}
