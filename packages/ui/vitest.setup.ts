import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount rendered trees between tests so document-scoped queries (getByText)
// never see leftovers from a previous render.
afterEach(() => {
  cleanup();
});
