import { dayKey, dayLabel, type DayLabel } from "@/lib/dates";
import type { Message } from "@/types/message";

export type BubblePosition = "single" | "first" | "middle" | "last";

export interface GroupedMessage {
  message: Message;
  position: BubblePosition;
}

export interface SenderGroup {
  key: string;
  senderId: string;
  messages: GroupedMessage[];
}

export interface DaySection {
  key: string;
  label: DayLabel;
  groups: SenderGroup[];
}

const GROUP_WINDOW_MS = 5 * 60_000;

function positionOf(index: number, size: number): BubblePosition {
  if (size === 1) return "single";
  if (index === 0) return "first";
  if (index === size - 1) return "last";
  return "middle";
}

/**
 * Days → consecutive messages of the same sender within 5 minutes → bubble
 * position (drives corner radius and avatar). PLAN.md §13.6.
 */
export function groupMessages(messages: readonly Message[], now: Date): DaySection[] {
  const sections: DaySection[] = [];
  for (const message of messages) {
    const key = dayKey(message.createdAt);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      section = { key, label: dayLabel(message.createdAt, now), groups: [] };
      sections.push(section);
    }
    const group = section.groups[section.groups.length - 1];
    const previous = group?.messages[group.messages.length - 1]?.message;
    const sameGroup =
      group !== undefined &&
      previous !== undefined &&
      group.senderId === message.senderId &&
      new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
        GROUP_WINDOW_MS;
    if (sameGroup) {
      group.messages.push({ message, position: "single" });
    } else {
      section.groups.push({
        key: message.clientId ?? message.id,
        senderId: message.senderId,
        messages: [{ message, position: "single" }],
      });
    }
  }
  for (const section of sections) {
    for (const group of section.groups) {
      group.messages.forEach((item, index) => {
        item.position = positionOf(index, group.messages.length);
      });
    }
  }
  return sections;
}
