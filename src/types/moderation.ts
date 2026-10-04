import type { ISODateString } from "./api";

export type ReportTargetKind = "user" | "message" | "post" | "comment" | "story";

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportTarget {
  kind: ReportTargetKind;
  id: string;
}

export type ReportStatus = "open" | "reviewed" | "dismissed";

/** What an admin sees (PLAN.md §31). */
export interface Report {
  id: string;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  status: ReportStatus;
  createdAt: ISODateString;
  reporterId: string;
  reporterUsername: string;
}
