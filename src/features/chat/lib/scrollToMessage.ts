/** Brings a quoted message into view and flashes it. */
export function scrollToMessage(messageId: string) {
  const element = document.getElementById(`message-${messageId}`);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 700 });
}
