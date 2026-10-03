import { Logo } from "@/components/common/Logo";

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-4">
      <Logo />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
