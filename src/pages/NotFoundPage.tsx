import { Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/router/paths";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-app place-items-center bg-background">
      <EmptyState
        icon={Compass}
        title={t("errors.notFoundTitle")}
        description={t("errors.notFoundDescription")}
        action={
          <Button asChild>
            <Link to={paths.home()}>{t("errors.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
