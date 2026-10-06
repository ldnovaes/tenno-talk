import { useEffect, useRef } from "react";

import { listPending, released, updatePending } from "@/services/outbox/store";
import type { SendRestriction } from "@/types/conversation";

import { liftedRestrictions, refusedIn } from "../lib/outboxQueue";
import { useConversations } from "./useConversations";

/**
 * A message refused while the conversation couldn't send (a block, "People I follow") goes out by itself once
 * the restriction is lifted: unblocking, a follow back or a settings change (PLAN.md §31.1).
 */
export function useReleaseLiftedSends(userId: string) {
  const conversations = useConversations();
  const seen = useRef(new Map<string, SendRestriction | null>());
  useEffect(() => {
    if (!__USE_HTTP__ || !conversations.data) return;
    const lifted = liftedRestrictions(seen.current, conversations.data);
    seen.current = new Map(conversations.data.map((c) => [c.id, c.sendRestriction]));
    if (lifted.length === 0) return;
    void listPending(userId)
      .then((pending) =>
        Promise.all(
          lifted
            .flatMap((conversationId) => refusedIn(pending, conversationId))
            .map((entry) =>
              updatePending(entry.key, (e) => (e ? { ...released(e), leaseUntil: 0 } : e)),
            ),
        ),
      )
      .catch(() => undefined);
  }, [conversations.data, userId]);
}
