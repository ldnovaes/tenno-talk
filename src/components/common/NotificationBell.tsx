import { Bell } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { paths } from "@/app/router/paths";
import { useUnreadNotifications } from "@/features/notifications/hooks/useNotifications";
import { NavBadge } from "@/layouts/NavBadge";
import { Button } from "@/components/ui/button";

export function NotificationBell() {
  const { t } = useTranslation();
  const count = useUnreadNotifications().data ?? 0;
  return (
    <Button asChild variant="ghost" size="icon">
      <Link
        to={paths.notifications()}
        className="relative"
        aria-label={`${t("nav.notifications")}${count ? ` (${count})` : ""}`}
      >
        <Bell className="size-5" />
        <NavBadge count={count} />
      </Link>
    </Button>
  );
}
