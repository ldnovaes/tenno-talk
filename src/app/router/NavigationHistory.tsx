import { useRef, type ReactNode } from "react";
import { useLocation } from "react-router";
import { BackContext } from "./navigationHistoryContext";
export function NavigationHistory({ children }: { children: ReactNode }) {
  const location = useLocation();
  const history = useRef<string[]>([]);
  const index = history.current.indexOf(location.key);
  if (index < 0) history.current.push(location.key);
  else history.current = history.current.slice(0, index + 1);
  return <BackContext.Provider value={history.current.length > 1}>{children}</BackContext.Provider>;
}
