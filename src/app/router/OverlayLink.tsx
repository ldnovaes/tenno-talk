import type { ComponentProps } from "react";
import { Link, useLocation } from "react-router";

import { readBackground } from "./overlay";

type OverlayLinkProps = Omit<ComponentProps<typeof Link>, "state" | "to"> & { to: string };

export function OverlayLink({ to, ...props }: OverlayLinkProps) {
  const location = useLocation();
  const backgroundLocation = readBackground(location.state) ?? location;
  return <Link to={to} state={{ backgroundLocation }} {...props} />;
}
