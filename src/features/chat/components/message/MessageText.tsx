import { TranslatedText } from "@/features/translation/components/TranslatedText";
import type { MessageTranslationState } from "@/features/translation/hooks/useMessageTranslation";
import type { Message } from "@/types/message";

import { MetaSpacer } from "./BubbleMeta";

/** Message text through the translation layer (PLAN.md §14). */
export function MessageText({
  message,
  own,
  translation,
}: {
  message: Message;
  own: boolean;
  translation: MessageTranslationState;
}) {
  return (
    <TranslatedText
      state={translation}
      since={message.createdAt}
      trailing={
        <MetaSpacer own={own} translated={translation.display?.showing === "translation"} />
      }
    />
  );
}
