import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Card } from "../Card";

describe("Card", () => {
  it("renders .card and merges a variant className", () => {
    const { container } = render(<Card className="rank-card">body</Card>);
    const div = container.firstElementChild;
    expect(div?.className).toBe("card rank-card");
    expect(div?.textContent).toBe("body");
  });

  it("is just .card with no extra className", () => {
    const { container } = render(<Card>x</Card>);
    expect(container.firstElementChild?.className).toBe("card");
  });
});
