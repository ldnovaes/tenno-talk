import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { bubbleCorners } from "@/features/chat/components/message/bubbleStyles";
import { DeliveryTicks } from "@/features/chat/components/message/DeliveryTicks";
import type { BubblePosition } from "@/features/chat/lib/groupMessages";
import type { DeliveryStatus } from "@/types/message";
import { caseName, cartesian } from "@/test/combinations";

describe("bubbleCorners (position × own)", () => {
  // The sender's side holds the bubble's tail: its bottom corner is always tight, and the top one
  // tightens once the bubble follows another from the same sender. Logical corners keep it right in
  // RTL: `rounded-e{s|e}` is the bottom (block end) corner on the start/end side.
  const TIGHT_BOTTOM_ONLY: BubblePosition[] = ["single", "first"];
  const rows = cartesian({
    position: ["single", "first", "middle", "last"] as BubblePosition[],
    own: [true, false],
  });

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", (_name, { position, own }) => {
    const side = own ? "e" : "s";
    const expected = TIGHT_BOTTOM_ONLY.includes(position)
      ? `rounded-e${side}-md`
      : `rounded-${side}-md`;
    expect(bubbleCorners(position, own)).toBe(expected);
  });
});

describe("DeliveryTicks (every status)", () => {
  it.each([
    ["sending", "Sending", null],
    ["sent", "Sent", null],
    ["delivered", "Delivered", null],
    ["read", "Read", "text-primary"],
    ["failed", "Not sent", "text-destructive"],
  ] as [DeliveryStatus, string, string | null][])("%s → %s", (status, label, tone) => {
    render(<DeliveryTicks status={status} />);
    const icon = screen.getByRole("img", { name: label });
    for (const color of ["text-primary", "text-destructive"]) {
      if (color === tone) expect(icon).toHaveClass(color);
      else expect(icon).not.toHaveClass(color);
    }
  });

  it("delivered and read are told apart by more than color (label)", () => {
    const { rerender } = render(<DeliveryTicks status="delivered" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Delivered");
    rerender(<DeliveryTicks status="read" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Read");
  });
});
