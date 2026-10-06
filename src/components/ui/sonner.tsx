import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Sonner's stylesheet is not in a cascade layer, so it beats Tailwind's utilities: classes on the
 * toast never applied, and dark toasts came out pure black. Its own variables, set inline on the
 * toaster, carry the app's tokens instead.
 */
const tokens = {
  "--normal-bg": "var(--popover)",
  "--normal-bg-hover": "var(--muted)",
  "--normal-text": "var(--foreground)",
  "--normal-border": "var(--border)",
  "--normal-border-hover": "var(--border)",
} as CSSProperties;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={tokens}
      toastOptions={{ classNames: { description: "text-muted-foreground!" } }}
      {...props}
    />
  );
};

export { Toaster };
