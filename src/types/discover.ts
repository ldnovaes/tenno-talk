import type { ISODateString } from "./api";

/** What the client reports about posts it showed (PLAN.md §37.5); likes and comments are recorded by the server. */
export type DiscoverEventKind =
  "impression" | "dwell" | "share" | "profile_open" | "hide_post" | "hide_author";

export interface DiscoverEvent {
  /** Idempotency key: the server ignores a repeated one. */
  clientId: string;
  postId: string;
  kind: DiscoverEventKind;
  /** Visible milliseconds, for "dwell". */
  value?: number;
  at: ISODateString;
}
