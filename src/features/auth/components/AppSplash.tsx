import { LogoMark } from "@/components/common/Logo";

/** Boot screen while the session and the current user load. */
export function AppSplash() {
  return (
    <div className="grid h-app place-items-center bg-background" aria-busy="true">
      <LogoMark className="size-14 animate-pulse" />
    </div>
  );
}
