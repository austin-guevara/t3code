import { describe, expect, it } from "vite-plus/test";

import { addressFromText } from "./addressEntry";

describe("addressFromText", () => {
  it("reads a typed address as a page", () => {
    expect(addressFromText("example.com")).toBe("https://example.com/");
    expect(addressFromText(" localhost:3000/docs ")).toBe("http://localhost:3000/docs");
  });

  it("leaves prompts and file names for the agent", () => {
    expect(addressFromText("fix the login page")).toBeNull();
    expect(addressFromText("README.md")).toBeNull();
    expect(addressFromText("refactor")).toBeNull();
  });
});
