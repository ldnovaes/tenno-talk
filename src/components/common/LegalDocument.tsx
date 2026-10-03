import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { env } from "@/lib/env";

import { PageHeader } from "./PageHeader";

/** Terms of Use / Privacy Policy reader. */
export function LegalDocument({ document }: { document: "terms" | "privacy" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sections = t(`legal.${document}.sections`, { returnObjects: true });
  return (
    <div className="min-h-app bg-background">
      <PageHeader title={t(`legal.${document}.title`)} onBack={() => navigate(-1)} />
      <article className="mx-auto max-w-2xl space-y-6 px-5 py-6">
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t("legal.provisional")} · {t("legal.version", { version: env.termsVersion })}
        </p>
        {sections.map((section) => (
          <section key={section.title} className="space-y-1.5">
            <h2 className="text-base font-semibold">{section.title}</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </article>
    </div>
  );
}
