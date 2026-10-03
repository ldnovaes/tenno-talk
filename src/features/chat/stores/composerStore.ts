import { create } from "zustand";
import { persist } from "zustand/middleware";

import { registerClientStateClearer } from "@/features/auth/lib/clearClientState";
import type { SendMessageInput } from "@/services/chatService";
import type { MessageReference } from "@/types/message";

/** Per-conversation composer state: drafts survive navigation and reloads. */
interface ComposerState {
  drafts: Record<string, string>;
  replyTo: Record<string, MessageReference | null>;
  setDraft: (conversationId: string, text: string) => void;
  setReplyTo: (conversationId: string, reference: MessageReference | null) => void;
  clear: (conversationId: string) => void;
  reset: () => void;
}

export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      drafts: {},
      replyTo: {},
      setDraft: (conversationId, text) =>
        set((state) => ({ drafts: { ...state.drafts, [conversationId]: text } })),
      setReplyTo: (conversationId, reference) =>
        set((state) => ({ replyTo: { ...state.replyTo, [conversationId]: reference } })),
      clear: (conversationId) =>
        set((state) => ({
          drafts: { ...state.drafts, [conversationId]: "" },
          replyTo: { ...state.replyTo, [conversationId]: null },
        })),
      reset: () => set({ drafts: {}, replyTo: {} }),
    }),
    { name: "tenno.composer", partialize: (state) => ({ drafts: state.drafts }) },
  ),
);

/** Inputs of sends that failed, kept in memory so "retry" can resend the same clientId. */
export const failedSends = new Map<string, SendMessageInput>();

registerClientStateClearer(() => {
  useComposerStore.getState().reset();
  failedSends.clear();
});
