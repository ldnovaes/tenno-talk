import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { FeedList } from "@/features/feed/components/FeedList";
import { useUnreadNotifications } from "@/features/notifications/hooks/useNotifications";
import { StoriesTray } from "@/features/stories/components/StoriesTray";
import { NavBadge } from "@/layouts/NavBadge";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { ContentColumn } from "@/layouts/ContentColumn";

export default function FeedPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const me = useCurrentUser();
  const unread = useUnreadNotifications().data ?? 0;
  return (
    <ContentColumn>
      <PageHeader
        title={t("feed.title")}
        actions={
          isMobile && (
            <Button asChild variant="ghost" size="icon">
              <Link
                to={paths.notifications()}
                aria-label={t("nav.notifications")}
                className="relative"
              >
                <Bell className="size-5" />
                <NavBadge count={unread} />
              </Link>
            </Button>
          )
        }
      />
      <div className="border-b pt-3">
        <StoriesTray me={me} />
      </div>
      <FeedList />
    </ContentColumn>
  );
}
