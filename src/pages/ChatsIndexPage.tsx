import { MessagesSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";

/** Desktop placeholder in the conversation pane (mobile shows the list instead). */
export default function ChatsIndexPage() {
  const { t } = useTranslation();
  return (
    <div className="grid h-full place-items-center">
      <EmptyState
        icon={MessagesSquare}
        title={t("chat.empty.selectTitle")}
        description={t("chat.empty.selectDescription")}
      />
    </div>
  );
}
