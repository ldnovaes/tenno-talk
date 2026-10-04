import { create } from "zustand";
import { registerClientStateClearer } from "@/features/auth/lib/clearClientState";

const useDrafts = create<{
  values: Record<string, string>;
  set: (key: string, value: string) => void;
}>((set) => ({
  values: {},
  set: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
}));
registerClientStateClearer(() => useDrafts.setState({ values: {} }));
export function useContentDraft(
  key: string,
): [string, (value: string | ((current: string) => string)) => void] {
  const text = useDrafts((s) => s.values[key] ?? "");
  return [
    text,
    (value) =>
      useDrafts
        .getState()
        .set(
          key,
          typeof value === "function" ? value(useDrafts.getState().values[key] ?? "") : value,
        ),
  ];
}
