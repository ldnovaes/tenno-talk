import { cn } from "@/lib/utils";

/** Brand mark: two overlapping speech bubbles (two languages, one conversation). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M8 10.5A3.5 3.5 0 0 1 11.5 7h7A3.5 3.5 0 0 1 22 10.5v4a3.5 3.5 0 0 1-3.5 3.5H14l-3.6 2.7c-.4.3-.9 0-.9-.4V18A3.5 3.5 0 0 1 8 14.5z"
        className="fill-primary-foreground"
      />
      <path
        d="M24 13.6a3.5 3.5 0 0 1 1 2.4v4a3.5 3.5 0 0 1-1.5 2.9v2.2c0 .4-.5.7-.9.4L19 23h-3.5a3.5 3.5 0 0 1-2.6-1.2"
        className="fill-none stroke-primary-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-bold tracking-[0.14em]">TENNO TALK</span>
    </span>
  );
}
