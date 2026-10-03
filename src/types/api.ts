export type ISODateString = string;

/** Cursor-based page returned by list endpoints. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
