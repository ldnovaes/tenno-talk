import { createContext, useContext } from "react";

/** Lets a page know it is rendered inside the side panel (desktop overlay). */
export const PanelContext = createContext<{ close: () => void } | null>(null);

export function usePanel() {
  return useContext(PanelContext);
}
