import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "../Button";

describe("Button", () => {
  it("is a primary <button> by default", () => {
    const { container } = render(<Button>Save</Button>);
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.className).toContain("btn-primary");
    expect(btn?.textContent).toBe("Save");
    expect(btn?.getAttribute("type")).toBe("button");
  });

  it("renders an <a> when href is provided", () => {
    const { container } = render(<Button href="/go">Go</Button>);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/go");
    expect(container.querySelector("button")).toBeNull();
  });

  it("applies the ghost variant and extra className", () => {
    const { container } = render(
      <Button variant="ghost" className="x">
        G
      </Button>,
    );
    const cls = container.querySelector("button")?.className ?? "";
    expect(cls).toContain("btn-ghost");
    expect(cls).toContain("x");
  });

  it("supports submit + disabled", () => {
    const { container } = render(
      <Button type="submit" disabled>
        S
      </Button>,
    );
    const btn = container.querySelector("button");
    expect(btn?.getAttribute("type")).toBe("submit");
    expect(btn?.disabled).toBe(true);
  });
});
