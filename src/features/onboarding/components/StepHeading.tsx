export function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1.5 pb-5 pt-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-[15px] text-muted-foreground">{description}</p>
    </div>
  );
}
