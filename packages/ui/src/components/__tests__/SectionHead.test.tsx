import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SectionHead } from "../SectionHead";

describe("SectionHead", () => {
  it("renders eyebrow + h2 + lede", () => {
    const { container } = render(
      <SectionHead eyebrow="Model" title="Title">
        Lede
      </SectionHead>,
    );
    expect(container.querySelector(".eyebrow")?.textContent).toBe("Model");
    expect(container.querySelector("h2")?.textContent).toBe("Title");
    // the lede is the <p> that is not the eyebrow
    expect(container.querySelector("p:not(.eyebrow)")?.textContent).toBe("Lede");
  });

  it("omits the lede <p> when there are no children", () => {
    const { container } = render(<SectionHead eyebrow="E" title="T" />);
    expect(container.querySelector("p:not(.eyebrow)")).toBeNull();
  });
});
