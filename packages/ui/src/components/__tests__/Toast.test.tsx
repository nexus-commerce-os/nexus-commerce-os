import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "../Toast";

function Trigger() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => toast("Saved.", { tone: "accent", duration: 999999 })}
    >
      fire
    </button>
  );
}

describe("Toast", () => {
  it("renders a toast with the requested tone when fired", () => {
    const { getByText, container } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(getByText("fire"));
    expect(getByText("Saved.")).toBeTruthy();
    expect(container.querySelector(".toast-accent")).not.toBeNull();
  });

  it("dismisses a toast when its close button is clicked", () => {
    const { getByText, getByLabelText, queryByText } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(getByText("fire"));
    expect(queryByText("Saved.")).not.toBeNull();
    fireEvent.click(getByLabelText("Dismiss"));
    expect(queryByText("Saved.")).toBeNull();
  });

  it("throws when useToast is used outside a provider", () => {
    function Bad() {
      useToast();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
