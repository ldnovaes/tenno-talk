import type { Message } from "@/types/message";

import { originalOf } from "../../lib/messageText";
import { MetaSpacer } from "./BubbleMeta";

/** Phase 3 text rendering: translation when ready, original otherwise. Replaced by TranslatedText in Phase 4. */
export function MessageText({ message, own }: { message: Message; own: boolean }) {
  const original = originalOf(message);
  if (!original) return null;
  const translated =
    !own && message.translation?.status === "translated" && message.translation.text
      ? message.translation
      : null;
  return (
    <p
      className="whitespace-pre-wrap break-words text-[15px] leading-[1.4]"
      lang={translated?.targetLanguage ?? original.language}
      dir="auto"
    >
      {translated?.text ?? original.text}
      <MetaSpacer own={own} />
    </p>
  );
}
