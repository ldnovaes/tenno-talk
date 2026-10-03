import type { ReactNode } from "react";

/** Centered card on md+, full screen on mobile. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-app w-full items-stretch justify-center bg-background md:items-center md:bg-chat-bg md:p-6">
      <div className="flex w-full flex-col pt-safe pb-safe md:max-w-[440px] md:rounded-2xl md:border md:bg-background md:shadow-sm">
        {children}
      </div>
    </div>
  );
}
