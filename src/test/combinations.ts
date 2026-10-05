/**
 * Cartesian product of named axes, for `it.each` matrices (PLAN.md §23.1):
 * `cartesian({ mode: MODES, own: [true, false] })` → `[{ mode, own }, …]`, every combination once.
 */
export function cartesian<Axes extends Record<string, readonly unknown[]>>(
  axes: Axes,
): { [K in keyof Axes]: Axes[K][number] }[] {
  type Row = { [K in keyof Axes]: Axes[K][number] };
  let rows: Partial<Row>[] = [{}];
  for (const key of Object.keys(axes) as (keyof Axes)[]) {
    const values = axes[key] ?? [];
    rows = rows.flatMap((row) => values.map((value) => ({ ...row, [key]: value })));
  }
  return rows as Row[];
}

/** Human-readable case name for a matrix row: `mode=both own=true`. */
export function caseName(row: Record<string, unknown>): string {
  return Object.entries(row)
    .map(
      ([key, value]) =>
        `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
    )
    .join(" ");
}
