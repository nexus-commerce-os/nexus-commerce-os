import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Field } from "../Field";

describe("Field", () => {
  it("renders a label tied to the input by id", () => {
    const { container } = render(
      <Field label="Email" id="email" type="email" placeholder="you@x.com" />,
    );
    const label = container.querySelector("label");
    const input = container.querySelector("input");
    expect(label?.textContent).toBe("Email");
    expect(label?.getAttribute("for")).toBe("email");
    expect(input?.getAttribute("id")).toBe("email");
    expect(input?.getAttribute("type")).toBe("email");
  });

  it("shows an error and sets aria-invalid", () => {
    const { container } = render(<Field label="Email" error="Bad email" />);
    expect(container.querySelector(".field-error")?.textContent).toBe("Bad email");
    expect(container.querySelector("input")?.getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(container.querySelector("input")?.className).toContain("input-error");
  });

  it("shows a hint when there is no error", () => {
    const { container } = render(<Field label="Email" hint="We never spam" />);
    expect(container.querySelector(".field-hint")?.textContent).toBe(
      "We never spam",
    );
    expect(container.querySelector(".field-error")).toBeNull();
  });
});
