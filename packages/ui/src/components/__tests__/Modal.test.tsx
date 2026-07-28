import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        hidden
      </Modal>,
    );
    expect(container.querySelector(".modal")).toBeNull();
  });

  it("renders a labelled dialog with title and body when open", () => {
    const { container, getByText } = render(
      <Modal open onClose={() => {}} title="Confirm">
        Body copy
      </Modal>,
    );
    const dialog = container.querySelector(".modal");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(getByText("Confirm")).toBeTruthy();
    expect(getByText("Body copy")).toBeTruthy();
  });

  it("closes on backdrop click and Escape", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="X">
        B
      </Modal>,
    );
    const overlay = container.querySelector(".modal-overlay");
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close when the dialog surface itself is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="X">
        B
      </Modal>,
    );
    const dialog = container.querySelector(".modal");
    if (dialog) fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });
});
