import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Tabs } from "../Tabs";

const tabs = [
  { id: "a", label: "Alpha", content: <p>Content A</p> },
  { id: "b", label: "Beta", content: <p>Content B</p> },
];

describe("Tabs", () => {
  it("shows the first tab by default", () => {
    const { container, getByText } = render(<Tabs tabs={tabs} />);
    expect(getByText("Content A")).toBeTruthy();
    const firstTab = container.querySelector(".tab");
    expect(firstTab?.className).toContain("tab-active");
    expect(firstTab?.getAttribute("aria-selected")).toBe("true");
  });

  it("switches the panel when another tab is clicked", () => {
    const { getByText, queryByText } = render(<Tabs tabs={tabs} />);
    fireEvent.click(getByText("Beta"));
    expect(getByText("Content B")).toBeTruthy();
    expect(queryByText("Content A")).toBeNull();
  });

  it("respects the initial tab", () => {
    const { getByText, queryByText } = render(<Tabs tabs={tabs} initial="b" />);
    expect(getByText("Content B")).toBeTruthy();
    expect(queryByText("Content A")).toBeNull();
  });
});
