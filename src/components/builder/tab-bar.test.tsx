/**
 * Unit tests for TabBar component
 */

import { describe, it, expect } from "vitest";
import { getFileName } from "./tab-bar";

describe("TabBar", () => {
  describe("getFileName", () => {
    it("should extract filename from path", () => {
      expect(getFileName("/src/app.ts")).toBe("app.ts");
      expect(getFileName("/src/components/Button.tsx")).toBe("Button.tsx");
      expect(getFileName("/package.json")).toBe("package.json");
    });

    it("should handle paths without directory", () => {
      expect(getFileName("app.ts")).toBe("app.ts");
      expect(getFileName("README.md")).toBe("README.md");
    });

    it("should handle deeply nested paths", () => {
      expect(getFileName("/a/b/c/d/e/f/file.ts")).toBe("file.ts");
    });

    it("should handle paths with trailing slash", () => {
      // When path ends with /, split returns empty string as last element
      // Function returns the original path as fallback
      expect(getFileName("/src/app.ts/")).toBe("/src/app.ts/");
    });

    it("should handle empty path", () => {
      expect(getFileName("")).toBe("");
    });

    it("should handle single character filename", () => {
      expect(getFileName("/a")).toBe("a");
      expect(getFileName("a")).toBe("a");
    });

    it("should handle filenames with multiple dots", () => {
      expect(getFileName("/src/app.test.ts")).toBe("app.test.ts");
      expect(getFileName("/src/app.spec.js")).toBe("app.spec.js");
    });

    it("should handle special characters in filename", () => {
      expect(getFileName("/src/my-component.tsx")).toBe("my-component.tsx");
      expect(getFileName("/src/my_component.tsx")).toBe("my_component.tsx");
      expect(getFileName("/src/my component.tsx")).toBe("my component.tsx");
    });
  });
});
