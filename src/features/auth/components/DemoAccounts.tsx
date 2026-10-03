import { useTranslation } from "react-i18next";

import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";

import { useDemoSignIn } from "../hooks/useAuthActions";
import { DEMO_ACCOUNTS } from "../lib/demoAccounts";

export function DemoAccounts() {
  const { t } = useTranslation();
  const demo = useDemoSignIn();
  return (
    <section className="space-y-2" aria-labelledby="demo-title">
      <div>
        <h2 id="demo-title" className="text-sm font-semibold">
          {t("auth.demoTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("auth.demoDescription")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <Button
            key={account.userId}
            variant="outline"
            className="h-auto justify-start gap-2 py-2"
            disabled={demo.isPending}
            onClick={() => demo.mutate(account.userId)}
            aria-label={t("auth.demoAs", { name: account.name })}
          >
            <UserAvatar
              user={{ id: account.userId, displayName: account.name, avatarUrl: null }}
              size="xs"
            />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-sm">{account.name}</span>
              <span lang={account.language} className="text-xs font-normal text-muted-foreground">
                {account.languageLabel}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}
