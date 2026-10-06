import { act, fireEvent, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLongPress } from "@/hooks/useLongPress";
import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

/** Message actions on a phone: a long press opens the drawer (PLAN.md §6.2, §9.4). */
afterEach(() => vi.useRealTimers());

const pointer = (pointerType: string, x = 0, y = 0) =>
  ({ pointerType, clientX: x, clientY: y }) as unknown as PointerEvent;

describe("useLongPress", () => {
  function setup() {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    return { onLongPress, handlers: () => result.current };
  }

  it("fires after holding a touch for 450 ms", () => {
    const { onLongPress, handlers } = setup();
    act(() => handlers().onPointerDown(pointer("touch")));
    act(() => vi.advanceTimersByTime(449));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "the mouse (desktop has its own menu)",
      (h: ReturnType<typeof useLongPress>) => h.onPointerDown(pointer("mouse")),
    ],
    [
      "lifting the finger early",
      (h: ReturnType<typeof useLongPress>) => {
        h.onPointerDown(pointer("touch"));
        h.onPointerUp();
      },
    ],
    [
      "scrolling (moving more than 10 px)",
      (h: ReturnType<typeof useLongPress>) => {
        h.onPointerDown(pointer("touch", 0, 0));
        h.onPointerMove(pointer("touch", 0, 11));
      },
    ],
    [
      "the system cancelling the touch",
      (h: ReturnType<typeof useLongPress>) => {
        h.onPointerDown(pointer("pen"));
        h.onPointerCancel();
      },
    ],
  ])("never fires for %s", (_name, gesture) => {
    const { onLongPress, handlers } = setup();
    act(() => gesture(handlers()));
    act(() => vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("a small wobble while holding still counts", () => {
    const { onLongPress, handlers } = setup();
    act(() => {
      handlers().onPointerDown(pointer("touch", 0, 0));
      handlers().onPointerMove(pointer("touch", 5, 8));
    });
    act(() => vi.advanceTimersByTime(450));
    expect(onLongPress).toHaveBeenCalledOnce();
  });
});

describe("message actions on a phone (375 px)", () => {
  async function openDrawerOn(text: string) {
    setViewportWidth(375);
    signInAs("usr_rafael");
    renderApp("/chats/conv_rafael_linh");
    const log = await screen.findByRole("log", { name: "Messages" });
    const bubble = (await within(log).findByText(text)).closest("[id^=message-]");
    if (!(bubble instanceof HTMLElement)) throw new Error("bubble");
    const target = within(bubble).getByText(text);
    fireEvent.pointerDown(target, { pointerType: "touch", clientX: 10, clientY: 10 });
    return screen.findByRole("dialog", { name: "Message actions" }, { timeout: 3000 });
  }

  it("a long press opens the drawer with reactions and actions; choosing one closes it", async () => {
    // Rafael's own latest message ("lc_cant_wait"), shown in its original.
    const drawer = await openDrawerOn("Perfeito. Mal posso esperar!");
    expect(within(drawer).getByRole("button", { name: /React 👍/ })).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("button", { name: "Reply" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Message actions" })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/Replying to/)).toBeInTheDocument();
  });

  it("a message that failed offers actions but no reactions", async () => {
    mockDb.update((db) => {
      const own = Object.values(db.messages)
        .filter((m) => m.conversationId === "conv_rafael_linh" && m.senderId === "usr_rafael")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (own && own.content.type === "text") {
        own.statusOverride = "failed";
        own.content.body.text = "Esta falhou";
      }
    });
    const drawer = await openDrawerOn("Esta falhou");
    expect(within(drawer).queryByRole("button", { name: /React/ })).not.toBeInTheDocument();
  });
});
