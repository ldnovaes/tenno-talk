/** Small heading above a group of rows (settings groups, notification periods). */
export function SectionTitle({ id, children }: { id?: string; children: string }) {
  return (
    <h2 id={id} className="px-4 pb-1 pt-2 text-sm font-semibold text-primary">
      {children}
    </h2>
  );
}
