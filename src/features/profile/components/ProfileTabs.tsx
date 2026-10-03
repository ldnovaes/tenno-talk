import { ImageIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Posts (active) · Media · Tagged (placeholders until later phases). */
export function ProfileTabs({ posts }: { posts: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="posts" className="w-full">
      <TabsList
        aria-label={t("profile.tabs.label")}
        className="grid w-full grid-cols-3 rounded-none border-b bg-transparent p-0"
      >
        {(["posts", "media", "tagged"] as const).map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            className="rounded-none border-b-2 border-transparent py-2.5 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            {t(`profile.tabs.${tab}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="posts" className="mt-0">
        {posts}
      </TabsContent>
      {(["media", "tagged"] as const).map((tab) => (
        <TabsContent key={tab} value={tab}>
          <EmptyState icon={ImageIcon} title={t("profile.comingSoon")} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
