import { createContext, useContext } from "react";

import type { Message } from "@/types/message";

/** Actions provided once by the message list (no prop drilling through bubbles). */
export interface MessageActionsValue {
  viewerId: string;
  senderName: (senderId: string) => string;
  reply: (message: Message) => void;
  forward: (message: Message) => void;
  react: (message: Message, emoji: string) => void;
  copy: (text: string) => void;
  retry: (clientId: string) => void;
  discard: (clientId: string) => void;
}

export const MessageActionsContext = createContext<MessageActionsValue | null>(null);

export function useMessageActionsContext(): MessageActionsValue {
  const value = useContext(MessageActionsContext);
  if (!value) throw new Error("MessageActionsContext missing");
  return value;
}
