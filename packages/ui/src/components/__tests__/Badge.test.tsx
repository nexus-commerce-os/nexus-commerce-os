import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("defaults to the neutral tone", () => {
    const { container } = render(<Badge>New</Badge>);
    expect(container.querySelector("span")?.className).toBe("badge badge-neutral");
  });

  it("applies a tone", () => {
    const { container } = render(<Badge tone="danger">Bounced</Badge>);
    expect(container.querySelector("span")?.className).toContain("badge-danger");
  });
});
