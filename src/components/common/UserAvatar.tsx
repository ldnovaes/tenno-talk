import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

import { avatarColorFor, initialsOf } from "./avatarUtils";

const SIZES = {
  xs: "size-7 text-[11px]",
  sm: "size-9 text-sm",
  md: "size-12 text-base",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl md:size-28",
} as const;

const DOT_SIZES = {
  xs: "size-2.5",
  sm: "size-3",
  md: "size-3.5",
  lg: "size-4",
  xl: "size-5",
} as const;

interface UserAvatarProps {
  user: Pick<User, "id" | "displayName" | "avatarUrl">;
  size?: keyof typeof SIZES | undefined;
  online?: boolean | undefined;
  storyRing?: "unseen" | "seen" | null | undefined;
  className?: string | undefined;
}

export function UserAvatar({
  user,
  size = "md",
  online = false,
  storyRing = null,
  className,
}: UserAvatarProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex rounded-full",
          storyRing === "unseen" && "bg-primary p-[4px]",
          storyRing === "seen" && "bg-input p-[4px]",
        )}
      >
        <Avatar
          className={cn(
            SIZES[size],
            storyRing && "ring-2 ring-background",
            "select-none font-semibold",
          )}
        >
          {user.avatarUrl && (
            <AvatarImage src={user.avatarUrl} alt={user.displayName} className="object-cover" />
          )}
          <AvatarFallback
            className={cn(avatarColorFor(user.id), "text-white")}
            aria-label={user.displayName}
          >
            {initialsOf(user.displayName)}
          </AvatarFallback>
        </Avatar>
      </span>
      {online && (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 end-0 rounded-full bg-online ring-2 ring-background",
            DOT_SIZES[size],
          )}
        />
      )}
    </span>
  );
}
