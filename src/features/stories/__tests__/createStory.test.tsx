import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateStoryDialog } from "@/features/stories/components/CreateStoryDialog";
import { mockDb } from "@/services/mock/db";
import { renderWithProviders, signInAs } from "@/test/utils";

/** Creating a story: pick a photo or a video, optional text, share (PLAN.md §9.9). */
beforeEach(() => {
  signInAs("usr_rafael");
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/picked");
});
afterEach(() => vi.restoreAllMocks());

function render() {
  const onOpenChange = vi.fn();
  renderWithProviders(<CreateStoryDialog open onOpenChange={onOpenChange} />);
  return { onOpenChange, dialog: screen.getByRole("dialog", { name: "New story" }) };
}

const ownStories = () =>
  Object.values(mockDb.read().stories).filter((story) => story.authorId === "usr_rafael");

describe("CreateStoryDialog", () => {
  it("can't be shared before a photo or video is chosen", () => {
    const { dialog } = render();
    expect(within(dialog).getByRole("button", { name: "Share to story" })).toBeDisabled();
  });

  it("a photo with text is previewed, shared, and the dialog closes", async () => {
    const user = userEvent.setup();
    const before = ownStories().length;
    const { dialog, onOpenChange } = render();
    await user.upload(
      within(dialog).getByLabelText("Choose a photo or video"),
      new File(["x"], "beach.png", { type: "image/png" }),
    );
    await waitFor(() => expect(dialog.querySelector("img")).not.toBeNull());
    await user.type(within(dialog).getByLabelText("Text (optional)"), "Bom dia");
    await user.click(within(dialog).getByRole("button", { name: "Share to story" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const created = ownStories();
    expect(created).toHaveLength(before + 1);
    expect(created.at(-1)?.overlayText?.text).toBe("Bom dia");
  });

  it("a chosen video is previewed too, so the person sees what they picked", async () => {
    const user = userEvent.setup();
    const { dialog } = render();
    await user.upload(
      within(dialog).getByLabelText("Choose a photo or video"),
      new File(["x"], "clip.mp4", { type: "video/mp4" }),
    );
    await waitFor(() => expect(dialog.querySelector("video")).not.toBeNull(), { timeout: 5000 });
    expect(within(dialog).getByRole("button", { name: "Share to story" })).toBeEnabled();
  });
});
